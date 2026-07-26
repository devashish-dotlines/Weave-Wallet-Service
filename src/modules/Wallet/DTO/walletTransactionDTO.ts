import { WalletTxType, WalletTxDirection, WalletTxState } from '../domain/walletTransaction';
import { UsageContext } from '../domain/usageContext';

/** Top-up (credit) an amount into a wallet. */
export interface CreditWalletDTO {
  walletId: string;
  amount: number;
  description?: string;
  idempotencyKey?: string;
  requestedBy: string;
}

/** Debit an amount out of a wallet. */
export interface DebitWalletDTO {
  walletId: string;
  amount: number;
  description?: string;
  idempotencyKey?: string;
  /**
   * What this spend is for, keyed by usage-dimension CODE (e.g.
   * `{ CALL_TYPE: 'LOCAL', TIME_BAND: ['NIGHT', 'WEEKEND'] }`). Checked against
   * the wallet's usage restrictions.
   *
   * Values are already-resolved keys — the wallet compares keys, it does not
   * resolve the clock or a dialled number. Only consulted when
   * `config.usageRestriction.mode` is not 'off'.
   */
  usageContext?: UsageContext;
  requestedBy: string;
}

/** Move an amount from one wallet to another (single logical operation). */
export interface TransferDTO {
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  description?: string;
  idempotencyKey?: string;
  /** Checked against the SOURCE wallet's restrictions — the debit leg is the spend. */
  usageContext?: UsageContext;
  requestedBy: string;
}

export interface RecomputeBalanceDTO {
  walletId: string;
  requestedBy: string;
}

export interface WalletTransactionDTO {
  id: string;
  code: string;
  walletId: string;
  txType: WalletTxType;
  direction: WalletTxDirection;
  counterpartyWalletId?: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  state: WalletTxState;
  idempotencyKey?: string;
  parentTransactionId?: string;
  description?: string;
  createdAt: number;
}

export interface TransferResultDTO {
  debitTransactionId: string;
  creditTransactionId: string;
}

export interface RecomputeResultDTO {
  walletId: string;
  balance: number;
}
