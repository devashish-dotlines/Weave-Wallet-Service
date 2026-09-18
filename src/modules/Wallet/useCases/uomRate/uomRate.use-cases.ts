import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import { DateTimeObject } from '../../../Core/domain/dateTimeObject';
import { UomRate } from '../../domain/uomRate';
import { UomRateMap } from '../../mappers/uomRateMap';
import {
  UomRateDTO,
  CreateUomRateDTO,
  ListUomRatesDTO,
} from '../../DTO/uomRateDTO';
import { IUomRateRepo } from '../../repos/interface/IUomRateRepo';
import { IUomRepo } from '../../repos/interface/IUomRepo';
import { WalletResponse } from '../shared/response';
import { IUomCategoryRepo } from '../../repos/interface/IUomCategoryRepo';

function unexpected(err: unknown): BaseErrors.AllErrors {
  return new GenericAppError.UnexpectedError(err) as unknown as BaseErrors.AllErrors;
}

function now(): DateTimeObject {
  return DateTimeObject.create(-1).getValue();
}

/**
 * What one unit of a wallet UOM is worth in the accounting base currency.
 * Rates are appended, never edited: an existing top-up request keeps the rate
 * it stored, and the history stays readable.
 */
export class ListUomRatesUseCase
  implements UseCase<ListUomRatesDTO, Promise<WalletResponse<UomRateDTO[]>>>
{
  constructor(
    private readonly repo: IUomRateRepo,
    private readonly uomRepo: IUomRepo,
  ) {}

  async execute(dto: ListUomRatesDTO): Promise<WalletResponse<UomRateDTO[]>> {
    try {
      const rates = await this.repo.list(dto.uomId);
      const uoms = await this.uomRepo.list();
      const codeById = new Map(uoms.map((u) => [u.id.toString(), u.code]));
      return right(
        Result.ok<UomRateDTO[]>(
          rates.map((r) => UomRateMap.toDTO(r, codeById.get(r.uomId))),
        ),
      );
    } catch (err) {
      return left(unexpected(err));
    }
  }
}

export class CreateUomRateUseCase
  implements UseCase<CreateUomRateDTO, Promise<WalletResponse<UomRateDTO>>>
{
  constructor(
    private readonly repo: IUomRateRepo,
    private readonly uomRepo: IUomRepo,
    private readonly categoryRepo: IUomCategoryRepo,
  ) {}

  async execute(dto: CreateUomRateDTO): Promise<WalletResponse<UomRateDTO>> {
    try {
      const uom = await this.uomRepo.findById(dto.uomId);
      if (!uom) return left(new BaseErrors.NotFoundError('UOM not found'));

      // Only a LOCAL, valued unit takes a rate here. Currencies aren't wallet
      // UOMs at all (they're priced in Accounting → Currencies), and TIME/DATA
      // units are quantity-only.
      const category = await this.categoryRepo.findById(uom.categoryId);
      if (!category || !category.isLocal) {
        return left(new BaseErrors.ValidationError(`${uom.code} can't have a rate`));
      }
      if (!category.valued) {
        return left(
          new BaseErrors.ValidationError(
            `${uom.code} is a quantity-only unit (${category.code}); it has no money value`,
          ),
        );
      }

      const at = now();
      const effectiveFromOrError = DateTimeObject.create(
        dto.effectiveFrom ?? at.value,
      );
      if (effectiveFromOrError.isFailure) {
        return left(new BaseErrors.ValidationError('effectiveFrom is invalid'));
      }
      const effectiveFrom = effectiveFromOrError.getValue();

      let effectiveTo: DateTimeObject | undefined;
      if (dto.effectiveTo !== undefined && dto.effectiveTo !== null) {
        const toOrError = DateTimeObject.create(Number(dto.effectiveTo));
        if (toOrError.isFailure) {
          return left(new BaseErrors.ValidationError('effectiveTo is invalid'));
        }
        effectiveTo = toOrError.getValue();
        if (effectiveTo.value < effectiveFrom.value) {
          return left(
            new BaseErrors.ValidationError('effectiveTo cannot be before effectiveFrom'),
          );
        }
      }

      // Exactly one rate may apply at any moment, so an overlap is either
      // closed off (the usual "new rate from Monday") or refused outright.
      const overlaps = await this.repo.findOverlapping(
        dto.uomId,
        effectiveFrom.value,
        effectiveTo?.value ?? null,
      );
      if (overlaps.length > 0) {
        const closeCurrent = dto.closeCurrent !== false;
        const closable = overlaps.filter(
          (o) =>
            !o.effectiveTo && o.effectiveFrom.value < effectiveFrom.value,
        );
        if (!closeCurrent || closable.length !== overlaps.length) {
          const clash = overlaps[0];
          return left(
            new BaseErrors.ConflictError(
              `A rate for ${uom.code} already covers that period (from ${clash.effectiveFrom.value}${
                clash.effectiveTo ? ` to ${clash.effectiveTo.value}` : ' onwards'
              })`,
            ),
          );
        }
        for (const open of closable) {
          const endsAt = DateTimeObject.create(effectiveFrom.value - 1);
          if (endsAt.isFailure) {
            return left(new BaseErrors.ValidationError('effectiveFrom is invalid'));
          }
          const closed = open.closeAt(endsAt.getValue(), dto.requestedBy, at);
          if (closed.isFailure) {
            return left(new BaseErrors.BusinessRuleError(String(closed.error)));
          }
          await this.repo.updateEffectiveTo(open);
        }
      }

      const rateOrError = UomRate.create({
        uomId: dto.uomId,
        baseValue: Number(dto.baseValue),
        effectiveFrom,
        effectiveTo,
        note: dto.note?.trim() || undefined,
        createdBy: dto.requestedBy,
        updatedBy: dto.requestedBy,
        createdAt: at,
        updatedAt: at,
      });
      if (rateOrError.isFailure) {
        return left(new BaseErrors.ValidationError(String(rateOrError.error)));
      }
      const rate = rateOrError.getValue();
      await this.repo.create(rate);
      return right(Result.ok<UomRateDTO>(UomRateMap.toDTO(rate, uom.code)));
    } catch (err) {
      return left(unexpected(err));
    }
  }
}
