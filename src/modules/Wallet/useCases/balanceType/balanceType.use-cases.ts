import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import { DateTimeObject } from '../../../Core/domain/dateTimeObject';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';
import { BalanceType } from '../../domain/balanceType';
import { BalanceTypeMap } from '../../mappers/balanceTypeMap';
import {
  BalanceTypeDTO,
  CreateBalanceTypeDTO,
  UpdateBalanceTypeDTO,
} from '../../DTO/balanceTypeDTO';
import { IBalanceTypeRepo } from '../../repos/interface/IBalanceTypeRepo';
import { IUomCategoryRepo } from '../../repos/interface/IUomCategoryRepo';
import { IUnitRegistry } from '../../services/unitRegistry.service';
import { CurrencyCatalogUnavailableError } from '../../services/currencyCatalog.service';
import { WalletResponse } from '../shared/response';

/**
 * Every allowed unit must be a live unit OF THE BALANCE TYPE'S CATEGORY — a
 * currency for CURRENCY, a wlt_uom of that category otherwise. Returns the
 * first offending id, or null when the whole list checks out.
 */
async function findForeignUnit(
  registry: IUnitRegistry,
  categoryId: string,
  unitIds: string[],
): Promise<string | null> {
  for (const unitId of unitIds) {
    if (!(await registry.resolve({ categoryId, unitId }))) return unitId;
  }
  return null;
}

/** Accounting down while checking currency units: a clear error, not a 500. */
function catalogError(err: unknown): BaseErrors.AllErrors | null {
  return err instanceof CurrencyCatalogUnavailableError
    ? new BaseErrors.BusinessRuleError(
        `Can't check currency units right now: ${err.message}`,
      )
    : null;
}

export class CreateBalanceTypeUseCase
  implements UseCase<CreateBalanceTypeDTO, Promise<WalletResponse<string>>>
{
  constructor(
    private readonly repo: IBalanceTypeRepo,
    private readonly categoryRepo: IUomCategoryRepo,
    private readonly units: IUnitRegistry,
  ) {}

  async execute(dto: CreateBalanceTypeDTO): Promise<WalletResponse<string>> {
    try {
      const code = (dto.code ?? '').trim().toUpperCase();
      const existing = await this.repo.findByCode(code);
      if (existing) {
        return left(
          new BaseErrors.AlreadyExistError(
            `Balance type "${code}" already exists`,
          ),
        );
      }

      const category = dto.categoryId
        ? await this.categoryRepo.findById(dto.categoryId)
        : null;
      if (!category || !category.isActive) {
        return left(new BaseErrors.NotFoundError('Unit category not found'));
      }

      const allowedUnitIds = [...new Set(dto.allowedUnitIds ?? [])];
      const foreign = await findForeignUnit(
        this.units,
        category.id.toString(),
        allowedUnitIds,
      );
      if (foreign) {
        return left(
          new BaseErrors.ValidationError(
            `Unit "${foreign}" is not a ${category.code} unit`,
          ),
        );
      }

      const now = DateTimeObject.create(-1).getValue();
      const orError = BalanceType.create({
        name: dto.name,
        code,
        description: dto.description,
        isActive: dto.isActive ?? true,
        categoryId: category.id.toString(),
        allowedUnitIds,
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
        return left(new BaseErrors.GenericError('Failed to create balance type'));
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(catalogError(err) ?? new GenericAppError.UnexpectedError(err));
    }
  }
}

export class UpdateBalanceTypeUseCase
  implements UseCase<UpdateBalanceTypeDTO, Promise<WalletResponse<string>>>
{
  constructor(
    private readonly repo: IBalanceTypeRepo,
    private readonly units: IUnitRegistry,
  ) {}

  async execute(dto: UpdateBalanceTypeDTO): Promise<WalletResponse<string>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('Balance type not found'));
      }

      // Absent field ⇒ keep the current list; a present array replaces it
      // wholesale (`[]` = any unit of the category). The category never
      // changes: wallets already hold units of it.
      const allowedUnitIds =
        dto.allowedUnitIds === undefined
          ? existing.allowedUnitIds
          : [...new Set(dto.allowedUnitIds)];
      const foreign = await findForeignUnit(
        this.units,
        existing.categoryId,
        allowedUnitIds,
      );
      if (foreign) {
        return left(
          new BaseErrors.ValidationError(
            `Unit "${foreign}" is not a unit of this balance type's category`,
          ),
        );
      }

      const now = DateTimeObject.create(-1).getValue();
      // Rebuild through create() so invariants re-run. Code is immutable;
      // identity + creation audit are preserved.
      const rebuilt = BalanceType.create(
        {
          name: dto.name ?? existing.name,
          code: existing.code,
          description: dto.description ?? existing.description,
          isActive: dto.isActive ?? existing.isActive,
          categoryId: existing.categoryId,
          allowedUnitIds,
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
        return left(new BaseErrors.GenericError('Failed to update balance type'));
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(catalogError(err) ?? new GenericAppError.UnexpectedError(err));
    }
  }
}

export class DeleteBalanceTypeUseCase
  implements UseCase<DeleteDTO, Promise<WalletResponse<void>>>
{
  constructor(private readonly repo: IBalanceTypeRepo) {}

  async execute(dto: DeleteDTO): Promise<WalletResponse<void>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('Balance type not found'));
      }

      // A balance type backing a live wallet type cannot be deleted — doing so
      // would strand every wallet created against that type.
      const inUse = await this.repo.countWalletTypesByBalanceType(dto.id);
      if (inUse > 0) {
        return left(
          new BaseErrors.BusinessRuleError(
            'This balance type is in use by one or more wallet types and cannot be deleted',
          ),
        );
      }

      const deleted = await this.repo.delete(dto);
      if (!deleted) {
        return left(new BaseErrors.GenericError('Failed to delete balance type'));
      }
      return right(Result.ok<void>());
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class ListBalanceTypeUseCase
  implements UseCase<void, Promise<WalletResponse<BalanceTypeDTO[]>>>
{
  constructor(private readonly repo: IBalanceTypeRepo) {}

  async execute(): Promise<WalletResponse<BalanceTypeDTO[]>> {
    try {
      const items = await this.repo.list();
      return right(
        Result.ok<BalanceTypeDTO[]>(items.map(BalanceTypeMap.toDTO)),
      );
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
