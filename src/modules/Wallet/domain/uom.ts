import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

export interface UomProps extends BaseEntityProps {
  name: string;
  /** Short unique code, stored upper-cased (e.g. BDT, USD, POINTS, MINUTES). */
  code: string;
  symbol?: string;
  isActive: boolean;
}

/**
 * A unit-of-measure lookup — the unit a wallet's value is denominated in. Since
 * UOM generalizes currency (money and non-money units alike), it is the unit
 * referenced by every wallet. Code uniqueness is enforced in the use-case.
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
  get isActive(): boolean {
    return this.props.isActive;
  }

  set name(value: string) {
    this.props.name = value;
  }
  set symbol(value: string | undefined) {
    this.props.symbol = value;
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

    return Result.ok<Uom>(new Uom({ ...props, code }, id));
  }
}
