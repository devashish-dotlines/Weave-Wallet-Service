import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

export interface OwnerTypeProps extends BaseEntityProps {
  name: string;
  /** Short unique code, stored upper-cased (e.g. CUSTOMER, PARTNER, USER). */
  code: string;
  description?: string;
  isActive: boolean;
}

/**
 * An owner-type lookup — the kind of entity that owns a wallet (Customer,
 * Partner, User, …). A wallet references an owner as (ownerTypeId, ownerId);
 * the ownerId is an opaque string from the owning service — no cross-service
 * FK is resolved here. Code uniqueness is enforced in the use-case.
 */
export class OwnerType extends AuditableEntity<OwnerTypeProps> {
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

  private constructor(props: OwnerTypeProps, id?: UniqueEntityID) {
    super(props, id);
  }

  public static create(
    props: OwnerTypeProps,
    id?: UniqueEntityID,
  ): Result<OwnerType> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.name, argumentName: 'name' },
      { argument: props.code, argumentName: 'code' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<OwnerType>(guard.message);

    const nn = Guard.againstNullOrUndefinedBulk([
      { argument: props.isActive, argumentName: 'isActive' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!nn.succeeded) return Result.fail<OwnerType>(nn.message);

    const code = props.code.trim().toUpperCase();
    if (code.length === 0) {
      return Result.fail<OwnerType>('code must not be empty');
    }

    return Result.ok<OwnerType>(new OwnerType({ ...props, code }, id));
  }
}
