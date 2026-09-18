import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

export interface BalanceTypeProps extends BaseEntityProps {
  name: string;
  /** Short unique code, stored upper-cased (e.g. CASH, POINTS, REWARD). */
  code: string;
  description?: string;
  isActive: boolean;
  /** The kind of unit this balance holds (CURRENCY, POINTS, TIME, DATA …). */
  categoryId: string;
  /**
   * Units of that category the balance may be denominated in — acc_currency
   * ids for CURRENCY, wlt_uom ids for LOCAL categories. An **empty list means
   * any unit of the category**. That every id belongs to the category is
   * checked by the use case (it needs the UnitRegistry).
   */
  allowedUnitIds: string[];
}

/**
 * The nature of the value a wallet holds (cash, loyalty points, talk time …):
 * one unit category plus the units of it that are allowed. Code uniqueness is
 * a cross-record rule enforced in the use case.
 */
export class BalanceType extends AuditableEntity<BalanceTypeProps> {
  get id(): UniqueEntityID {
    return this._id;
  }
  get name(): string {
    return this.props.name;
  }
  get code(): string {
    return this.props.code;
  }
  get description(): string | undefined {
    return this.props.description;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get categoryId(): string {
    return this.props.categoryId;
  }
  get allowedUnitIds(): string[] {
    return this.props.allowedUnitIds;
  }

  /**
   * A unit is allowed when it is of this balance's category and either the
   * list is empty (any unit of the category) or it is on the list.
   */
  public allowsUnit(categoryId: string, unitId: string): boolean {
    if (categoryId !== this.props.categoryId) return false;
    if (this.props.allowedUnitIds.length === 0) return true;
    return this.props.allowedUnitIds.includes(unitId);
  }

  set name(value: string) {
    this.props.name = value;
  }
  set description(value: string | undefined) {
    this.props.description = value;
  }
  set isActive(value: boolean) {
    this.props.isActive = value;
  }
  set allowedUnitIds(value: string[]) {
    this.props.allowedUnitIds = value;
  }

  private constructor(props: BalanceTypeProps, id?: UniqueEntityID) {
    super(props, id);
  }

  public static create(
    props: BalanceTypeProps,
    id?: UniqueEntityID,
  ): Result<BalanceType> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.name, argumentName: 'name' },
      { argument: props.code, argumentName: 'code' },
      { argument: props.categoryId, argumentName: 'categoryId' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<BalanceType>(guard.message);

    const nn = Guard.againstNullOrUndefinedBulk([
      { argument: props.isActive, argumentName: 'isActive' },
      { argument: props.allowedUnitIds, argumentName: 'allowedUnitIds' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!nn.succeeded) return Result.fail<BalanceType>(nn.message);

    const code = props.code.trim().toUpperCase();
    if (code.length === 0) {
      return Result.fail<BalanceType>('code must not be empty');
    }

    if (!Array.isArray(props.allowedUnitIds)) {
      return Result.fail<BalanceType>('allowedUnitIds must be an array');
    }
    // A unit tagged twice is the same tag — collapse rather than reject.
    const allowedUnitIds = [...new Set(props.allowedUnitIds.filter(Boolean))];

    return Result.ok<BalanceType>(
      new BalanceType({ ...props, code, allowedUnitIds }, id),
    );
  }
}
