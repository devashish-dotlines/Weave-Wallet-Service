import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { DateTimeObject } from '../../Core/domain/dateTimeObject';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

/** How the money arrives. `GATEWAY` joins this list with payment gateways. */
export type TopupChannel = 'BANK_DEPOSIT';
export const TOPUP_CHANNELS: TopupChannel[] = ['BANK_DEPOSIT'];

/**
 * Local lifecycle of a top-up request. The workflow engine owns the review
 * statuses; this state is what the wallet itself relies on (what may be edited,
 * whether money has moved), so it never depends on engine status names.
 *
 *   DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED ──credit──▶ CREDITED
 *     │                  │  └──reject──▶ REJECTED
 *     └──cancel──▶ CANCELLED ◀──cancel──┘
 */
export type TopupRequestState =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CREDITED'
  | 'CANCELLED';
export const TOPUP_REQUEST_STATES: TopupRequestState[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CREDITED',
  'CANCELLED',
];

export type TopupReviewDecision = 'approve' | 'reject';

export const TOPUP_MAX_ATTACHMENTS = 3;

/** YYYY-MM-DD in the project timezone; compares correctly as a string. */
function calendarDay(d: DateTimeObject): string {
  return d.toFormattedString().slice(0, 10);
}

/** How the depositor paid: at the bank, from a mobile wallet, or by bill payment (JomPAY). */
export type TopupDepositMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'MFS' | 'BILL_PAYMENT';
export const TOPUP_DEPOSIT_METHODS: TopupDepositMethod[] = [
  'CASH',
  'BANK_TRANSFER',
  'CHEQUE',
  'MFS',
  'BILL_PAYMENT',
];

/**
 * Wallet units bought by `depositAmount` at `rate`, where the rate is the
 * currency worth of ONE wallet unit (1 POINT = 30 BDT → rate 30). Rounded
 * DOWN to 2 decimals so a rounding remainder never credits more than was paid.
 */
export function creditFromDeposit(
  depositAmount: number,
  rate: number,
  decimals = 2,
): number {
  const scale = 10 ** decimals;
  // The epsilon absorbs float noise so an exact quotient isn't floored a step.
  return Math.floor((depositAmount / rate) * scale + 1e-9) / scale;
}

export interface TopupRequestProps extends BaseEntityProps {
  /** Auto-generated unique code, prefix `TUR`. */
  code: string;
  walletId: string;
  channel: TopupChannel;
  /** What the wallet is credited, in the wallet's own unit. */
  amount: number;
  /** The wallet's unit, copied at creation so the request reads on its own. */
  unitCategoryId: string;
  unitId: string;
  unitCode: string;

  /** Currency actually paid into the bank, e.g. BDT or MYR. */
  depositCurrency: string;
  /** Amount on the slip, in `depositCurrency`. */
  depositAmount: number;
  depositMethod: TopupDepositMethod;
  /**
   * Currency per one wallet unit, fixed when the request is created so a later
   * rate change cannot alter what an already-submitted request credits.
   */
  rate: number;
  /** Gateway subject of the owner who raised the request. */
  requestedBy: string;

  /** Company bank account the money was deposited into (config `code`). */
  bankAccountCode: string;
  /** Bank-issued slip / transaction reference. */
  depositReference: string;
  depositDate: DateTimeObject;
  depositorName?: string;
  note?: string;

  state: TopupRequestState;
  submittedAt?: DateTimeObject;
  reviewedBy?: string;
  reviewedAt?: DateTimeObject;
  decisionNote?: string;
  /** The wallet credit this request produced, once CREDITED. */
  walletTransactionId?: string;
  glVoucherId?: string;

  /** Denormalized workflow status (cache of the engine's instance status). */
  statusId?: string;
  statusName?: string;
  statusColor?: string;
  statusClosed?: boolean;
}

/** True when `n` has at most two decimal places (money). */
function hasAtMostTwoDecimals(n: number): boolean {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

export class TopupRequest extends AuditableEntity<TopupRequestProps> {
  get id(): UniqueEntityID {
    return this._id;
  }
  get code(): string {
    return this.props.code;
  }
  get walletId(): string {
    return this.props.walletId;
  }
  get channel(): TopupChannel {
    return this.props.channel;
  }
  get amount(): number {
    return this.props.amount;
  }
  get unitCategoryId(): string {
    return this.props.unitCategoryId;
  }
  get unitId(): string {
    return this.props.unitId;
  }
  get unitCode(): string {
    return this.props.unitCode;
  }
  get depositCurrency(): string {
    return this.props.depositCurrency;
  }
  get depositAmount(): number {
    return this.props.depositAmount;
  }
  get depositMethod(): TopupDepositMethod {
    return this.props.depositMethod;
  }
  get rate(): number {
    return this.props.rate;
  }
  get requestedBy(): string {
    return this.props.requestedBy;
  }
  get bankAccountCode(): string {
    return this.props.bankAccountCode;
  }
  get depositReference(): string {
    return this.props.depositReference;
  }
  get depositDate(): DateTimeObject {
    return this.props.depositDate;
  }
  get depositorName(): string | undefined {
    return this.props.depositorName;
  }
  get note(): string | undefined {
    return this.props.note;
  }
  get state(): TopupRequestState {
    return this.props.state;
  }
  get submittedAt(): DateTimeObject | undefined {
    return this.props.submittedAt;
  }
  get reviewedBy(): string | undefined {
    return this.props.reviewedBy;
  }
  get reviewedAt(): DateTimeObject | undefined {
    return this.props.reviewedAt;
  }
  get decisionNote(): string | undefined {
    return this.props.decisionNote;
  }
  get walletTransactionId(): string | undefined {
    return this.props.walletTransactionId;
  }
  get glVoucherId(): string | undefined {
    return this.props.glVoucherId;
  }
  get statusId(): string | undefined {
    return this.props.statusId;
  }
  get statusName(): string | undefined {
    return this.props.statusName;
  }
  get statusColor(): string | undefined {
    return this.props.statusColor;
  }
  get statusClosed(): boolean {
    return this.props.statusClosed ?? false;
  }

  /** Attachments may only change while the owner is still preparing it. */
  get isEditable(): boolean {
    return this.props.state === 'DRAFT';
  }

  private touch(by: string, now: DateTimeObject): void {
    this.props.updatedBy = by;
    this.props.updatedAt = now;
  }

  /** DRAFT → SUBMITTED. The caller checks attachments exist first. */
  public submit(by: string, now: DateTimeObject): Result<void> {
    if (this.props.state !== 'DRAFT') {
      return Result.fail<void>(`Only a draft can be submitted (state is ${this.props.state})`);
    }
    this.props.state = 'SUBMITTED';
    this.props.submittedAt = now;
    this.touch(by, now);
    return Result.ok<void>();
  }

  /** DRAFT/SUBMITTED → CANCELLED, by the owner, before any review. */
  public cancel(by: string, now: DateTimeObject): Result<void> {
    if (this.props.state !== 'DRAFT' && this.props.state !== 'SUBMITTED') {
      return Result.fail<void>(`A ${this.props.state} request can no longer be cancelled`);
    }
    this.props.state = 'CANCELLED';
    this.touch(by, now);
    return Result.ok<void>();
  }

  /**
   * SUBMITTED → APPROVED / REJECTED. Maker-checker: the requester can never
   * review their own request. A rejection must say why.
   */
  public review(
    decision: TopupReviewDecision,
    reviewer: string,
    note: string | undefined,
    now: DateTimeObject,
  ): Result<void> {
    if (this.props.state !== 'SUBMITTED') {
      return Result.fail<void>(`Only a submitted request can be reviewed (state is ${this.props.state})`);
    }
    if (!reviewer) return Result.fail<void>('reviewer is required');
    if (reviewer === this.props.requestedBy) {
      return Result.fail<void>('A top-up request cannot be reviewed by its requester');
    }
    const trimmed = note?.trim();
    if (decision === 'reject' && !trimmed) {
      return Result.fail<void>('A note is required when rejecting');
    }
    this.props.state = decision === 'approve' ? 'APPROVED' : 'REJECTED';
    this.props.reviewedBy = reviewer;
    this.props.reviewedAt = now;
    this.props.decisionNote = trimmed || undefined;
    this.touch(reviewer, now);
    return Result.ok<void>();
  }

  /** APPROVED → CREDITED once the wallet credit exists. Idempotent for the same tx. */
  public markCredited(walletTransactionId: string, by: string, now: DateTimeObject): Result<void> {
    if (this.props.state === 'CREDITED') {
      return this.props.walletTransactionId === walletTransactionId
        ? Result.ok<void>()
        : Result.fail<void>('Request is already credited by a different transaction');
    }
    if (this.props.state !== 'APPROVED') {
      return Result.fail<void>(`Only an approved request can be credited (state is ${this.props.state})`);
    }
    if (!walletTransactionId) return Result.fail<void>('walletTransactionId is required');
    this.props.state = 'CREDITED';
    this.props.walletTransactionId = walletTransactionId;
    this.touch(by, now);
    return Result.ok<void>();
  }

  /** Project the engine's status onto the denormalized cache. */
  public applyWorkflowStatus(input: {
    statusId?: string;
    statusName?: string;
    statusColor?: string;
    statusClosed?: boolean;
  }): void {
    this.props.statusId = input.statusId;
    this.props.statusName = input.statusName;
    this.props.statusColor = input.statusColor;
    this.props.statusClosed = input.statusClosed ?? false;
  }

  private constructor(props: TopupRequestProps, id?: UniqueEntityID) {
    super(props, id);
  }

  /**
   * `now` bounds `depositDate`: a slip cannot be dated after today. The
   * deposit date is a calendar day (clients send it as noon UTC), so the check
   * compares days in the project timezone, not instants — otherwise a slip
   * dated today is "in the future" until 12:00 UTC. `now` is optional so
   * rehydrating an old row (mapper) never fails on the clock.
   */
  public static create(
    props: TopupRequestProps,
    id?: UniqueEntityID,
    now?: DateTimeObject,
  ): Result<TopupRequest> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.code, argumentName: 'code' },
      { argument: props.walletId, argumentName: 'walletId' },
      { argument: props.unitCategoryId, argumentName: 'unitCategoryId' },
      { argument: props.unitId, argumentName: 'unitId' },
      { argument: props.unitCode, argumentName: 'unitCode' },
      { argument: props.requestedBy, argumentName: 'requestedBy' },
      { argument: props.bankAccountCode, argumentName: 'bankAccountCode' },
      { argument: props.depositCurrency, argumentName: 'depositCurrency' },
      { argument: props.depositReference, argumentName: 'depositReference' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<TopupRequest>(guard.message);

    const nn = Guard.againstNullOrUndefinedBulk([
      { argument: props.amount, argumentName: 'amount' },
      { argument: props.depositAmount, argumentName: 'depositAmount' },
      { argument: props.rate, argumentName: 'rate' },
      { argument: props.depositDate, argumentName: 'depositDate' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!nn.succeeded) return Result.fail<TopupRequest>(nn.message);

    const channelOk = Guard.isOneOf(props.channel, TOPUP_CHANNELS, 'channel');
    if (!channelOk.succeeded) return Result.fail<TopupRequest>(channelOk.message);

    const stateOk = Guard.isOneOf(props.state, TOPUP_REQUEST_STATES, 'state');
    if (!stateOk.succeeded) return Result.fail<TopupRequest>(stateOk.message);

    const methodOk = Guard.isOneOf(
      props.depositMethod,
      TOPUP_DEPOSIT_METHODS,
      'depositMethod',
    );
    if (!methodOk.succeeded) return Result.fail<TopupRequest>(methodOk.message);

    if (typeof props.amount !== 'number' || !Number.isFinite(props.amount) || !(props.amount > 0)) {
      return Result.fail<TopupRequest>('amount must be a number greater than 0');
    }
    if (!hasAtMostTwoDecimals(props.amount)) {
      return Result.fail<TopupRequest>('amount must have at most 2 decimal places');
    }

    if (
      typeof props.depositAmount !== 'number' ||
      !Number.isFinite(props.depositAmount) ||
      !(props.depositAmount > 0)
    ) {
      return Result.fail<TopupRequest>('depositAmount must be a number greater than 0');
    }
    if (!hasAtMostTwoDecimals(props.depositAmount)) {
      return Result.fail<TopupRequest>('depositAmount must have at most 2 decimal places');
    }
    if (typeof props.rate !== 'number' || !Number.isFinite(props.rate) || !(props.rate > 0)) {
      return Result.fail<TopupRequest>('rate must be a number greater than 0');
    }
    // The credit must be exactly what the stored rate produces, so the figure
    // can be recomputed from the request alone (and a client cannot name it).
    // Rounded down to the unit's decimals (0–2), which the request doesn't
    // store — so any of those roundings is the credit the rate produced.
    const expected = creditFromDeposit(props.depositAmount, props.rate);
    const matchesRate = [0, 1, 2].some(
      (d) => Math.abs(creditFromDeposit(props.depositAmount, props.rate, d) - props.amount) < 1e-9,
    );
    if (!matchesRate) {
      return Result.fail<TopupRequest>(
        `amount ${props.amount} does not match ${props.depositAmount} ${props.depositCurrency} at rate ${props.rate} (expected ${expected})`,
      );
    }
    if (!(props.amount > 0)) {
      return Result.fail<TopupRequest>(
        `${props.depositAmount} ${props.depositCurrency} is too small to credit any whole unit at rate ${props.rate}`,
      );
    }

    if (props.depositReference.trim().length > 128) {
      return Result.fail<TopupRequest>('depositReference must be at most 128 characters');
    }
    if (props.note !== undefined && props.note.length > 500) {
      return Result.fail<TopupRequest>('note must be at most 500 characters');
    }
    if (now && calendarDay(props.depositDate) > calendarDay(now)) {
      return Result.fail<TopupRequest>('depositDate cannot be in the future');
    }

    return Result.ok<TopupRequest>(
      new TopupRequest(
        {
          ...props,
          depositReference: props.depositReference.trim(),
          depositCurrency: props.depositCurrency.toUpperCase(),
        },
        id,
      ),
    );
  }
}
