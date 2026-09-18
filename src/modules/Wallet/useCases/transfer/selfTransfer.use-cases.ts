import * as moment from 'moment-timezone';
import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import {
  SelfTransferDTO,
  TransferRecipientDTO,
  TransferResultDTO,
} from '../../DTO/walletTransactionDTO';
import { IWalletRepo } from '../../repos/interface/IWalletRepo';
import {
  ITopupConfigService,
  TopupConfigUnavailableError,
} from '../../services/topupConfig.service';
import { WalletResponse } from '../shared/response';
import { TransferUseCase } from '../walletTransaction/walletTransaction.use-cases';
import { GlPostingService } from '../../services/glPosting.service';

/** The business day for daily limits (same zone as DateTimeObject). */
const BUSINESS_TIMEZONE = 'Asia/Dhaka';
const BLOCKED_STATUSES = new Set(['suspended', 'closed']);
const MAX_CLIENT_KEY_LENGTH = 80;

function operable(status: string | undefined): boolean {
  return !BLOCKED_STATUSES.has((status ?? '').trim().toLowerCase());
}

/** "Acme Traders" → "Ac** Tr*****": enough to recognise, not to harvest. */
export function maskName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  return trimmed
    .split(/\s+/)
    .map((word) =>
      word.length <= 2 ? word[0] + '*'.repeat(word.length - 1) : word.slice(0, 2) + '*'.repeat(word.length - 2),
    )
    .join(' ');
}

function configError(err: unknown) {
  if (err instanceof TopupConfigUnavailableError) {
    return new BaseErrors.BusinessRuleError(`Transfers are not available: ${err.message}`);
  }
  return new GenericAppError.UnexpectedError(err);
}

/**
 * Resolve a recipient by wallet code before sending. Only operable wallets are
 * found, and nothing about the balance or owner is revealed.
 */
export class LookupTransferRecipientUseCase
  implements UseCase<string, Promise<WalletResponse<TransferRecipientDTO>>>
{
  constructor(
    private readonly walletRepo: IWalletRepo,
  ) {}

  async execute(code: string): Promise<WalletResponse<TransferRecipientDTO>> {
    try {
      const trimmed = (code ?? '').trim();
      if (!trimmed) return left(new BaseErrors.ValidationError('code is required'));

      const wallet = await this.walletRepo.findByCode(trimmed);
      if (!wallet || !operable(wallet.status)) {
        return left(new BaseErrors.NotFoundError('Wallet not found'));
      }
      return right(
        Result.ok<TransferRecipientDTO>({
          walletId: wallet.id.toString(),
          code: wallet.code,
          displayNameMasked: maskName(wallet.displayName),
          // Lets the sender see up front whether the units are compatible.
          unitCategoryId: wallet.unitCategoryId,
          unitCode: wallet.unitCode,
        }),
      );
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

/**
 * Instant transfer out of a wallet the caller owns (the route's
 * requireWalletOwner verified that) to a wallet named by code.
 *
 * Adds the self-service rules on top of TransferUseCase — which still enforces
 * operable wallets, same unit, `allowTransfersOut`, the balance floor and usage
 * restrictions, all under the row lock:
 *   - per-transfer min/max and a daily cap from WALLET_TOPUP.limits.transfer;
 *   - the daily cap counts today's completed TRANSFER debits, read under the
 *     lock, so parallel transfers can't jointly exceed it;
 *   - the client's idempotency key is namespaced by source wallet, so one
 *     owner's key can never replay (and reveal) another wallet's transfer.
 */
export class SelfTransferUseCase
  implements UseCase<SelfTransferDTO, Promise<WalletResponse<TransferResultDTO>>>
{
  constructor(
    private readonly walletRepo: IWalletRepo,
    private readonly limitsConfig: ITopupConfigService,
    private readonly transfer: TransferUseCase,
    private readonly gl?: Pick<GlPostingService, 'tryPostForTransaction'>,
  ) {}

  async execute(dto: SelfTransferDTO): Promise<WalletResponse<TransferResultDTO>> {
    try {
      const amount = Number(dto.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return left(new BaseErrors.ValidationError('amount must be a number greater than 0'));
      }
      if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
        return left(new BaseErrors.ValidationError('amount must have at most 2 decimal places'));
      }
      const clientKey = String(dto.idempotencyKey ?? '').trim();
      if (!clientKey || clientKey.length > MAX_CLIENT_KEY_LENGTH) {
        return left(
          new BaseErrors.ValidationError(
            `idempotencyKey is required (at most ${MAX_CLIENT_KEY_LENGTH} characters)`,
          ),
        );
      }
      const toCode = String(dto.toWalletCode ?? '').trim();
      if (!toCode) return left(new BaseErrors.ValidationError('toWalletCode is required'));

      const source = await this.walletRepo.findById(dto.fromWalletId);
      if (!source) return left(new BaseErrors.NotFoundError('Wallet not found'));
      const dest = await this.walletRepo.findByCode(toCode);
      if (!dest || !operable(dest.status)) {
        return left(new BaseErrors.NotFoundError('Destination wallet not found'));
      }
      if (dest.id.equals(source.id)) {
        return left(new BaseErrors.ValidationError('Cannot transfer to the same wallet'));
      }

      // Limits are per unit (config `limits.<UNIT>.transfer`).
      const limits = await this.limitsConfig.transferLimits(source.unitCode);
      if (amount < limits.min || amount > limits.max) {
        return left(
          new BaseErrors.BusinessRuleError(
            `Transfer amount must be between ${limits.min} and ${limits.max} ${source.unitCode}`,
          ),
        );
      }

      const result = await this.transfer.execute({
        fromWalletId: source.id.toString(),
        toWalletId: dest.id.toString(),
        amount,
        description: dto.note?.trim() || `Transfer to ${dest.code}`,
        idempotencyKey: `trf:${source.id.toString()}:${clientKey}`,
        sourceType: 'TRANSFER',
        dailyLimit: {
          max: limits.dailyMax,
          since: moment.tz(BUSINESS_TIMEZONE).startOf('day').unix(),
        },
        requestedBy: dto.requestedBy,
      });
      if (result.isRight() && this.gl) {
        // Don't hold the sender's response on accounting; the post is
        // idempotent and the reconciler catches anything this misses.
        void this.gl.tryPostForTransaction(result.value.getValue().debitTransactionId);
      }
      return result;
    } catch (err) {
      return left(configError(err));
    }
  }
}
