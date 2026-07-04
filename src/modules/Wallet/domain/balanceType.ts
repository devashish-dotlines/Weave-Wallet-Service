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
}

/**
 * A balance-type lookup — the nature of the value a wallet holds (cash, loyalty
 * points, reward credits, …). A plain reference table; the only invariant is a
 * non-empty name/code. Code uniqueness is a cross-record rule enforced in the
 * use-case, not here.
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

  set name(value: string) {
    this.props.name = value;
  }
  set description(value: string | undefined) {
    this.props.description = value;
  }
  set isActive(value: boolean) {
    this.props.isActive = value;
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
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<BalanceType>(guard.message);

    const nn = Guard.againstNullOrUndefinedBulk([
      { argument: props.isActive, argumentName: 'isActive' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!nn.succeeded) return Result.fail<BalanceType>(nn.message);

    const code = props.code.trim().toUpperCase();
    if (code.length === 0) {
      return Result.fail<BalanceType>('code must not be empty');
    }

    return Result.ok<BalanceType>(new BalanceType({ ...props, code }, id));
  }
}
