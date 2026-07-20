import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

interface RegisteredServiceProps extends BaseEntityProps {
  name: string; // stable service name, e.g. 'rateengine'
  apiKey: string; // opaque token presented as x-api-key
  description?: string | null;
  isActive: boolean; // false = revoked
}

/**
 * A microservice registered to call THIS service. Holds its opaque API key — the
 * service-to-service credential matched on gRPC/REST `x-api-key`. `isActive=false`
 * (revoked) ⇒ the key stops resolving without rotating any shared secret. Mirrors
 * the Accounts/Product service-registry pattern.
 */
export class RegisteredService extends AuditableEntity<RegisteredServiceProps> {
  get id(): UniqueEntityID {
    return this._id;
  }

  public get name(): string {
    return this.props.name;
  }

  public get apiKey(): string {
    return this.props.apiKey;
  }

  public set apiKey(value: string) {
    this.props.apiKey = value;
  }

  public get description(): string | null | undefined {
    return this.props.description;
  }

  public set description(value: string | null | undefined) {
    this.props.description = value;
  }

  public get isActive(): boolean {
    return this.props.isActive;
  }

  public set isActive(value: boolean) {
    this.props.isActive = value;
  }

  private constructor(props: RegisteredServiceProps, id?: UniqueEntityID) {
    super(props, id);
  }

  public static create(
    props: RegisteredServiceProps,
    id?: UniqueEntityID,
  ): Result<RegisteredService> {
    const guardResult = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.name, argumentName: 'name' },
      { argument: props.apiKey, argumentName: 'apiKey' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<RegisteredService>(guardResult.message);
    }

    const presenceResult = Guard.againstNullOrUndefinedBulk([
      { argument: props.isActive, argumentName: 'isActive' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!presenceResult.succeeded) {
      return Result.fail<RegisteredService>(presenceResult.message);
    }

    return Result.ok<RegisteredService>(new RegisteredService({ ...props }, id));
  }
}
