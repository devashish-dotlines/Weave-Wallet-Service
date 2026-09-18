import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import { DateTimeObject } from '../../../Core/domain/dateTimeObject';
import { UniqueEntityID } from '../../../../core/domain/UniqueEntityID';
import { Wallet } from '../../domain/wallet';
import { WalletType } from '../../domain/walletType';
import {
  WalletTransaction,
  WalletTxType,
  WalletTxDirection,
  WalletTxSourceType,
} from '../../domain/walletTransaction';
import { WalletTransactionMap } from '../../mappers/walletTransactionMap';
import {
  CreditWalletDTO,
  DebitWalletDTO,
  TransferDTO,
  RecomputeBalanceDTO,
  WalletTransactionDTO,
  TransferResultDTO,
  RecomputeResultDTO,
} from '../../DTO/walletTransactionDTO';
import { IWalletRepo } from '../../repos/interface/IWalletRepo';
import { IWalletTypeRepo } from '../../repos/interface/IWalletTypeRepo';
import {
  IWalletTransactionRepo,
  IdempotencyConflictError,
  MovePlan,
} from '../../repos/interface/IWalletTransactionRepo';
import { IWalletUsageRestrictionRepo } from '../../repos/interface/IWalletUsageRestrictionRepo';
import { UsageContext, evaluateUsage } from '../../domain/usageContext';
import { config } from '../../../../config';
import { WalletResponse } from '../shared/response';
import { IUnitRegistry, ResolvedUnit } from '../../services/unitRegistry.service';

/**
 * Resolve a wallet's unit and check `amount` fits its category's decimals
 * (whole minutes, whole MB, cents for money). The unit is immutable, so an
 * unlocked read is safe. Returns the unit, or the error to return. Skipped
 * (unit undefined) when no registry is wired — e.g. older construction in tests.
 */
/** Append a conversion note to a movement's description. */
function withNote(description: string | undefined, note: string | undefined): string | undefined {
  if (!note) return description;
  return description ? `${description} (${note})` : note;
}

async function unitCheck(
  units: IUnitRegistry | undefined,
  wallet: Wallet | null,
  amount: number,
): Promise<{ unit?: ResolvedUnit; error?: BaseErrors.AllErrors }> {
  if (!units || !wallet) return {};
  const unit = await units.resolve(wallet.unit);
  if (!unit) {
    return {
      error: new BaseErrors.BusinessRuleError(
        `The wallet's unit (${wallet.unitCode}) is no longer available`,
      ),
    };
  }
  const bad = units.checkAmount(amount, unit);
  return bad ? { unit, error: new BaseErrors.ValidationError(bad) } : { unit };
}

const TX_CODE_PREFIX = 'WTX';
const BLOCKED_STATUSES = new Set(['suspended', 'closed']);

/**
 * A wallet may only move balance when it is not suspended/closed (FR-WL-6).
 * The engine projects its display name ("Suspended"), so compare loosely.
 */
function operable(wallet: Wallet): boolean {
  return !BLOCKED_STATUSES.has((wallet.status ?? '').trim().toLowerCase());
}

function notOperable(wallet: Wallet): BaseErrors.BusinessRuleError {
  return new BaseErrors.BusinessRuleError(
    `Wallet is ${wallet.status}; balance operations are not permitted`,
  );
}

type MoveError = BaseErrors.AllErrors;

function reject(error: MoveError): MovePlan<MoveError> {
  return { ok: false, error };
}

async function findPrior(
  repo: IWalletTransactionRepo,
  idempotencyKey: string | undefined,
): Promise<WalletTransaction | null> {
  return idempotencyKey ? repo.findByIdempotencyKey(idempotencyKey) : null;
}

/**
 * A concurrent request with the same idempotency key committed between our
 * pre-check and our insert: return its row so the caller sees a replay, not a 500.
 */
async function replayAfterConflict(
  repo: IWalletTransactionRepo,
  err: unknown,
  idempotencyKey: string | undefined,
): Promise<WalletTransaction | null> {
  if (!(err instanceof IdempotencyConflictError) || !idempotencyKey) return null;
  return repo.findByIdempotencyKey(idempotencyKey);
}

/** Round to 2dp to avoid float drift on money math. */
function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * The lowest balance a debit may leave a wallet at: 0, unless the wallet type
 * allows overdraft (then -overdraftLimit), raised by any per-wallet minBalance.
 */
function balanceFloor(wallet: Wallet, type: WalletType): number {
  let floor = type.overdraftAllowed ? -(type.overdraftLimit ?? 0) : 0;
  if (wallet.minBalance !== undefined) {
    floor = Math.max(floor, wallet.minBalance);
  }
  return floor;
}

/**
 * Why this spend is not allowed out of this wallet, or null when it is.
 *
 * Dormant unless `USAGE_RESTRICTION_MODE` is set: 'off' short-circuits before
 * touching the DB, and 'shadow' evaluates and logs but always returns null, so
 * the would-be rejections can be measured before anyone flips to 'enforce'.
 *
 * The `countByWallet === 0` fast path means an unrestricted wallet — every
 * wallet, today — costs one COUNT and no aggregate load, mirroring the
 * shortcut `BalanceTypeRepo.isUomAllowed` takes.
 */
async function usageRejection(
  repo: IWalletUsageRestrictionRepo | undefined,
  walletId: string,
  context: UsageContext | undefined,
): Promise<string | null> {
  const mode = config.usageRestriction.mode;
  if (mode === 'off' || !repo) return null;

  if ((await repo.countByWallet(walletId)) === 0) return null;

  const rules = await repo.listRulesForEvaluation(walletId);
  const verdict = evaluateUsage(rules, context);
  if (verdict.allowed) return null;

  const reason = verdict.reason ?? 'this balance is restricted';
  if (mode === 'shadow') {
    console.warn(
      `[usage-restriction][shadow] wallet ${walletId} would have been rejected: ${reason}`,
    );
    return null;
  }
  return reason;
}

async function generateTxCode(repo: IWalletTransactionRepo): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    const code = `${TX_CODE_PREFIX}${rand}`;
    if (!(await repo.findByCode(code))) return code;
  }
  throw new Error('Failed to generate a unique transaction code');
}

function buildTx(params: {
  code: string;
  walletId: string;
  txType: WalletTxType;
  direction: WalletTxDirection;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  counterpartyWalletId?: string;
  idempotencyKey?: string;
  parentTransactionId?: string;
  description?: string;
  sourceType?: WalletTxSourceType;
  sourceRef?: string;
  requestedBy: string;
  now: DateTimeObject;
  id?: UniqueEntityID;
}): Result<WalletTransaction> {
  return WalletTransaction.create(
    {
      code: params.code,
      walletId: params.walletId,
      txType: params.txType,
      direction: params.direction,
      counterpartyWalletId: params.counterpartyWalletId,
      amount: params.amount,
      balanceBefore: params.balanceBefore,
      balanceAfter: params.balanceAfter,
      state: 'completed',
      idempotencyKey: params.idempotencyKey,
      parentTransactionId: params.parentTransactionId,
      description: params.description,
      sourceType: params.sourceType,
      sourceRef: params.sourceRef,
      createdBy: params.requestedBy,
      updatedBy: params.requestedBy,
      createdAt: params.now,
      updatedAt: params.now,
    },
    params.id,
  );
}

export class CreditWalletUseCase
  implements UseCase<CreditWalletDTO, Promise<WalletResponse<string>>>
{
  constructor(
    private readonly txRepo: IWalletTransactionRepo,
    // Optional + trailing: when wired, amounts are checked against the unit.
    private readonly walletRepo?: IWalletRepo,
    private readonly units?: IUnitRegistry,
  ) {}

  async execute(dto: CreditWalletDTO): Promise<WalletResponse<string>> {
    try {
      if (!(dto.amount > 0)) {
        return left(new BaseErrors.ValidationError('amount must be greater than 0'));
      }
      if (this.walletRepo && this.units) {
        const checked = await unitCheck(
          this.units,
          await this.walletRepo.findById(dto.walletId),
          dto.amount,
        );
        if (checked.error) return left(checked.error);
      }
      // FR-TX-8: replay an already-applied idempotency key.
      const prior = await findPrior(this.txRepo, dto.idempotencyKey);
      if (prior) return right(Result.ok<string>(prior.id.toString()));

      const amount = money(dto.amount);
      const code = await generateTxCode(this.txRepo);
      const now = DateTimeObject.create(-1).getValue();

      const outcome = await this.txRepo.applyMoves<MoveError>(
        [dto.walletId],
        dto.requestedBy,
        (locked) => {
          const wallet = locked.get(dto.walletId);
          if (!wallet) return reject(new BaseErrors.NotFoundError('Wallet not found'));
          if (!operable(wallet)) return reject(notOperable(wallet));

          const before = money(wallet.balance);
          const after = money(before + amount);
          const txOrError = buildTx({
            code,
            walletId: dto.walletId,
            txType: 'credit',
            direction: 'credit',
            amount,
            balanceBefore: before,
            balanceAfter: after,
            idempotencyKey: dto.idempotencyKey,
            description: dto.description,
            sourceType: dto.sourceType ?? 'ADMIN',
            sourceRef: dto.sourceRef,
            requestedBy: dto.requestedBy,
            now,
          });
          if (txOrError.isFailure) {
            return reject(new BaseErrors.ValidationError(txOrError.error.toString()));
          }
          return {
            ok: true,
            balances: [{ walletId: dto.walletId, newBalance: after }],
            txs: [txOrError.getValue()],
          };
        },
      );
      if (!outcome.ok) return left(outcome.error);
      return right(Result.ok<string>(outcome.txIds[0]));
    } catch (err) {
      const replay = await replayAfterConflict(this.txRepo, err, dto.idempotencyKey);
      if (replay) return right(Result.ok<string>(replay.id.toString()));
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class DebitWalletUseCase
  implements UseCase<DebitWalletDTO, Promise<WalletResponse<string>>>
{
  constructor(
    private readonly walletRepo: IWalletRepo,
    private readonly walletTypeRepo: IWalletTypeRepo,
    private readonly txRepo: IWalletTransactionRepo,
    // Optional + trailing so existing three-arg construction still type-checks.
    private readonly usageRestrictionRepo?: IWalletUsageRestrictionRepo,
    private readonly units?: IUnitRegistry,
  ) {}

  async execute(dto: DebitWalletDTO): Promise<WalletResponse<string>> {
    try {
      if (!(dto.amount > 0)) {
        return left(new BaseErrors.ValidationError('amount must be greater than 0'));
      }
      const checked = await unitCheck(
        this.units,
        await this.walletRepo.findById(dto.walletId),
        dto.amount,
      );
      if (checked.error) return left(checked.error);
      const prior = await findPrior(this.txRepo, dto.idempotencyKey);
      if (prior) return right(Result.ok<string>(prior.id.toString()));

      // Unlocked read for what cannot change under us (the wallet type); the
      // balance and status are re-read under the row lock below.
      const wallet = await this.walletRepo.findById(dto.walletId);
      if (!wallet) return left(new BaseErrors.NotFoundError('Wallet not found'));
      const type = await this.walletTypeRepo.findById(wallet.walletTypeId);
      if (!type) {
        return left(new BaseErrors.NotFoundError('Wallet type not found'));
      }

      // What this balance may be spent on — checked before the money math, the
      // same slot the balance type's UOM tag occupies in CreateWalletUseCase.
      const restricted = await usageRejection(
        this.usageRestrictionRepo,
        wallet.id.toString(),
        dto.usageContext,
      );
      if (restricted) {
        return left(new BaseErrors.BusinessRuleError(restricted));
      }

      const amount = money(dto.amount);
      const code = await generateTxCode(this.txRepo);
      const now = DateTimeObject.create(-1).getValue();

      const outcome = await this.txRepo.applyMoves<MoveError>(
        [dto.walletId],
        dto.requestedBy,
        (locked) => {
          const current = locked.get(dto.walletId);
          if (!current) return reject(new BaseErrors.NotFoundError('Wallet not found'));
          if (!operable(current)) return reject(notOperable(current));

          const before = money(current.balance);
          const after = money(before - amount);
          // Available (net of holds) must not breach the floor (FR-TX-4).
          const availableAfter = money(after - money(current.heldAmount));
          if (availableAfter < balanceFloor(current, type)) {
            return reject(
              new BaseErrors.BusinessRuleError(
                'Insufficient available balance for this debit',
              ),
            );
          }

          const txOrError = buildTx({
            code,
            walletId: dto.walletId,
            txType: 'debit',
            direction: 'debit',
            amount,
            balanceBefore: before,
            balanceAfter: after,
            idempotencyKey: dto.idempotencyKey,
            description: dto.description,
            sourceType: dto.sourceType ?? 'ADMIN',
            sourceRef: dto.sourceRef,
            requestedBy: dto.requestedBy,
            now,
          });
          if (txOrError.isFailure) {
            return reject(new BaseErrors.ValidationError(txOrError.error.toString()));
          }
          return {
            ok: true,
            balances: [{ walletId: dto.walletId, newBalance: after }],
            txs: [txOrError.getValue()],
          };
        },
      );
      if (!outcome.ok) return left(outcome.error);
      return right(Result.ok<string>(outcome.txIds[0]));
    } catch (err) {
      const replay = await replayAfterConflict(this.txRepo, err, dto.idempotencyKey);
      if (replay) return right(Result.ok<string>(replay.id.toString()));
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class TransferUseCase
  implements UseCase<TransferDTO, Promise<WalletResponse<TransferResultDTO>>>
{
  constructor(
    private readonly walletRepo: IWalletRepo,
    private readonly walletTypeRepo: IWalletTypeRepo,
    private readonly txRepo: IWalletTransactionRepo,
    // Optional + trailing so existing three-arg construction still type-checks.
    private readonly usageRestrictionRepo?: IWalletUsageRestrictionRepo,
    private readonly units?: IUnitRegistry,
  ) {}

  async execute(dto: TransferDTO): Promise<WalletResponse<TransferResultDTO>> {
    try {
      if (!(dto.amount > 0)) {
        return left(new BaseErrors.ValidationError('amount must be greater than 0'));
      }
      if (dto.fromWalletId === dto.toWalletId) {
        return left(
          new BaseErrors.ValidationError('Cannot transfer to the same wallet'),
        );
      }
      const prior = await findPrior(this.txRepo, dto.idempotencyKey);
      if (prior) return right(Result.ok(await this.replayResult(prior)));

      // Unlocked reads for what cannot change under us (existence, unit, the
      // source wallet type); balances and status are re-read under the lock.
      const source = await this.walletRepo.findById(dto.fromWalletId);
      if (!source) {
        return left(new BaseErrors.NotFoundError('Source wallet not found'));
      }
      const dest = await this.walletRepo.findById(dto.toWalletId);
      if (!dest) {
        return left(new BaseErrors.NotFoundError('Destination wallet not found'));
      }
      // Units: the same unit moves 1:1; another unit of the SAME category
      // converts through the category's base unit (1 GB → 1024 MB); a
      // different category (points → minutes, BDT → USD) is refused — money
      // FX is not a wallet transfer.
      const sameUnitMove =
        source.unitCategoryId === dest.unitCategoryId && source.unitId === dest.unitId;
      if (source.unitCategoryId !== dest.unitCategoryId) {
        return left(
          new BaseErrors.BusinessRuleError(
            `Can't transfer between ${source.unitCode} and ${dest.unitCode}: different kinds of unit`,
          ),
        );
      }
      const srcCheck = await unitCheck(this.units, source, dto.amount);
      if (srcCheck.error) return left(srcCheck.error);
      let creditAmount = money(dto.amount);
      let conversionNote: string | undefined;
      if (!sameUnitMove) {
        const dstUnit = this.units ? await this.units.resolve(dest.unit) : null;
        if (!this.units || !srcCheck.unit || !dstUnit) {
          return left(
            new BaseErrors.BusinessRuleError(
              `Can't convert ${source.unitCode} to ${dest.unitCode} right now`,
            ),
          );
        }
        // Same-category currencies are distinct money (BDT vs USD): that is FX.
        if (srcCheck.unit.unitSource === 'ACCOUNTING_CURRENCY') {
          return left(
            new BaseErrors.BusinessRuleError(
              `Currency conversion (${source.unitCode} → ${dest.unitCode}) is not supported in a transfer`,
            ),
          );
        }
        creditAmount = this.units.convert(dto.amount, srcCheck.unit, dstUnit);
        if (!(creditAmount > 0)) {
          return left(
            new BaseErrors.BusinessRuleError(
              `${dto.amount} ${source.unitCode} is less than one ${dest.unitCode}`,
            ),
          );
        }
        conversionNote = `${dto.amount} ${source.unitCode} = ${creditAmount} ${dest.unitCode}`;
      }

      const sourceType = await this.walletTypeRepo.findById(source.walletTypeId);
      if (!sourceType) {
        return left(new BaseErrors.NotFoundError('Source wallet type not found'));
      }
      if (!sourceType.allowTransfersOut) {
        return left(
          new BaseErrors.BusinessRuleError(
            'The source wallet type does not allow transfers out',
          ),
        );
      }

      // Source wallet only — the debit leg is the spend. A credit landing in the
      // destination isn't a use of the destination's balance.
      const restricted = await usageRejection(
        this.usageRestrictionRepo,
        source.id.toString(),
        dto.usageContext,
      );
      if (restricted) {
        return left(new BaseErrors.BusinessRuleError(restricted));
      }

      const amount = money(dto.amount);
      const debitCode = await generateTxCode(this.txRepo);
      const creditCode = await generateTxCode(this.txRepo);
      const now = DateTimeObject.create(-1).getValue();
      const debitId = new UniqueEntityID();
      const sourceRef = dto.sourceRef ?? `TRF:${debitCode}`;
      let srcAfter = 0;

      const outcome = await this.txRepo.applyMoves<MoveError>(
        [dto.fromWalletId, dto.toWalletId],
        dto.requestedBy,
        (locked, context) => {
          const src = locked.get(dto.fromWalletId);
          if (!src) return reject(new BaseErrors.NotFoundError('Source wallet not found'));
          const dst = locked.get(dto.toWalletId);
          if (!dst) {
            return reject(new BaseErrors.NotFoundError('Destination wallet not found'));
          }
          if (!operable(src) || !operable(dst)) {
            return reject(
              new BaseErrors.BusinessRuleError(
                'Both wallets must be operable (not suspended/closed) to transfer',
              ),
            );
          }

          const srcBefore = money(src.balance);
          srcAfter = money(srcBefore - amount);
          const availableAfter = money(srcAfter - money(src.heldAmount));
          if (availableAfter < balanceFloor(src, sourceType)) {
            return reject(
              new BaseErrors.BusinessRuleError(
                'Insufficient available balance in the source wallet',
              ),
            );
          }
          if (dto.dailyLimit) {
            const usedToday = money(context.outgoingTotal ?? 0);
            if (money(usedToday + amount) > dto.dailyLimit.max) {
              const remaining = money(Math.max(dto.dailyLimit.max - usedToday, 0));
              return reject(
                new BaseErrors.BusinessRuleError(
                  `Daily transfer limit of ${dto.dailyLimit.max} exceeded (${remaining} remaining today)`,
                ),
              );
            }
          }
          const dstBefore = money(dst.balance);
          const dstAfter = money(dstBefore + creditAmount);

          const debitOrError = buildTx({
            code: debitCode,
            walletId: dto.fromWalletId,
            txType: 'transfer',
            direction: 'debit',
            amount,
            balanceBefore: srcBefore,
            balanceAfter: srcAfter,
            counterpartyWalletId: dto.toWalletId,
            idempotencyKey: dto.idempotencyKey,
            description: withNote(dto.description, conversionNote),
            sourceType: dto.sourceType ?? 'ADMIN',
            sourceRef,
            requestedBy: dto.requestedBy,
            now,
            id: debitId,
          });
          if (debitOrError.isFailure) {
            return reject(new BaseErrors.ValidationError(debitOrError.error.toString()));
          }
          const creditOrError = buildTx({
            code: creditCode,
            walletId: dto.toWalletId,
            txType: 'transfer',
            direction: 'credit',
            amount: creditAmount,
            balanceBefore: dstBefore,
            balanceAfter: dstAfter,
            counterpartyWalletId: dto.fromWalletId,
            parentTransactionId: debitId.toString(),
            description: withNote(dto.description, conversionNote),
            sourceType: dto.sourceType ?? 'ADMIN',
            sourceRef,
            requestedBy: dto.requestedBy,
            now,
          });
          if (creditOrError.isFailure) {
            return reject(new BaseErrors.ValidationError(creditOrError.error.toString()));
          }
          return {
            ok: true,
            balances: [
              { walletId: dto.fromWalletId, newBalance: srcAfter },
              { walletId: dto.toWalletId, newBalance: dstAfter },
            ],
            txs: [debitOrError.getValue(), creditOrError.getValue()],
          };
        },
        dto.dailyLimit
          ? {
              outgoingSince: {
                walletId: dto.fromWalletId,
                since: dto.dailyLimit.since,
                sourceType: dto.sourceType ?? 'ADMIN',
              },
            }
          : {},
      );
      if (!outcome.ok) return left(outcome.error);

      return right(
        Result.ok<TransferResultDTO>({
          debitTransactionId: outcome.txIds[0],
          creditTransactionId: outcome.txIds[1],
          balanceAfter: srcAfter,
          creditedAmount: creditAmount,
          creditedUnitCode: dest.unitCode,
        }),
      );
    } catch (err) {
      try {
        const replay = await replayAfterConflict(this.txRepo, err, dto.idempotencyKey);
        if (replay) return right(Result.ok(await this.replayResult(replay)));
      } catch (replayErr) {
        return left(new GenericAppError.UnexpectedError(replayErr));
      }
      return left(new GenericAppError.UnexpectedError(err));
    }
  }

  /** The prior debit leg plus its linked credit leg (stored on the destination). */
  private async replayResult(debit: WalletTransaction): Promise<TransferResultDTO> {
    const legs = await this.txRepo.findByParentId(debit.id.toString());
    const credit = legs.find((t) => t.direction === 'credit');
    return {
      debitTransactionId: debit.id.toString(),
      creditTransactionId: credit ? credit.id.toString() : '',
      balanceAfter: debit.balanceAfter,
    };
  }
}

export class RecomputeWalletBalanceUseCase
  implements UseCase<RecomputeBalanceDTO, Promise<WalletResponse<RecomputeResultDTO>>>
{
  constructor(private readonly txRepo: IWalletTransactionRepo) {}

  async execute(
    dto: RecomputeBalanceDTO,
  ): Promise<WalletResponse<RecomputeResultDTO>> {
    try {
      // Until the ledger lands, transaction rows ARE the source of truth:
      // balance = Σ completed credits − Σ completed debits, under the row lock
      // so a concurrent move can't slip between the sum and the write.
      const balance = await this.txRepo.recomputeBalance(
        dto.walletId,
        dto.requestedBy,
      );
      if (balance === null) {
        return left(new BaseErrors.NotFoundError('Wallet not found'));
      }
      return right(
        Result.ok<RecomputeResultDTO>({ walletId: dto.walletId, balance }),
      );
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class ListWalletTransactionsUseCase
  implements UseCase<string, Promise<WalletResponse<WalletTransactionDTO[]>>>
{
  constructor(private readonly txRepo: IWalletTransactionRepo) {}

  async execute(
    walletId: string,
  ): Promise<WalletResponse<WalletTransactionDTO[]>> {
    try {
      const items = await this.txRepo.listByWallet(walletId);
      return right(
        Result.ok<WalletTransactionDTO[]>(
          items.map(WalletTransactionMap.toDTO),
        ),
      );
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class GetWalletTransactionUseCase
  implements UseCase<string, Promise<WalletResponse<WalletTransactionDTO>>>
{
  constructor(private readonly txRepo: IWalletTransactionRepo) {}

  async execute(id: string): Promise<WalletResponse<WalletTransactionDTO>> {
    try {
      const tx = await this.txRepo.findById(id);
      if (!tx) return left(new BaseErrors.NotFoundError('Transaction not found'));
      return right(
        Result.ok<WalletTransactionDTO>(WalletTransactionMap.toDTO(tx)),
      );
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
