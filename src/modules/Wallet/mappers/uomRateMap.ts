import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { UomRate as UomRateModel } from '../../../infra/sequelize/models/Wallet/uomRate';
import { UomRate } from '../domain/uomRate';
import { UomRateDTO } from '../DTO/uomRateDTO';

export class UomRateMap extends Mapper<UomRate> {
  public static async toPersistence(r: UomRate): Promise<Partial<UomRateModel>> {
    return {
      id: r.id.toString(),
      uomId: r.uomId,
      baseValue: r.baseValue,
      effectiveFrom: r.effectiveFrom.value,
      effectiveTo: r.effectiveTo ? r.effectiveTo.value : null,
      note: r.note ?? null,
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

  public static toDomain(raw: any): UomRate | null {
    if (!raw) return null;
    const domainOrError = UomRate.create(
      {
        uomId: raw.uomId,
        baseValue: Number(raw.baseValue),
        effectiveFrom: Mapper.toDateRequired(
          Number(raw.effectiveFrom),
          'effectiveFrom',
          'UomRate',
        ),
        effectiveTo: Mapper.toDateOptional(raw.effectiveTo),
        note: raw.note ?? undefined,
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(raw.createdAt, 'createdAt', 'UomRate'),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(raw.updatedAt, 'updatedAt', 'UomRate'),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log('UomRateMap.toDomain failed:', domainOrError.error);
      return null;
    }
    return domainOrError.getValue();
  }

  public static toDTO(r: UomRate, uomCode?: string): UomRateDTO {
    return {
      id: r.id.toString(),
      uomId: r.uomId,
      uomCode,
      baseValue: r.baseValue,
      effectiveFrom: r.effectiveFrom.value,
      effectiveTo: r.effectiveTo?.value,
      note: r.note,
      createdAt: r.createdAt ? r.createdAt.value : 0,
      createdBy: r.createdBy,
    };
  }
}
