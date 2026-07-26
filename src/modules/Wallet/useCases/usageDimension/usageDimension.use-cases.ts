import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import { DateTimeObject } from '../../../Core/domain/dateTimeObject';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';
import { UsageDimension } from '../../domain/usageDimension';
import { UsageDimensionMap } from '../../mappers/usageDimensionMap';
import {
  CreateUsageDimensionDTO,
  UpdateUsageDimensionDTO,
  UsageDimensionDTO,
} from '../../DTO/usageDimensionDTO';
import { IUsageDimensionRepo } from '../../repos/interface/IUsageDimensionRepo';
import { WalletResponse } from '../shared/response';

export class CreateUsageDimensionUseCase
  implements UseCase<CreateUsageDimensionDTO, Promise<WalletResponse<string>>>
{
  constructor(private readonly repo: IUsageDimensionRepo) {}

  async execute(dto: CreateUsageDimensionDTO): Promise<WalletResponse<string>> {
    try {
      const key = (dto.key ?? '').trim().toLowerCase();
      const existing = await this.repo.findByKey(key);
      if (existing) {
        return left(
          new BaseErrors.AlreadyExistError(
            `Usage dimension "${key}" already exists`,
          ),
        );
      }

      const now = DateTimeObject.create(-1).getValue();
      const orError = UsageDimension.create({
        name: dto.name,
        key,
        description: dto.description,
        dataType: dto.dataType,
        minValue: dto.minValue ?? null,
        maxValue: dto.maxValue ?? null,
        allowedValues: dto.allowedValues ?? null,
        options: dto.options ?? [],
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
        return left(
          new BaseErrors.GenericError('Failed to create usage dimension'),
        );
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class UpdateUsageDimensionUseCase
  implements UseCase<UpdateUsageDimensionDTO, Promise<WalletResponse<string>>>
{
  constructor(private readonly repo: IUsageDimensionRepo) {}

  async execute(dto: UpdateUsageDimensionDTO): Promise<WalletResponse<string>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('Usage dimension not found'));
      }

      const now = DateTimeObject.create(-1).getValue();
      // Rebuild through create() so invariants re-run. KEY IS IMMUTABLE —
      // wallet restrictions are matched against usage contexts by key, so
      // renaming one would silently detach every rule that depends on it.
      const rebuilt = UsageDimension.create(
        {
          name: dto.name ?? existing.name,
          key: existing.key,
          description: dto.description ?? existing.description,
          dataType: dto.dataType ?? existing.dataType,
          minValue: dto.minValue === undefined ? existing.minValue : dto.minValue,
          maxValue: dto.maxValue === undefined ? existing.maxValue : dto.maxValue,
          allowedValues:
            dto.allowedValues === undefined
              ? existing.allowedValues
              : dto.allowedValues,
          // Absent ⇒ keep the current options; present replaces them wholesale.
          options: dto.options === undefined ? existing.options : dto.options,
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
        return left(
          new BaseErrors.GenericError('Failed to update usage dimension'),
        );
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class DeleteUsageDimensionUseCase
  implements UseCase<DeleteDTO, Promise<WalletResponse<void>>>
{
  constructor(private readonly repo: IUsageDimensionRepo) {}

  async execute(dto: DeleteDTO): Promise<WalletResponse<void>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('Usage dimension not found'));
      }

      // A dimension a wallet still restricts on cannot be deleted — doing so
      // would silently widen that wallet's spending.
      const inUse = await this.repo.countRestrictionsByDimension(dto.id);
      if (inUse > 0) {
        return left(
          new BaseErrors.BusinessRuleError(
            'This usage dimension is in use by one or more wallets and cannot be deleted',
          ),
        );
      }

      const deleted = await this.repo.delete(dto);
      if (!deleted) {
        return left(
          new BaseErrors.GenericError('Failed to delete usage dimension'),
        );
      }
      return right(Result.ok<void>());
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class ListUsageDimensionUseCase
  implements UseCase<void, Promise<WalletResponse<UsageDimensionDTO[]>>>
{
  constructor(private readonly repo: IUsageDimensionRepo) {}

  async execute(): Promise<WalletResponse<UsageDimensionDTO[]>> {
    try {
      const items = await this.repo.list();
      return right(
        Result.ok<UsageDimensionDTO[]>(items.map(UsageDimensionMap.toDTO)),
      );
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
