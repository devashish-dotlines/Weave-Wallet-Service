import {
  TopupRequest,
  TopupRequestState,
} from '../../domain/topupRequest';
import { TopupRequestAttachment } from '../../domain/topupRequestAttachment';

export interface TopupRequestFilter {
  walletId?: string;
  state?: TopupRequestState;
  requestedBy?: string;
  /** Unix seconds, inclusive. */
  createdFrom?: number;
  /** Unix seconds, inclusive. */
  createdTo?: number;
  limit?: number;
  offset?: number;
}

export interface TopupRequestPage {
  items: TopupRequest[];
  total: number;
}

export interface TopupStatusProjection {
  statusId: string;
  statusName?: string;
  statusColor?: string;
  statusClosed?: boolean;
}

export interface ITopupRequestRepo {
  exists(id: string): Promise<boolean>;
  findById(id: string): Promise<TopupRequest | null>;
  findByCode(code: string): Promise<TopupRequest | null>;
  list(filter: TopupRequestFilter): Promise<TopupRequestPage>;
  /**
   * Another live (not REJECTED/CANCELLED) request already claims this deposit
   * slip — the same reference into the same company bank account.
   */
  existsLiveDeposit(
    bankAccountCode: string,
    depositReference: string,
    excludeId?: string,
  ): Promise<boolean>;
  create(request: TopupRequest): Promise<string>;
  /**
   * Persist a state change, but only if the row is still in `expectedState`
   * (compare-and-set). Returns false when a concurrent change got there first.
   */
  saveTransition(
    request: TopupRequest,
    expectedState: TopupRequestState,
  ): Promise<boolean>;
  setWorkflowStatus(id: string, s: TopupStatusProjection): Promise<void>;
  setGlVoucher(id: string, glVoucherId: string): Promise<void>;

  listAttachments(topupRequestId: string): Promise<TopupRequestAttachment[]>;
  findAttachment(
    topupRequestId: string,
    attachmentId: string,
  ): Promise<TopupRequestAttachment | null>;
  countAttachments(topupRequestId: string): Promise<number>;
  addAttachment(attachment: TopupRequestAttachment): Promise<string>;
  /** Soft delete. Returns false when no live attachment matched. */
  deleteAttachment(
    topupRequestId: string,
    attachmentId: string,
    deletedBy: string,
  ): Promise<boolean>;
}
