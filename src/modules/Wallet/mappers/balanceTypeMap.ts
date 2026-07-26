import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { BalanceType as BalanceTypeModel } from '../../../infra/sequelize/models/Wallet/balanceType';
import { BalanceType } from '../domain/balanceType';
import { BalanceTypeDTO } from '../DTO/balanceTypeDTO';

export class BalanceTypeMap extends Mapper<BalanceType> {
  public static async toPersistence(
    b: BalanceType,
  ): Promise<Partial<BalanceTypeModel>> {
    return {
      id: b.id.toString(),
      name: b.name,
      code: b.code,
      description: b.description ?? null,
      isActive: b.isActive,
      voided: b.voided ?? false,
      createdBy: b.createdBy,
      createdAt: b.createdAt ? b.createdAt.value : 0,
      updatedBy: b.updatedBy,
      updatedAt: b.updatedAt ? b.updatedAt.value : 0,
      deletedBy: b.deletedBy ?? null,
      deletedAt: b.deletedAt ? b.deletedAt.value : null,
      serverVersion: await new ServerVersion().getServerVersion(),
    };
  }

  /**
   * The tag list lives in `wlt_balance_type_uom`, so it arrives either as the
   * eager-loaded `allowedUoms` rows or as a pre-resolved id array. Untagged
   * (and pre-existing) rows read back as `[]` — unrestricted.
   */
  private static readAllowedUomIds(raw: any): string[] {
    if (Array.isArray(raw.allowedUomIds)) return raw.allowedUomIds;
    if (Array.isArray(raw.allowedUoms)) {
      return raw.allowedUoms
        .filter((link: any) => !link.voided)
        .map((link: any) => link.uomId);
    }
    return [];
  }

  public static toDomain(raw: any): BalanceType | null {
    if (!raw) return null;
    const domainOrError = BalanceType.create(
      {
        name: raw.name,
        code: raw.code,
        description: raw.description ?? undefined,
        isActive: raw.isActive,
        allowedUomIds: BalanceTypeMap.readAllowedUomIds(raw),
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(raw.createdAt, 'createdAt', 'BalanceType'),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(raw.updatedAt, 'updatedAt', 'BalanceType'),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log('BalanceTypeMap.toDomain failed:', domainOrError.error);
      return null;
    }
    return domainOrError.getValue();
  }

  public static toDTO(b: BalanceType): BalanceTypeDTO {
    return {
      id: b.id.toString(),
      name: b.name,
      code: b.code,
      description: b.description,
      isActive: b.isActive,
      allowedUomIds: b.allowedUomIds,
    };
  }
}
