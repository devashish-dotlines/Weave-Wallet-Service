import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import { DateTimeObject } from '../../../Core/domain/dateTimeObject';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';
import { Uom } from '../../domain/uom';
import { UomMap } from '../../mappers/uomMap';
import { UomDTO, CreateUomDTO, UpdateUomDTO } from '../../DTO/uomDTO';
import { IUomRepo } from '../../repos/interface/IUomRepo';
import { WalletResponse } from '../shared/response';

export class CreateUomUseCase
  implements UseCase<CreateUomDTO, Promise<WalletResponse<string>>>
{
  constructor(private readonly repo: IUomRepo) {}

  async execute(dto: CreateUomDTO): Promise<WalletResponse<string>> {
    try {
      const code = (dto.code ?? '').trim().toUpperCase();
      const existing = await this.repo.findByCode(code);
      if (existing) {
        return left(
          new BaseErrors.AlreadyExistError(`UOM "${code}" already exists`),
        );
      }

      const now = DateTimeObject.create(-1).getValue();
      const orError = Uom.create({
        name: dto.name,
        code,
        symbol: dto.symbol,
        isActive: dto.isActive ?? true,
        createdBy: dto.requestedBy,
        updatedBy: dto.requestedBy,
        createdAt: now,
        updatedAt: now,
      });
      if (orError.isFailure) {
        return left(new BaseErrors.ValidationError(orError.error.toString()));
      }

      const saved = await this.repo.create(orError.getValue());
      if (!saved) {
        return left(new BaseErrors.GenericError('Failed to create UOM'));
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class UpdateUomUseCase
  implements UseCase<UpdateUomDTO, Promise<WalletResponse<string>>>
{
  constructor(private readonly repo: IUomRepo) {}

  async execute(dto: UpdateUomDTO): Promise<WalletResponse<string>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('UOM not found'));
      }

      const now = DateTimeObject.create(-1).getValue();
      const rebuilt = Uom.create(
        {
          name: dto.name ?? existing.name,
          code: existing.code,
          symbol: dto.symbol ?? existing.symbol,
          isActive: dto.isActive ?? existing.isActive,
          voided: existing.voided,
          createdBy: existing.createdBy,
          createdAt: existing.createdAt,
          updatedBy: dto.requestedBy,
          updatedAt: now,
          deletedBy: existing.deletedBy,
          deletedAt: existing.deletedAt,
        },
        existing.id,
      );
      if (rebuilt.isFailure) {
        return left(new BaseErrors.ValidationError(rebuilt.error.toString()));
      }

      const saved = await this.repo.update(rebuilt.getValue());
      if (!saved) {
        return left(new BaseErrors.GenericError('Failed to update UOM'));
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class DeleteUomUseCase
  implements UseCase<DeleteDTO, Promise<WalletResponse<void>>>
{
  constructor(private readonly repo: IUomRepo) {}

  async execute(dto: DeleteDTO): Promise<WalletResponse<void>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('UOM not found'));
      }
      const deleted = await this.repo.delete(dto);
      if (!deleted) {
        return left(new BaseErrors.GenericError('Failed to delete UOM'));
      }
      return right(Result.ok<void>());
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class ListUomUseCase
  implements UseCase<void, Promise<WalletResponse<UomDTO[]>>>
{
  constructor(private readonly repo: IUomRepo) {}

  async execute(): Promise<WalletResponse<UomDTO[]>> {
    try {
      const items = await this.repo.list();
      return right(Result.ok<UomDTO[]>(items.map(UomMap.toDTO)));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
