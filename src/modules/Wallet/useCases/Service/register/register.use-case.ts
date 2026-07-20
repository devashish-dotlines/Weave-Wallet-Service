import { randomBytes } from 'crypto';
import { UseCase } from '../../../../../core/domain/UseCase';
import { Either, Result, left, right } from '../../../../../core/logic/Result';
import { GenericAppError } from '../../../../../core/logic/AppError';
import { BaseErrors } from '../../../../../core/infra/BaseErrors';
import { UniqueEntityID } from '../../../../../core/domain/UniqueEntityID';
import { DateTimeObject } from '../../../../Core/domain/dateTimeObject';

import {
  RegisterServiceDTO,
  RegisteredServiceSecretDTO,
} from '../../../DTO/registeredServiceDTO';
import { RegisteredService } from '../../../domain/registeredService';
import { IRegisteredServiceRepo } from '../../../repos/interface/IRegisteredServiceRepo';

type Response = Either<
  | BaseErrors.ValidationError
  | BaseErrors.AlreadyExistError
  | BaseErrors.GenericError
  | GenericAppError.UnexpectedError,
  Result<RegisteredServiceSecretDTO>
>;

const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

/** Generate an opaque, URL-safe service API key. */
function generateApiKey(): string {
  return `svc_${randomBytes(48).toString('base64url')}`;
}

export default class RegisterServiceUseCase
  implements UseCase<RegisterServiceDTO, Promise<Response>>
{
  constructor(private readonly serviceRepo: IRegisteredServiceRepo) {}

  async execute(dto: RegisterServiceDTO): Promise<Response> {
    try {
      if (!dto.name) {
        return left(new BaseErrors.ValidationError('name is required'));
      }

      const existing = await this.serviceRepo.findByName(dto.name);
      if (existing) {
        return left(
          new BaseErrors.AlreadyExistError(
            `A service named '${dto.name}' is already registered`,
          ),
        );
      }

      const apiKey = generateApiKey();
      const actorId = dto.requestedBy ?? SYSTEM_ACTOR_ID;
      const now = DateTimeObject.create(-1).getValue();

      const domainOrError = RegisteredService.create(
        {
          name: dto.name,
          apiKey,
          description: dto.description ?? null,
          isActive: true,
          voided: false,
          createdBy: actorId,
          updatedBy: actorId,
          createdAt: now,
          updatedAt: now,
        },
        new UniqueEntityID(),
      );
      if (domainOrError.isFailure) {
        return left(
          new BaseErrors.ValidationError(domainOrError.error.toString()),
        );
      }

      const saved = await this.serviceRepo.create(domainOrError.getValue());
      if (!saved) {
        return left(new BaseErrors.GenericError('Failed to register service'));
      }

      // The raw key is returned ONCE here; it is never read back via list.
      return right(
        Result.ok<RegisteredServiceSecretDTO>({
          id: saved,
          name: dto.name,
          apiKey,
        }),
      );
    } catch (err) {
      console.log(err);
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
