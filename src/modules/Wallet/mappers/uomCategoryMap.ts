import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { UomCategory as UomCategoryModel } from '../../../infra/sequelize/models/Wallet/uomCategory';
import { UomCategory, UnitSource } from '../domain/uomCategory';
import { UomCategoryDTO } from '../DTO/uomCategoryDTO';

export class UomCategoryMap extends Mapper<UomCategory> {
  public static async toPersistence(
    c: UomCategory,
  ): Promise<Partial<UomCategoryModel>> {
    return {
      id: c.id.toString(),
      code: c.code,
      name: c.name,
      unitSource: c.unitSource,
      valued: c.valued,
      decimals: c.decimals,
      baseUomId: c.baseUomId ?? null,
      isActive: c.isActive,
      voided: c.voided ?? false,
      createdBy: c.createdBy,
      createdAt: c.createdAt ? c.createdAt.value : 0,
      updatedBy: c.updatedBy,
      updatedAt: c.updatedAt ? c.updatedAt.value : 0,
      deletedBy: c.deletedBy ?? null,
      deletedAt: c.deletedAt ? c.deletedAt.value : null,
      serverVersion: await new ServerVersion().getServerVersion(),
    };
  }

  public static toDomain(raw: any): UomCategory | null {
    if (!raw) return null;
    const domainOrError = UomCategory.create(
      {
        code: raw.code,
        name: raw.name,
        unitSource: raw.unitSource as UnitSource,
        valued: !!raw.valued,
        decimals: Number(raw.decimals),
        baseUomId: raw.baseUomId ?? undefined,
        isActive: raw.isActive,
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(raw.createdAt, 'createdAt', 'UomCategory'),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(raw.updatedAt, 'updatedAt', 'UomCategory'),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log('UomCategoryMap.toDomain failed:', domainOrError.error);
      return null;
    }
    return domainOrError.getValue();
  }

  public static toDTO(c: UomCategory): UomCategoryDTO {
    return {
      id: c.id.toString(),
      code: c.code,
      name: c.name,
      unitSource: c.unitSource,
      valued: c.valued,
      decimals: c.decimals,
      baseUomId: c.baseUomId,
      isActive: c.isActive,
    };
  }
}
