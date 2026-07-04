import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { OwnerType as OwnerTypeModel } from '../../../infra/sequelize/models/Wallet/ownerType';
import { OwnerType } from '../domain/ownerType';
import { OwnerTypeDTO } from '../DTO/ownerTypeDTO';

export class OwnerTypeMap extends Mapper<OwnerType> {
  public static async toPersistence(
    o: OwnerType,
  ): Promise<Partial<OwnerTypeModel>> {
    return {
      id: o.id.toString(),
      name: o.name,
      code: o.code,
      description: o.description ?? null,
      isActive: o.isActive,
      voided: o.voided ?? false,
      createdBy: o.createdBy,
      createdAt: o.createdAt ? o.createdAt.value : 0,
      updatedBy: o.updatedBy,
      updatedAt: o.updatedAt ? o.updatedAt.value : 0,
      deletedBy: o.deletedBy ?? null,
      deletedAt: o.deletedAt ? o.deletedAt.value : null,
      serverVersion: await new ServerVersion().getServerVersion(),
    };
  }

  public static toDomain(raw: any): OwnerType | null {
    if (!raw) return null;
    const domainOrError = OwnerType.create(
      {
        name: raw.name,
        code: raw.code,
        description: raw.description ?? undefined,
        isActive: raw.isActive,
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(raw.createdAt, 'createdAt', 'OwnerType'),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(raw.updatedAt, 'updatedAt', 'OwnerType'),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log('OwnerTypeMap.toDomain failed:', domainOrError.error);
      return null;
    }
    return domainOrError.getValue();
  }

  public static toDTO(o: OwnerType): OwnerTypeDTO {
    return {
      id: o.id.toString(),
      name: o.name,
      code: o.code,
      description: o.description,
      isActive: o.isActive,
    };
  }
}
