import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import { DateTimeObject } from '../../../Core/domain/dateTimeObject';
import {
  WalletUsageRestriction,
  isSingleValueOperator,
} from '../../domain/walletUsageRestriction';
import { WalletUsageRestrictionMap } from '../../mappers/walletUsageRestrictionMap';
import {
  SetWalletUsageRestrictionsDTO,
  WalletUsageRestrictionDTO,
} from '../../DTO/walletUsageRestrictionDTO';
import { IWalletRepo } from '../../repos/interface/IWalletRepo';
import { IUsageDimensionRepo } from '../../repos/interface/IUsageDimensionRepo';
import { IWalletUsageRestrictionRepo } from '../../repos/interface/IWalletUsageRestrictionRepo';
import { WalletResponse } from '../shared/response';

export class SetWalletUsageRestrictionsUseCase
  implements
    UseCase<SetWalletUsageRestrictionsDTO, Promise<WalletResponse<void>>>
{
  constructor(
    private readonly repo: IWalletUsageRestrictionRepo,
    private readonly walletRepo: IWalletRepo,
    private readonly dimensionRepo: IUsageDimensionRepo,
  ) {}

  async execute(
    dto: SetWalletUsageRestrictionsDTO,
  ): Promise<WalletResponse<void>> {
    try {
      if (!(await this.walletRepo.exists(dto.walletId))) {
        return left(new BaseErrors.NotFoundError('Wallet not found'));
      }

      const rows = dto.restrictions ?? [];
      const now = DateTimeObject.create(-1).getValue();
      const built: WalletUsageRestriction[] = [];
      const seen = new Set<string>();

      for (const row of rows) {
        const dimension = await this.dimensionRepo.findById(
          row.usageDimensionId,
        );
        if (!dimension) {
          return left(
            new BaseErrors.NotFoundError(
              `Usage dimension "${row.usageDimensionId}" not found`,
            ),
          );
        }
        if (!dimension.isActive) {
          return left(
            new BaseErrors.BusinessRuleError(
              `Usage dimension "${dimension.key}" is inactive`,
            ),
          );
        }

        const groupNo = row.groupNo ?? 0;
        // One rule per dimension per group — two would be ambiguous, and the
        // repo reconciles on exactly this key.
        const key = `${row.usageDimensionId}:${groupNo}`;
        if (seen.has(key)) {
          return left(
            new BaseErrors.AlreadyExistError(
              `Duplicate restriction for dimension "${dimension.key}"`,
            ),
          );
        }
        seen.add(key);

        const keys = (row.valueKeys ?? []).map((k) => (k ?? '').trim());

        // eq/neq compare one value; in/not_in compare a set.
        if (isSingleValueOperator(row.operator) && keys.length !== 1) {
          return left(
            new BaseErrors.ValidationError(
              `"${dimension.key}": ${row.operator} takes exactly one value`,
            ),
          );
        }

        // A CONSTRAINED dimension only accepts its own values; an OPEN one
        // accepts anything the operator typed on the wallet screen, subject to
        // its numeric bounds.
        const unknown = keys.find((k) => k && !dimension.permitsKey(k));
        if (unknown) {
          return left(
            new BaseErrors.NotFoundError(
              `"${unknown}" is not a value of usage dimension "${dimension.key}"`,
            ),
          );
        }
        const outOfBounds = keys.find((k) => k && !dimension.withinBounds(k));
        if (outOfBounds) {
          return left(
            new BaseErrors.ValidationError(
              `"${outOfBounds}" is outside the range allowed by "${dimension.key}"`,
            ),
          );
        }

        const orError = WalletUsageRestriction.create({
          walletId: dto.walletId,
          usageDimensionId: row.usageDimensionId,
          operator: row.operator,
          valueKeys: keys,
          groupNo,
          createdBy: dto.requestedBy,
          updatedBy: dto.requestedBy,
          createdAt: now,
          updatedAt: now,
        });
        if (orError.isFailure) {
          return left(new BaseErrors.ValidationError(orError.error.toString()));
        }
        built.push(orError.getValue());
      }

      await this.repo.replaceForWallet(dto.walletId, built, dto.requestedBy);
      return right(Result.ok<void>());
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class ListWalletUsageRestrictionsUseCase
  implements
    UseCase<string, Promise<WalletResponse<WalletUsageRestrictionDTO[]>>>
{
  constructor(
    private readonly repo: IWalletUsageRestrictionRepo,
    private readonly dimensionRepo: IUsageDimensionRepo,
  ) {}

  async execute(
    walletId: string,
  ): Promise<WalletResponse<WalletUsageRestrictionDTO[]>> {
    try {
      const items = await this.repo.listByWallet(walletId);
      // Resolve each dimension once so the panel gets key + name inline.
      const dimensions = await this.dimensionRepo.list();
      const byId = new Map(dimensions.map((d) => [d.id.toString(), d]));

      return right(
        Result.ok<WalletUsageRestrictionDTO[]>(
          items.map((r) => {
            const d = byId.get(r.usageDimensionId);
            return WalletUsageRestrictionMap.toDTO(
              r,
              d ? { key: d.key, name: d.name } : undefined,
            );
          }),
        ),
      );
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
