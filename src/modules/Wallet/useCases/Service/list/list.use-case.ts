import { UseCase } from '../../../../../core/domain/UseCase';
import { Either, Result, left, right } from '../../../../../core/logic/Result';
import { GenericAppError } from '../../../../../core/logic/AppError';

import { RegisteredServiceResponseDTO } from '../../../DTO/registeredServiceDTO';
import { IRegisteredServiceRepo } from '../../../repos/interface/IRegisteredServiceRepo';

type Response = Either<
  GenericAppError.UnexpectedError,
  Result<RegisteredServiceResponseDTO[]>
>;

export default class ListServicesUseCase
  implements UseCase<void, Promise<Response>>
{
  constructor(private readonly serviceRepo: IRegisteredServiceRepo) {}

  async execute(): Promise<Response> {
    try {
      const services = await this.serviceRepo.list();
      // Never expose the key in the catalog view.
      const dto: RegisteredServiceResponseDTO[] = services.map((s) => ({
        id: s.id.toString(),
        name: s.name,
        description: s.description ?? null,
        isActive: s.isActive,
      }));
      return right(Result.ok<RegisteredServiceResponseDTO[]>(dto));
    } catch (err) {
      console.log(err);
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
