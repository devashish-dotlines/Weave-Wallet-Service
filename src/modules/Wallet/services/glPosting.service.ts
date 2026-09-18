import { WalletTransaction } from '../domain/walletTransaction';
import { IWalletTransactionRepo } from '../repos/interface/IWalletTransactionRepo';
import { IWalletRepo } from '../repos/interface/IWalletRepo';
import { ITopupRequestRepo } from '../repos/interface/ITopupRequestRepo';
import { IConversionService } from './conversion.service';
import { IUnitRegistry } from './unitRegistry.service';
import {
  PostFromEventInput,
  VoucherResult,
} from '../../../infra/grpc/clients/ledgerClient';

/** The slice of the accounting LedgerService this service needs. */
export interface LedgerPort {
  postFromEvent(input: PostFromEventInput): Promise<VoucherResult>;
}

export type GlPostOutcome = 'posted' | 'already-posted' | 'not-postable' | 'disabled';

/**
 * Posts accounting vouchers for wallet movements, via LedgerService.PostFromEvent.
 *
 * Always AFTER the movement committed, and never able to undo it: a failure
 * throws to the caller, which logs it; the GL reconciler retries later. Every
 * post is keyed `source_event = WTX:<code>`, which accounting treats as
 * idempotent, so inline posts, reconciler sweeps and retries can overlap safely.
 *
 * Events (posting rules configured in accounting):
 *   WALLET_TOPUP_BANK_<BANK_ACCOUNT_CODE>  Dr that bank's GL · Cr wallet liability
 *     — one rule per bank account, because accounting does not template
 *       account codes from the payload.
 *   WALLET_TRANSFER                        Dr/Cr wallet liability (wallet dimensions)
 *     — ONE voucher for both legs, keyed by the debit leg.
 *
 * ADMIN and PROVISION movements are not posted here.
 */
export class GlPostingService {
  constructor(
    private readonly ledger: LedgerPort | null,
    private readonly enabled: boolean,
    private readonly txRepo: IWalletTransactionRepo,
    private readonly walletRepo: IWalletRepo,
    private readonly topupRepo: ITopupRequestRepo,
    private readonly conversion: IConversionService,
    private readonly units?: IUnitRegistry,
  ) {}

  get isEnabled(): boolean {
    return this.enabled && !!this.ledger;
  }

  /** Post the voucher a transaction belongs to (either leg of a transfer works). */
  async postForTransaction(transactionId: string): Promise<GlPostOutcome> {
    if (!this.isEnabled) return 'disabled';
    const tx = await this.txRepo.findById(transactionId);
    if (!tx || tx.state !== 'completed') return 'not-postable';
    // Quantity-only units (minutes, megabytes) have no money value to book.
    if (!(await this.isValued(tx.walletId))) return 'not-postable';

    switch (tx.sourceType) {
      case 'BANK_DEPOSIT':
        return this.postBankDeposit(tx);
      case 'TRANSFER':
        return this.postTransfer(tx);
      default:
        return 'not-postable';
    }
  }

  /** Never throws — for inline use right after a movement. */
  async tryPostForTransaction(transactionId: string): Promise<GlPostOutcome | 'failed'> {
    try {
      return await this.postForTransaction(transactionId);
    } catch (err) {
      console.error(
        `[gl] posting for wallet transaction ${transactionId} failed; the reconciler will retry:`,
        (err as Error)?.message ?? err,
      );
      return 'failed';
    }
  }

  private async postBankDeposit(tx: WalletTransaction): Promise<GlPostOutcome> {
    if (tx.direction !== 'credit') return 'not-postable';
    if (tx.glVoucherId) return 'already-posted';

    const topupCode = (tx.sourceRef ?? '').replace(/^TUR:/, '');
    const request = topupCode ? await this.topupRepo.findByCode(topupCode) : null;
    if (!request) {
      throw new Error(`Top-up request for ${tx.code} (${tx.sourceRef}) not found`);
    }
    const wallet = await this.walletRepo.findById(tx.walletId);
    const base = await this.conversion.toBase(
      request.depositAmount,
      request.depositCurrency,
    );

    const voucher = await this.ledger!.postFromEvent({
      eventType: `WALLET_TOPUP_BANK_${eventSuffix(request.bankAccountCode)}`,
      payload: {
        // A voucher is always in BASE currency (acc_voucher has no currency
        // column), so the deposit is converted first; the original currency,
        // amount and rate ride along for reconciliation against the slip.
        amount: base.amount,
        currency: base.baseCurrency,
        deposit_amount: request.depositAmount,
        deposit_currency: request.depositCurrency,
        credit_amount: tx.amount,
        rate: request.rate,
        deposit_method: request.depositMethod,
        wallet_code: wallet?.code ?? tx.walletId,
        topup_code: request.code,
        bank_account_code: request.bankAccountCode,
        deposit_reference: request.depositReference,
      },
      voucherType: 'PAYMENT_RECEIPT',
      voucherDate: tx.createdAt?.value,
      narration: `Wallet top-up ${request.code}: ${request.depositAmount} ${request.depositCurrency} by ${DEPOSIT_METHOD_WORDS[request.depositMethod] ?? 'bank deposit'} (ref ${request.depositReference})`,
      sourceEvent: `WTX:${tx.code}`,
      requestedBy: tx.createdBy,
    });
    this.requireVoucher(voucher, tx);
    await this.txRepo.setGlVoucher([tx.id.toString()], voucher.voucherId);
    await this.topupRepo.setGlVoucher(request.id.toString(), voucher.voucherId);
    this.logWarnings(voucher, tx);
    return 'posted';
  }

  private async postTransfer(leg: WalletTransaction): Promise<GlPostOutcome> {
    const debit =
      leg.direction === 'debit'
        ? leg
        : leg.parentTransactionId
        ? await this.txRepo.findById(leg.parentTransactionId)
        : null;
    if (!debit) throw new Error(`Debit leg for transfer ${leg.code} not found`);
    if (debit.glVoucherId) return 'already-posted';

    const credit = (await this.txRepo.findByParentId(debit.id.toString())).find(
      (t) => t.direction === 'credit',
    );
    const from = await this.walletRepo.findById(debit.walletId);
    const to = debit.counterpartyWalletId
      ? await this.walletRepo.findById(debit.counterpartyWalletId)
      : null;

    const voucher = await this.ledger!.postFromEvent({
      eventType: 'WALLET_TRANSFER',
      payload: {
        amount: debit.amount,
        unit_code: from?.unitCode ?? '',
        from_wallet_code: from?.code ?? debit.walletId,
        to_wallet_code: to?.code ?? debit.counterpartyWalletId ?? '',
      },
      voucherType: 'JOURNAL',
      voucherDate: debit.createdAt?.value,
      narration: `Wallet transfer ${from?.code ?? debit.walletId} → ${to?.code ?? ''}`.trim(),
      sourceEvent: `WTX:${debit.code}`,
      requestedBy: debit.createdBy,
    });
    this.requireVoucher(voucher, debit);
    const ids = [debit.id.toString(), ...(credit ? [credit.id.toString()] : [])];
    await this.txRepo.setGlVoucher(ids, voucher.voucherId);
    this.logWarnings(voucher, debit);
    return 'posted';
  }

  private async isValued(walletId: string): Promise<boolean> {
    if (!this.units) return true;
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) return false;
    const unit = await this.units.resolve(wallet.unit);
    return !!unit?.valued;
  }

  private requireVoucher(voucher: VoucherResult, tx: WalletTransaction): void {
    if (!voucher.voucherId) {
      throw new Error(`Accounting returned no voucher for ${tx.code}`);
    }
  }

  private logWarnings(voucher: VoucherResult, tx: WalletTransaction): void {
    if (voucher.warnings.length) {
      console.warn(
        `[gl] voucher ${voucher.voucherNumber || voucher.voucherId} for ${tx.code} posted with warnings:`,
        voucher.warnings.join('; '),
      );
    }
  }
}

/** Bank account codes become part of an event type: A–Z, 0–9 and `_` only. */
const DEPOSIT_METHOD_WORDS: Record<string, string> = {
  MFS: 'mobile wallet',
  BILL_PAYMENT: 'bill payment',
};

export function eventSuffix(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}
