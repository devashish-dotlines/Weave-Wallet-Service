import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

export type WalletCategory = 'prepaid' | 'postpaid' | 'reward' | 'escrow';
export const WALLET_CATEGORIES: WalletCategory[] = [
  'prepaid',
  'postpaid',
  'reward',
  'escrow',
];

export interface WalletTypeProps extends BaseEntityProps {
  name: string;
  description?: string;
  category: WalletCategory;
  /** The balance type every wallet created against this type carries. */
  balanceTypeId: string;
  overdraftAllowed: boolean;
  /** Only meaningful when overdraftAllowed; the max negative available balance. */
  overdraftLimit?: number;
  allowTransfersOut: boolean;
  allowWithdrawals: boolean;
  /** Required KYC level for wallets of this type. Stored only this pass. */
  requiredKycLevel: number;
  /** GL account code for posting templates. Stored only this pass (no GL bridge yet). */
  glAccountCode?: string;
  isActive: boolean;
}

/**
 * A wallet-type configuration template (FR-WT-2). Governs behaviour of every
 * wallet created against it. Invariants: overdraft limit must be non-negative and
 * is only valid when overdraft is allowed; category must be one of the known set.
 */
export class WalletType extends AuditableEntity<WalletTypeProps> {
  get id(): UniqueEntityID {
    return this._id;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | undefined {
    return this.props.description;
  }
  get category(): WalletCategory {
    return this.props.category;
  }
  get balanceTypeId(): string {
    return this.props.balanceTypeId;
  }
  get overdraftAllowed(): boolean {
    return this.props.overdraftAllowed;
  }
  get overdraftLimit(): number | undefined {
    return this.props.overdraftLimit;
  }
  get allowTransfersOut(): boolean {
    return this.props.allowTransfersOut;
  }
  get allowWithdrawals(): boolean {
    return this.props.allowWithdrawals;
  }
  get requiredKycLevel(): number {
    return this.props.requiredKycLevel;
  }
  get glAccountCode(): string | undefined {
    return this.props.glAccountCode;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }

  set name(value: string) {
    this.props.name = value;
  }
  set description(value: string | undefined) {
    this.props.description = value;
  }
  set category(value: WalletCategory) {
    this.props.category = value;
  }
  set balanceTypeId(value: string) {
    this.props.balanceTypeId = value;
  }
  set overdraftAllowed(value: boolean) {
    this.props.overdraftAllowed = value;
  }
  set overdraftLimit(value: number | undefined) {
    this.props.overdraftLimit = value;
  }
  set allowTransfersOut(value: boolean) {
    this.props.allowTransfersOut = value;
  }
  set allowWithdrawals(value: boolean) {
    this.props.allowWithdrawals = value;
  }
  set requiredKycLevel(value: number) {
    this.props.requiredKycLevel = value;
  }
  set glAccountCode(value: string | undefined) {
    this.props.glAccountCode = value;
  }
  set isActive(value: boolean) {
    this.props.isActive = value;
  }

  private constructor(props: WalletTypeProps, id?: UniqueEntityID) {
    super(props, id);
  }

  public static create(
    props: WalletTypeProps,
    id?: UniqueEntityID,
  ): Result<WalletType> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.name, argumentName: 'name' },
      { argument: props.category, argumentName: 'category' },
      { argument: props.balanceTypeId, argumentName: 'balanceTypeId' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<WalletType>(guard.message);

    const nn = Guard.againstNullOrUndefinedBulk([
      { argument: props.overdraftAllowed, argumentName: 'overdraftAllowed' },
      { argument: props.allowTransfersOut, argumentName: 'allowTransfersOut' },
      { argument: props.allowWithdrawals, argumentName: 'allowWithdrawals' },
      { argument: props.requiredKycLevel, argumentName: 'requiredKycLevel' },
      { argument: props.isActive, argumentName: 'isActive' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!nn.succeeded) return Result.fail<WalletType>(nn.message);

    const catOk = Guard.isOneOf(props.category, WALLET_CATEGORIES, 'category');
    if (!catOk.succeeded) return Result.fail<WalletType>(catOk.message);

    if (props.requiredKycLevel < 0) {
      return Result.fail<WalletType>('requiredKycLevel must not be negative');
    }

    if (props.overdraftLimit !== undefined && props.overdraftLimit < 0) {
      return Result.fail<WalletType>('overdraftLimit must not be negative');
    }

    if (!props.overdraftAllowed && (props.overdraftLimit ?? 0) > 0) {
      return Result.fail<WalletType>(
        'overdraftLimit is only valid when overdraft is allowed',
      );
    }

    return Result.ok<WalletType>(new WalletType({ ...props }, id));
  }
}
