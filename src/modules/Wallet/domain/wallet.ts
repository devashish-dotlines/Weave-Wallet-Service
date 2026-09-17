import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { DateTimeObject } from '../../Core/domain/dateTimeObject';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

/**
 * The wallet lifecycle slugs the local default uses (FR-WL-6). Once workflow is
 * wired, `status` is driven by the engine and may carry any slug it defines, so
 * the domain does not restrict it to this set — it is documentation + the seed
 * of the initial local value.
 */
export type WalletStatus = 'pending' | 'active' | 'suspended' | 'closed';
export const WALLET_DEFAULT_STATUS: WalletStatus = 'pending';

export interface WalletProps extends BaseEntityProps {
  /** Auto-generated unique code, prefix `WAL` (FR-WL-2). */
  code: string;
  walletTypeId: string;
  /** Unit of value (UOM replaces currency). */
  uomId: string;
  /** Owner-type lookup FK (Customer, Partner, User, …). */
  ownerTypeId: string;
  /** Opaque owner id from the owning service — not resolved cross-service. */
  ownerId: string;
  /**
   * Caller-supplied idempotency handle for service-to-service provisioning.
   * Undefined for wallets created through the UI. Unique when present, which is
   * what makes ProvisionWallet safe to replay.
   */
  externalRef?: string;
  parentWalletId?: string;
  displayName?: string;
  /** Cached, ledger-derived balance (FR-WL-3). Not moved by transactions this pass. */
  balance: number;
  /** Cached held amount (FR-WL-3). */
  heldAmount: number;
  minBalance?: number;
  maxBalance?: number;
  dailyDebitLimit?: number;
  monthlyDebitLimit?: number;
  expiresAt?: DateTimeObject;
  /**
   * Denormalized workflow status (FR-WF-1/2): a cache of the engine's
   * WorkflowInstance.current_status. Never edited directly by clients.
   */
  status: string;
  statusId?: string;
  statusName?: string;
  statusColor?: string;
}

export class Wallet extends AuditableEntity<WalletProps> {
  get id(): UniqueEntityID {
    return this._id;
  }
  get code(): string {
    return this.props.code;
  }
  get walletTypeId(): string {
    return this.props.walletTypeId;
  }
  get uomId(): string {
    return this.props.uomId;
  }
  get ownerTypeId(): string {
    return this.props.ownerTypeId;
  }
  get ownerId(): string {
    return this.props.ownerId;
  }
  get externalRef(): string | undefined {
    return this.props.externalRef;
  }
  get parentWalletId(): string | undefined {
    return this.props.parentWalletId;
  }
  get displayName(): string | undefined {
    return this.props.displayName;
  }
  get balance(): number {
    return this.props.balance;
  }
  get heldAmount(): number {
    return this.props.heldAmount;
  }
  get minBalance(): number | undefined {
    return this.props.minBalance;
  }
  get maxBalance(): number | undefined {
    return this.props.maxBalance;
  }
  get dailyDebitLimit(): number | undefined {
    return this.props.dailyDebitLimit;
  }
  get monthlyDebitLimit(): number | undefined {
    return this.props.monthlyDebitLimit;
  }
  get expiresAt(): DateTimeObject | undefined {
    return this.props.expiresAt;
  }
  get status(): string {
    return this.props.status;
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

  set displayName(value: string | undefined) {
    this.props.displayName = value;
  }
  set parentWalletId(value: string | undefined) {
    this.props.parentWalletId = value;
  }
  set minBalance(value: number | undefined) {
    this.props.minBalance = value;
  }
  set maxBalance(value: number | undefined) {
    this.props.maxBalance = value;
  }
  set dailyDebitLimit(value: number | undefined) {
    this.props.dailyDebitLimit = value;
  }
  set monthlyDebitLimit(value: number | undefined) {
    this.props.monthlyDebitLimit = value;
  }
  set expiresAt(value: DateTimeObject | undefined) {
    this.props.expiresAt = value;
  }

  /**
   * Project the engine's status onto the denormalized cache (FR-WF-2). The slug
   * (`status`) mirrors WorkflowInstance.current_status; the id/name/color carry
   * the engine's presentation metadata.
   */
  public applyWorkflowStatus(input: {
    status?: string;
    statusId?: string;
    statusName?: string;
    statusColor?: string;
  }): void {
    if (input.status !== undefined) this.props.status = input.status;
    this.props.statusId = input.statusId;
    this.props.statusName = input.statusName;
    this.props.statusColor = input.statusColor;
  }

  private constructor(props: WalletProps, id?: UniqueEntityID) {
    super(props, id);
  }

  public static create(props: WalletProps, id?: UniqueEntityID): Result<Wallet> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.code, argumentName: 'code' },
      { argument: props.walletTypeId, argumentName: 'walletTypeId' },
      { argument: props.uomId, argumentName: 'uomId' },
      { argument: props.ownerTypeId, argumentName: 'ownerTypeId' },
      { argument: props.ownerId, argumentName: 'ownerId' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<Wallet>(guard.message);

    const nn = Guard.againstNullOrUndefinedBulk([
      { argument: props.balance, argumentName: 'balance' },
      { argument: props.heldAmount, argumentName: 'heldAmount' },
      { argument: props.status, argumentName: 'status' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!nn.succeeded) return Result.fail<Wallet>(nn.message);

    if (props.heldAmount < 0) {
      return Result.fail<Wallet>('heldAmount must not be negative');
    }

    if (
      props.minBalance !== undefined &&
      props.maxBalance !== undefined &&
      props.maxBalance < props.minBalance
    ) {
      return Result.fail<Wallet>('maxBalance must be >= minBalance');
    }

    return Result.ok<Wallet>(new Wallet({ ...props }, id));
  }
}
