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
import { IUomCategoryRepo } from '../../repos/interface/IUomCategoryRepo';
import { IBalanceTypeRepo } from '../../repos/interface/IBalanceTypeRepo';
import { WalletResponse } from '../shared/response';

/**
 * A wallet UOM is a LOCAL unit (points, minutes, megabytes). Currencies are
 * not created here — they live in Accounting → Currencies.
 */
export class CreateUomUseCase
  implements UseCase<CreateUomDTO, Promise<WalletResponse<string>>>
{
  constructor(
    private readonly repo: IUomRepo,
    private readonly categoryRepo: IUomCategoryRepo,
  ) {}

  async execute(dto: CreateUomDTO): Promise<WalletResponse<string>> {
    try {
      const category = dto.categoryId
        ? await this.categoryRepo.findById(dto.categoryId)
        : null;
      if (!category || !category.isActive) {
        return left(new BaseErrors.NotFoundError('Unit category not found'));
      }
      if (!category.isLocal) {
        return left(
          new BaseErrors.ValidationError(
            `${category.code} units come from Accounting → Currencies, not from here`,
          ),
        );
      }

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
        categoryId: category.id.toString(),
        factorToBase: dto.factorToBase === undefined ? 1 : Number(dto.factorToBase),
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
          // Category is fixed; the factor may be corrected (it changes how
          // future same-category conversions compute, never stored balances).
          categoryId: existing.categoryId,
          factorToBase:
            dto.factorToBase === undefined
              ? existing.factorToBase
              : Number(dto.factorToBase),
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
  constructor(
    private readonly repo: IUomRepo,
    private readonly balanceTypeRepo: IBalanceTypeRepo,
    private readonly categoryRepo: IUomCategoryRepo,
  ) {}

  async execute(dto: DeleteDTO): Promise<WalletResponse<void>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('UOM not found'));
      }
      // A unit in use can't disappear from under a balance, a balance type,
      // a rate or its category's base.
      const [usage, balanceTypes, category] = await Promise.all([
        this.repo.countUsage(dto.id),
        this.balanceTypeRepo.countByUnit(dto.id),
        this.categoryRepo.findById(existing.categoryId),
      ]);
      const blockers: string[] = [];
      if (usage.wallets) blockers.push(`${usage.wallets} wallet(s)`);
      if (balanceTypes) blockers.push(`${balanceTypes} balance type(s)`);
      if (usage.rates) blockers.push(`${usage.rates} conversion rate(s)`);
      if (category?.baseUomId === dto.id) blockers.push(`the ${category.code} category (base unit)`);
      if (blockers.length > 0) {
        return left(
          new BaseErrors.ConflictError(
            `${existing.code} is still used by ${blockers.join(', ')}`,
          ),
        );
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
