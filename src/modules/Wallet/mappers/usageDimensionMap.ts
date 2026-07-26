import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { UsageDimension as UsageDimensionModel } from '../../../infra/sequelize/models/Wallet/usageDimension';
import {
  UsageDimension,
  UsageDataType,
  UsageDimensionOption,
} from '../domain/usageDimension';
import { UsageDimensionDTO } from '../DTO/usageDimensionDTO';

/**
 * `options` is a JSON array in a TEXT column. Parse defensively — a mapper must
 * never throw on stored data, or one malformed row takes down the whole list.
 */
function parseOptions(raw: unknown): UsageDimensionOption[] {
  if (Array.isArray(raw)) return raw as UsageDimensionOption[];
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((o: any) => o && typeof o === 'object')
      .map((o: any) => ({ key: String(o.key ?? ''), value: String(o.value ?? '') }))
      .filter((o: UsageDimensionOption) => o.key !== '');
  } catch {
    return [];
  }
}

/** DECIMAL columns come back as strings on some dialects. */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

export class UsageDimensionMap extends Mapper<UsageDimension> {
  public static async toPersistence(
    d: UsageDimension,
  ): Promise<Partial<UsageDimensionModel>> {
    return {
      id: d.id.toString(),
      name: d.name,
      key: d.key,
      description: d.description ?? null,
      dataType: d.dataType,
      minValue: d.minValue,
      maxValue: d.maxValue,
      allowedValues: d.allowedValues,
      options: d.options.length > 0 ? JSON.stringify(d.options) : null,
      isActive: d.isActive,
      voided: d.voided ?? false,
      createdBy: d.createdBy,
      createdAt: d.createdAt ? d.createdAt.value : 0,
      updatedBy: d.updatedBy,
      updatedAt: d.updatedAt ? d.updatedAt.value : 0,
      deletedBy: d.deletedBy ?? null,
      deletedAt: d.deletedAt ? d.deletedAt.value : null,
      serverVersion: await new ServerVersion().getServerVersion(),
    };
  }

  public static toDomain(raw: any): UsageDimension | null {
    if (!raw) return null;
    const domainOrError = UsageDimension.create(
      {
        name: raw.name,
        key: raw.key,
        description: raw.description ?? undefined,
        dataType: raw.dataType as UsageDataType,
        minValue: numOrNull(raw.minValue),
        maxValue: numOrNull(raw.maxValue),
        allowedValues: raw.allowedValues ?? null,
        options: parseOptions(raw.options),
        isActive: raw.isActive,
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(
          raw.createdAt,
          'createdAt',
          'UsageDimension',
        ),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(
          raw.updatedAt,
          'updatedAt',
          'UsageDimension',
        ),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log('UsageDimensionMap.toDomain failed:', domainOrError.error);
      return null;
    }
    return domainOrError.getValue();
  }

  public static toDTO(d: UsageDimension): UsageDimensionDTO {
    return {
      id: d.id.toString(),
      name: d.name,
      key: d.key,
      description: d.description,
      dataType: d.dataType,
      minValue: d.minValue,
      maxValue: d.maxValue,
      allowedValues: d.allowedValues,
      options: d.options,
      isActive: d.isActive,
    };
  }
}
