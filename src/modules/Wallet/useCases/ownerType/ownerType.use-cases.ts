import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import { DateTimeObject } from '../../../Core/domain/dateTimeObject';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';
import { OwnerType } from '../../domain/ownerType';
import { OwnerTypeMap } from '../../mappers/ownerTypeMap';
import {
  OwnerTypeDTO,
  CreateOwnerTypeDTO,
  UpdateOwnerTypeDTO,
} from '../../DTO/ownerTypeDTO';
import { IOwnerTypeRepo } from '../../repos/interface/IOwnerTypeRepo';
import { WalletResponse } from '../shared/response';

export class CreateOwnerTypeUseCase
  implements UseCase<CreateOwnerTypeDTO, Promise<WalletResponse<string>>>
{
  constructor(private readonly repo: IOwnerTypeRepo) {}

  async execute(dto: CreateOwnerTypeDTO): Promise<WalletResponse<string>> {
    try {
      const code = (dto.code ?? '').trim().toUpperCase();
      const existing = await this.repo.findByCode(code);
      if (existing) {
        return left(
          new BaseErrors.AlreadyExistError(
            `Owner type "${code}" already exists`,
          ),
        );
      }

      const now = DateTimeObject.create(-1).getValue();
      const orError = OwnerType.create({
        name: dto.name,
        code,
        description: dto.description,
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
        return left(new BaseErrors.GenericError('Failed to create owner type'));
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class UpdateOwnerTypeUseCase
  implements UseCase<UpdateOwnerTypeDTO, Promise<WalletResponse<string>>>
{
  constructor(private readonly repo: IOwnerTypeRepo) {}

  async execute(dto: UpdateOwnerTypeDTO): Promise<WalletResponse<string>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('Owner type not found'));
      }

      const now = DateTimeObject.create(-1).getValue();
      const rebuilt = OwnerType.create(
        {
          name: dto.name ?? existing.name,
          code: existing.code,
          description: dto.description ?? existing.description,
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
        return left(new BaseErrors.GenericError('Failed to update owner type'));
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class DeleteOwnerTypeUseCase
  implements UseCase<DeleteDTO, Promise<WalletResponse<void>>>
{
  constructor(private readonly repo: IOwnerTypeRepo) {}

  async execute(dto: DeleteDTO): Promise<WalletResponse<void>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('Owner type not found'));
      }

      const inUse = await this.repo.countWalletsByOwnerType(dto.id);
      if (inUse > 0) {
        return left(
          new BaseErrors.BusinessRuleError(
            'This owner type is in use by one or more wallets and cannot be deleted',
          ),
        );
      }

      const deleted = await this.repo.delete(dto);
      if (!deleted) {
        return left(new BaseErrors.GenericError('Failed to delete owner type'));
      }
      return right(Result.ok<void>());
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class ListOwnerTypeUseCase
  implements UseCase<void, Promise<WalletResponse<OwnerTypeDTO[]>>>
{
  constructor(private readonly repo: IOwnerTypeRepo) {}

  async execute(): Promise<WalletResponse<OwnerTypeDTO[]>> {
    try {
      const items = await this.repo.list();
      return right(Result.ok<OwnerTypeDTO[]>(items.map(OwnerTypeMap.toDTO)));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
