import {
  WalletTxType,
  WalletTxDirection,
  WalletTxState,
  WalletTxSourceType,
} from '../domain/walletTransaction';
import { UsageContext } from '../domain/usageContext';

/** Top-up (credit) an amount into a wallet. */
export interface CreditWalletDTO {
  walletId: string;
  amount: number;
  description?: string;
  idempotencyKey?: string;
  /** Defaults to ADMIN when omitted (the admin HTTP route). */
  sourceType?: WalletTxSourceType;
  sourceRef?: string;
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
  sourceType?: WalletTxSourceType;
  sourceRef?: string;
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
  sourceType?: WalletTxSourceType;
  sourceRef?: string;
  /**
   * Cap on the source wallet's completed outgoing debits of `sourceType` since
   * `since` (unix seconds), this transfer included. Set by the self-service
   * route from config; never taken from a request body.
   */
  dailyLimit?: { max: number; since: number };
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
  sourceType?: WalletTxSourceType;
  sourceRef?: string;
  glVoucherId?: string;
  createdAt: number;
}

export interface TransferResultDTO {
  debitTransactionId: string;
  creditTransactionId: string;
  /** Source wallet balance after the debit leg. */
  balanceAfter: number;
  /**
   * What the destination received, in ITS unit. Differs from the debited
   * amount only for a same-category conversion (1 GB → 1024 MB).
   */
  creditedAmount?: number;
  creditedUnitCode?: string;
}

export interface RecomputeResultDTO {
  walletId: string;
  balance: number;
}

/** Owner-initiated transfer out of a wallet they own, to a wallet named by code. */
export interface SelfTransferDTO {
  fromWalletId: string;
  toWalletCode: string;
  amount: number;
  /** Required: the client's retry key for this transfer. */
  idempotencyKey: string;
  note?: string;
  requestedBy: string;
}

/** What a sender may see about a recipient wallet before transferring. */
export interface TransferRecipientDTO {
  walletId: string;
  code: string;
  /** Masked, so a code lookup can't be used to harvest names. */
  displayNameMasked?: string;
  unitCategoryId: string;
  unitCode: string;
}
