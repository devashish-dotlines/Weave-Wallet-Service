import { IUser } from '../../../core/interface/iuser';
import {
  TopupChannel,
  TopupRequestState,
  TopupReviewDecision,
  TopupDepositMethod,
} from '../domain/topupRequest';

export interface TopupRequestAttachmentDTO {
  id: string;
  topupRequestId: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: number;
  createdBy: string;
}

export interface TopupRequestDTO {
  id: string;
  code: string;
  walletId: string;
  channel: TopupChannel;
  /** Credit to the wallet, in the wallet's UOM. */
  amount: number;
  unitCategoryId: string;
  unitId: string;
  unitCode: string;
  depositCurrency: string;
  depositAmount: number;
  depositMethod: TopupDepositMethod;
  /** Currency per one wallet unit, fixed at creation. */
  rate: number;
  requestedBy: string;
  bankAccountCode: string;
  depositReference: string;
  depositDate: number;
  depositorName?: string;
  note?: string;
  state: TopupRequestState;
  submittedAt?: number;
  reviewedBy?: string;
  reviewedAt?: number;
  decisionNote?: string;
  walletTransactionId?: string;
  glVoucherId?: string;
  statusId?: string;
  statusName?: string;
  statusColor?: string;
  statusClosed: boolean;
  createdAt: number;
  updatedAt: number;
  /** Present on detail reads; omitted from list rows. */
  attachments?: TopupRequestAttachmentDTO[];
}

// ---- inputs -----------------------------------------------------------------

export interface CreateTopupRequestDTO {
  walletId: string;
  /** Slip amount, in the chosen bank account's currency. */
  depositAmount: number;
  depositMethod: TopupDepositMethod;
  bankAccountCode: string;
  depositReference: string;
  /** Unix seconds (a date-only value may be sent as midnight). */
  depositDate: number;
  depositorName?: string;
  note?: string;
  requestedBy: string;
}

export interface UploadTopupAttachmentDTO {
  topupRequestId: string;
  file?: { buffer: Buffer; originalname: string; mimetype: string };
  actor?: IUser;
}

export interface TopupAttachmentRefDTO {
  topupRequestId: string;
  attachmentId: string;
  actor?: IUser;
}

/** Submit / cancel / get — an action on one request by an actor. */
export interface TopupRequestActionDTO {
  topupRequestId: string;
  actor?: IUser;
}

export interface ReviewTopupRequestDTO {
  topupRequestId: string;
  decision: TopupReviewDecision;
  note?: string;
  actor?: IUser;
}

export interface ListTopupRequestsDTO {
  walletId?: string;
  state?: TopupRequestState;
  createdFrom?: number;
  createdTo?: number;
  limit?: number;
  offset?: number;
}

export interface TopupRequestPageDTO {
  items: TopupRequestDTO[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * A company account as shown to depositors (no GL mapping): a bank account or
 * an MFS wallet, from accounting's collection accounts.
 */
export interface TopupBankAccountDTO {
  code: string;
  currency: string;
  channel: 'BANK' | 'MFS' | 'BILL_PAYMENT';
  /** Bank name, MFS provider (bKash, ...) or bill-payment scheme (JomPAY). */
  bankName: string;
  accountName: string;
  /** Account / wallet number; the biller code for BILL_PAYMENT. */
  accountNo: string;
  /** Fixed reference to quote (JomPAY Ref-1); absent = payer's own. */
  payerReference?: string;
  branch?: string;
  routingNo?: string;
  /** MFS only: MERCHANT | PERSONAL | AGENT. */
  mfsAccountType?: string;
  /** How to pay into this account, shown to the depositor. */
  instructions?: string;
  /** Deposit methods this account accepts; empty ⇒ all. */
  methods?: string[];
  /** Currency per one wallet unit for this wallet (1 POINT = 30 BDT → 30). */
  rate: number;
  /** Deposit limits, in this account's currency. */
  min?: number;
  max?: number;
}

/** What `GET /my-wallets/:id/topup/bank-accounts` returns. */
export interface TopupFundingOptionsDTO {
  walletId: string;
  unitCode: string;
  /** Decimals the credited amount is rounded down to. */
  decimals: number;
  accounts: TopupBankAccountDTO[];
}

export interface TopupAttachmentContent {
  stream: NodeJS.ReadableStream;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface TopupTransitionDTO {
  toStatusId: string;
  toStatusName: string;
  toStatusSlug: string;
}

export interface TopupTransitionsDTO {
  currentStatusId: string;
  currentStatusName: string;
  isClosed: boolean;
  transitions: TopupTransitionDTO[];
}
