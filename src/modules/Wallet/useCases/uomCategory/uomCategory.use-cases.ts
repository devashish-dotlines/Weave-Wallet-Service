import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import { DateTimeObject } from '../../../Core/domain/dateTimeObject';
import { UomCategory } from '../../domain/uomCategory';
import { UomCategoryMap } from '../../mappers/uomCategoryMap';
import { UomCategoryDTO, UpdateUomCategoryDTO } from '../../DTO/uomCategoryDTO';
import { IUomCategoryRepo } from '../../repos/interface/IUomCategoryRepo';
import { IUomRepo } from '../../repos/interface/IUomRepo';
import { IUnitRegistry, ResolvedUnit } from '../../services/unitRegistry.service';
import { CurrencyCatalogUnavailableError } from '../../services/currencyCatalog.service';
import { WalletResponse } from '../shared/response';

export class ListUomCategoriesUseCase
  implements UseCase<void, Promise<WalletResponse<UomCategoryDTO[]>>>
{
  constructor(private readonly repo: IUomCategoryRepo) {}

  async execute(): Promise<WalletResponse<UomCategoryDTO[]>> {
    try {
      const items = await this.repo.list();
      return right(Result.ok<UomCategoryDTO[]>(items.map(UomCategoryMap.toDTO)));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

/**
 * Categories are seeded; admins tune name, valued, decimals, base unit and
 * active. Code and unit source never change — stored unit ids already point
 * into the table the source names.
 */
export class UpdateUomCategoryUseCase
  implements UseCase<UpdateUomCategoryDTO, Promise<WalletResponse<string>>>
{
  constructor(
    private readonly repo: IUomCategoryRepo,
    private readonly uomRepo: IUomRepo,
  ) {}

  async execute(dto: UpdateUomCategoryDTO): Promise<WalletResponse<string>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) return left(new BaseErrors.NotFoundError('Unit category not found'));

      let baseUomId = existing.baseUomId;
      if (dto.baseUomId !== undefined) {
        baseUomId = dto.baseUomId ?? undefined;
        if (baseUomId) {
          const base = await this.uomRepo.findById(baseUomId);
          if (!base || base.categoryId !== existing.id.toString()) {
            return left(
              new BaseErrors.ValidationError(
                `The base unit must be a unit of ${existing.code}`,
              ),
            );
          }
          if (base.factorToBase !== 1) {
            return left(
              new BaseErrors.ValidationError(
                `${base.code} has factor ${base.factorToBase}; a base unit's factor must be 1`,
              ),
            );
          }
        }
      }

      const now = DateTimeObject.create(-1).getValue();
      const rebuilt = UomCategory.create(
        {
          code: existing.code,
          unitSource: existing.unitSource,
          name: dto.name ?? existing.name,
          valued: dto.valued ?? existing.valued,
          decimals: dto.decimals === undefined ? existing.decimals : Number(dto.decimals),
          baseUomId,
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
      if (!saved) return left(new BaseErrors.GenericError('Failed to update unit category'));
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

/**
 * Every unit of a category, wherever it lives — accounting currencies for
 * CURRENCY, wallet UOMs otherwise. One list for every unit picker.
 */
export class ListUnitsUseCase
  implements UseCase<string, Promise<WalletResponse<ResolvedUnit[]>>>
{
  constructor(
    private readonly repo: IUomCategoryRepo,
    private readonly units: IUnitRegistry,
  ) {}

  async execute(categoryId: string): Promise<WalletResponse<ResolvedUnit[]>> {
    try {
      if (!categoryId) {
        return left(new BaseErrors.ValidationError('categoryId is required'));
      }
      if (!(await this.repo.findById(categoryId))) {
        return left(new BaseErrors.NotFoundError('Unit category not found'));
      }
      return right(Result.ok<ResolvedUnit[]>(await this.units.listUnits(categoryId)));
    } catch (err) {
      if (err instanceof CurrencyCatalogUnavailableError) {
        return left(
          new BaseErrors.BusinessRuleError(`Currencies unavailable: ${err.message}`),
        );
      }
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
