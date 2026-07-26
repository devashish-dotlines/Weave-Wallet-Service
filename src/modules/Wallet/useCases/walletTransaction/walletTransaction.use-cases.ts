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
import { IWalletTransactionRepo } from '../../repos/interface/IWalletTransactionRepo';
import { IWalletUsageRestrictionRepo } from '../../repos/interface/IWalletUsageRestrictionRepo';
import { UsageContext, evaluateUsage } from '../../domain/usageContext';
import { config } from '../../../../config';
import { WalletResponse } from '../shared/response';

const TX_CODE_PREFIX = 'WTX';
const BLOCKED_STATUSES = new Set(['suspended', 'closed']);

/** A wallet may only move balance when it is not suspended/closed (FR-WL-6). */
function operable(wallet: Wallet): boolean {
  return !BLOCKED_STATUSES.has(wallet.status);
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
    private readonly walletRepo: IWalletRepo,
    private readonly txRepo: IWalletTransactionRepo,
  ) {}

  async execute(dto: CreditWalletDTO): Promise<WalletResponse<string>> {
    try {
      if (!(dto.amount > 0)) {
        return left(new BaseErrors.ValidationError('amount must be greater than 0'));
      }
      // FR-TX-8: replay an already-applied idempotency key.
      if (dto.idempotencyKey) {
        const prior = await this.txRepo.findByIdempotencyKey(dto.idempotencyKey);
        if (prior) return right(Result.ok<string>(prior.id.toString()));
      }

      const wallet = await this.walletRepo.findById(dto.walletId);
      if (!wallet) return left(new BaseErrors.NotFoundError('Wallet not found'));
      if (!operable(wallet)) {
        return left(
          new BaseErrors.BusinessRuleError(
            `Wallet is ${wallet.status}; balance operations are not permitted`,
          ),
        );
      }

      const amount = money(dto.amount);
      const before = money(wallet.balance);
      const after = money(before + amount);
      const now = DateTimeObject.create(-1).getValue();

      const txOrError = buildTx({
        code: await generateTxCode(this.txRepo),
        walletId: wallet.id.toString(),
        txType: 'credit',
        direction: 'credit',
        amount,
        balanceBefore: before,
        balanceAfter: after,
        idempotencyKey: dto.idempotencyKey,
        description: dto.description,
        requestedBy: dto.requestedBy,
        now,
      });
      if (txOrError.isFailure) {
        return left(new BaseErrors.ValidationError(txOrError.error.toString()));
      }

      const id = await this.txRepo.recordSingle({
        walletId: wallet.id.toString(),
        newBalance: after,
        requestedBy: dto.requestedBy,
        tx: txOrError.getValue(),
      });
      return right(Result.ok<string>(id));
    } catch (err) {
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
  ) {}

  async execute(dto: DebitWalletDTO): Promise<WalletResponse<string>> {
    try {
      if (!(dto.amount > 0)) {
        return left(new BaseErrors.ValidationError('amount must be greater than 0'));
      }
      if (dto.idempotencyKey) {
        const prior = await this.txRepo.findByIdempotencyKey(dto.idempotencyKey);
        if (prior) return right(Result.ok<string>(prior.id.toString()));
      }

      const wallet = await this.walletRepo.findById(dto.walletId);
      if (!wallet) return left(new BaseErrors.NotFoundError('Wallet not found'));
      if (!operable(wallet)) {
        return left(
          new BaseErrors.BusinessRuleError(
            `Wallet is ${wallet.status}; balance operations are not permitted`,
          ),
        );
      }

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
      const before = money(wallet.balance);
      const after = money(before - amount);
      // Available (net of holds) must not breach the floor (FR-TX-4).
      const availableAfter = money(after - money(wallet.heldAmount));
      if (availableAfter < balanceFloor(wallet, type)) {
        return left(
          new BaseErrors.BusinessRuleError(
            'Insufficient available balance for this debit',
          ),
        );
      }

      const now = DateTimeObject.create(-1).getValue();
      const txOrError = buildTx({
        code: await generateTxCode(this.txRepo),
        walletId: wallet.id.toString(),
        txType: 'debit',
        direction: 'debit',
        amount,
        balanceBefore: before,
        balanceAfter: after,
        idempotencyKey: dto.idempotencyKey,
        description: dto.description,
        requestedBy: dto.requestedBy,
        now,
      });
      if (txOrError.isFailure) {
        return left(new BaseErrors.ValidationError(txOrError.error.toString()));
      }

      const id = await this.txRepo.recordSingle({
        walletId: wallet.id.toString(),
        newBalance: after,
        requestedBy: dto.requestedBy,
        tx: txOrError.getValue(),
      });
      return right(Result.ok<string>(id));
    } catch (err) {
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
      if (dto.idempotencyKey) {
        const prior = await this.txRepo.findByIdempotencyKey(dto.idempotencyKey);
        if (prior) {
          // Replay: the prior debit leg + its linked credit leg.
          const legs = await this.txRepo.listByWallet(dto.fromWalletId);
          const credit = legs.find(
            (t) => t.parentTransactionId === prior.id.toString(),
          );
          return right(
            Result.ok<TransferResultDTO>({
              debitTransactionId: prior.id.toString(),
              creditTransactionId: credit ? credit.id.toString() : '',
            }),
          );
        }
      }

      const source = await this.walletRepo.findById(dto.fromWalletId);
      if (!source) {
        return left(new BaseErrors.NotFoundError('Source wallet not found'));
      }
      const dest = await this.walletRepo.findById(dto.toWalletId);
      if (!dest) {
        return left(new BaseErrors.NotFoundError('Destination wallet not found'));
      }
      if (!operable(source) || !operable(dest)) {
        return left(
          new BaseErrors.BusinessRuleError(
            'Both wallets must be operable (not suspended/closed) to transfer',
          ),
        );
      }
      // No FX this pass: both wallets must share the same unit (FR-TX-7 deferred FX).
      if (source.uomId !== dest.uomId) {
        return left(
          new BaseErrors.BusinessRuleError(
            'Cross-unit transfers are not supported yet (source and destination UOM differ)',
          ),
        );
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
      const srcBefore = money(source.balance);
      const srcAfter = money(srcBefore - amount);
      const availableAfter = money(srcAfter - money(source.heldAmount));
      if (availableAfter < balanceFloor(source, sourceType)) {
        return left(
          new BaseErrors.BusinessRuleError(
            'Insufficient available balance in the source wallet',
          ),
        );
      }
      const dstBefore = money(dest.balance);
      const dstAfter = money(dstBefore + amount);

      const now = DateTimeObject.create(-1).getValue();
      const code = await generateTxCode(this.txRepo);
      const debitId = new UniqueEntityID();

      const debitOrError = buildTx({
        code,
        walletId: source.id.toString(),
        txType: 'transfer',
        direction: 'debit',
        amount,
        balanceBefore: srcBefore,
        balanceAfter: srcAfter,
        counterpartyWalletId: dest.id.toString(),
        idempotencyKey: dto.idempotencyKey,
        description: dto.description,
        requestedBy: dto.requestedBy,
        now,
        id: debitId,
      });
      if (debitOrError.isFailure) {
        return left(new BaseErrors.ValidationError(debitOrError.error.toString()));
      }

      const creditOrError = buildTx({
        code: await generateTxCode(this.txRepo),
        walletId: dest.id.toString(),
        txType: 'transfer',
        direction: 'credit',
        amount,
        balanceBefore: dstBefore,
        balanceAfter: dstAfter,
        counterpartyWalletId: source.id.toString(),
        parentTransactionId: debitId.toString(),
        description: dto.description,
        requestedBy: dto.requestedBy,
        now,
      });
      if (creditOrError.isFailure) {
        return left(new BaseErrors.ValidationError(creditOrError.error.toString()));
      }

      const { debitId: dId, creditId: cId } = await this.txRepo.recordTransfer({
        source: { walletId: source.id.toString(), newBalance: srcAfter },
        dest: { walletId: dest.id.toString(), newBalance: dstAfter },
        requestedBy: dto.requestedBy,
        debitTx: debitOrError.getValue(),
        creditTx: creditOrError.getValue(),
      });

      return right(
        Result.ok<TransferResultDTO>({
          debitTransactionId: dId,
          creditTransactionId: cId,
        }),
      );
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class RecomputeWalletBalanceUseCase
  implements UseCase<RecomputeBalanceDTO, Promise<WalletResponse<RecomputeResultDTO>>>
{
  constructor(
    private readonly walletRepo: IWalletRepo,
    private readonly txRepo: IWalletTransactionRepo,
  ) {}

  async execute(
    dto: RecomputeBalanceDTO,
  ): Promise<WalletResponse<RecomputeResultDTO>> {
    try {
      const wallet = await this.walletRepo.findById(dto.walletId);
      if (!wallet) return left(new BaseErrors.NotFoundError('Wallet not found'));

      // Until the ledger lands, transaction rows ARE the source of truth:
      // balance = Σ completed credits − Σ completed debits.
      const { credits, debits } = await this.txRepo.sumForWallet(
        wallet.id.toString(),
      );
      const balance = money(credits - debits);
      await this.walletRepo.setBalance(
        wallet.id.toString(),
        balance,
        dto.requestedBy,
      );
      return right(
        Result.ok<RecomputeResultDTO>({
          walletId: wallet.id.toString(),
          balance,
        }),
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
