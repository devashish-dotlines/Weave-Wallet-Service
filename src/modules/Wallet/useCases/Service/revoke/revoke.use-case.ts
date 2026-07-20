import { UseCase } from '../../../../../core/domain/UseCase';
import { Either, Result, left, right } from '../../../../../core/logic/Result';
import { GenericAppError } from '../../../../../core/logic/AppError';
import { BaseErrors } from '../../../../../core/infra/BaseErrors';
import { DateTimeObject } from '../../../../Core/domain/dateTimeObject';

import { RevokeServiceDTO } from '../../../DTO/registeredServiceDTO';
import { IRegisteredServiceRepo } from '../../../repos/interface/IRegisteredServiceRepo';

type Response = Either<
  BaseErrors.NotFoundError | GenericAppError.UnexpectedError,
  Result<string>
>;

/**
 * Revoke a service's key by deactivating it. `findByApiKey` filters on
 * `isActive`, so the key stops resolving immediately — no secret rotation.
 */
export default class RevokeServiceUseCase
  implements UseCase<RevokeServiceDTO, Promise<Response>>
{
  constructor(private readonly serviceRepo: IRegisteredServiceRepo) {}

  async execute(dto: RevokeServiceDTO): Promise<Response> {
    try {
      const service = await this.serviceRepo.findById(dto.id);
      if (!service) {
        return left(
          new BaseErrors.NotFoundError(
            `RegisteredService '${dto.id}' not found`,
          ),
        );
      }

      service.isActive = false;
      service.updatedAt = DateTimeObject.create(-1).getValue();
      const saved = await this.serviceRepo.update(service);
      if (!saved) {
        return left(
          new GenericAppError.UnexpectedError('Failed to revoke service'),
        );
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      console.log(err);
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
