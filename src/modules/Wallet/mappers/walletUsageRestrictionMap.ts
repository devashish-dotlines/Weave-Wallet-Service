import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { WalletUsageRestriction as WalletUsageRestrictionModel } from '../../../infra/sequelize/models/Wallet/walletUsageRestriction';
import {
  WalletUsageRestriction,
  UsageOperator,
} from '../domain/walletUsageRestriction';
import { WalletUsageRestrictionDTO } from '../DTO/walletUsageRestrictionDTO';

/**
 * `value_keys` is a JSON array in a TEXT column. Parse defensively — a mapper
 * must never throw on stored data, or one malformed row takes down the whole
 * wallet read.
 */
function parseValueKeys(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

export class WalletUsageRestrictionMap extends Mapper<WalletUsageRestriction> {
  public static async toPersistence(
    r: WalletUsageRestriction,
  ): Promise<Partial<WalletUsageRestrictionModel>> {
    return {
      id: r.id.toString(),
      walletId: r.walletId,
      usageDimensionId: r.usageDimensionId,
      operator: r.operator,
      valueKeys: JSON.stringify(r.valueKeys),
      groupNo: r.groupNo,
      voided: r.voided ?? false,
      createdBy: r.createdBy,
      createdAt: r.createdAt ? r.createdAt.value : 0,
      updatedBy: r.updatedBy,
      updatedAt: r.updatedAt ? r.updatedAt.value : 0,
      deletedBy: r.deletedBy ?? null,
      deletedAt: r.deletedAt ? r.deletedAt.value : null,
      serverVersion: await new ServerVersion().getServerVersion(),
    };
  }

  public static toDomain(raw: any): WalletUsageRestriction | null {
    if (!raw) return null;
    const domainOrError = WalletUsageRestriction.create(
      {
        walletId: raw.walletId,
        usageDimensionId: raw.usageDimensionId,
        operator: raw.operator as UsageOperator,
        valueKeys: parseValueKeys(raw.valueKeys),
        groupNo: raw.groupNo ?? 0,
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(
          raw.createdAt,
          'createdAt',
          'WalletUsageRestriction',
        ),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(
          raw.updatedAt,
          'updatedAt',
          'WalletUsageRestriction',
        ),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log(
        'WalletUsageRestrictionMap.toDomain failed:',
        domainOrError.error,
      );
      return null;
    }
    return domainOrError.getValue();
  }

  /** `dimensionKey`/`dimensionName` come from the joined dimension, so the
   *  panel can render a restriction without an N+1. */
  public static toDTO(
    r: WalletUsageRestriction,
    dimension?: { key: string; name: string },
  ): WalletUsageRestrictionDTO {
    return {
      id: r.id.toString(),
      usageDimensionId: r.usageDimensionId,
      dimensionKey: dimension?.key,
      dimensionName: dimension?.name,
      operator: r.operator,
      valueKeys: r.valueKeys,
      groupNo: r.groupNo,
    };
  }
}
