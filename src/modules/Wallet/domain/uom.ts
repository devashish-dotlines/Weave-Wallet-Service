import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

export interface UomProps extends BaseEntityProps {
  name: string;
  /** Short unique code, stored upper-cased (e.g. POINTS, MINUTE, MB). */
  code: string;
  symbol?: string;
  /** A LOCAL unit category (POINTS, TIME, DATA …). */
  categoryId: string;
  /** How many of the category's base unit one of this is (GB = 1024 × MB). */
  factorToBase: number;
  isActive: boolean;
}

/**
 * A LOCAL unit of measure — points, minutes, megabytes. Money is not a UOM:
 * CURRENCY-category balances reference accounting currencies directly. Code
 * uniqueness is enforced in the use case; the category's LOCAL source is
 * checked there too (it needs the category row).
 */
export class Uom extends AuditableEntity<UomProps> {
  get id(): UniqueEntityID {
    return this._id;
  }
  get name(): string {
    return this.props.name;
  }
  get code(): string {
    return this.props.code;
  }
  get symbol(): string | undefined {
    return this.props.symbol;
  }
  get categoryId(): string {
    return this.props.categoryId;
  }
  get factorToBase(): number {
    return this.props.factorToBase;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }

  set name(value: string) {
    this.props.name = value;
  }
  set symbol(value: string | undefined) {
    this.props.symbol = value;
  }
  set factorToBase(value: number) {
    this.props.factorToBase = value;
  }
  set isActive(value: boolean) {
    this.props.isActive = value;
  }

  private constructor(props: UomProps, id?: UniqueEntityID) {
    super(props, id);
  }

  public static create(props: UomProps, id?: UniqueEntityID): Result<Uom> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.name, argumentName: 'name' },
      { argument: props.code, argumentName: 'code' },
      { argument: props.categoryId, argumentName: 'categoryId' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<Uom>(guard.message);

    const nn = Guard.againstNullOrUndefinedBulk([
      { argument: props.isActive, argumentName: 'isActive' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!nn.succeeded) return Result.fail<Uom>(nn.message);

    const code = props.code.trim().toUpperCase();
    if (code.length === 0) {
      return Result.fail<Uom>('code must not be empty');
    }
    if (
      typeof props.factorToBase !== 'number' ||
      !Number.isFinite(props.factorToBase) ||
      !(props.factorToBase > 0)
    ) {
      return Result.fail<Uom>('factorToBase must be a number greater than 0');
    }

    return Result.ok<Uom>(new Uom({ ...props, code }, id));
  }
}
