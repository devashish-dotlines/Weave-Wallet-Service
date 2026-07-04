import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { Uom as UomModel } from '../../../infra/sequelize/models/Wallet/uom';
import { Uom } from '../domain/uom';
import { UomDTO } from '../DTO/uomDTO';

export class UomMap extends Mapper<Uom> {
  public static async toPersistence(u: Uom): Promise<Partial<UomModel>> {
    return {
      id: u.id.toString(),
      name: u.name,
      code: u.code,
      symbol: u.symbol ?? null,
      isActive: u.isActive,
      voided: u.voided ?? false,
      createdBy: u.createdBy,
      createdAt: u.createdAt ? u.createdAt.value : 0,
      updatedBy: u.updatedBy,
      updatedAt: u.updatedAt ? u.updatedAt.value : 0,
      deletedBy: u.deletedBy ?? null,
      deletedAt: u.deletedAt ? u.deletedAt.value : null,
      serverVersion: await new ServerVersion().getServerVersion(),
    };
  }

  public static toDomain(raw: any): Uom | null {
    if (!raw) return null;
    const domainOrError = Uom.create(
      {
        name: raw.name,
        code: raw.code,
        symbol: raw.symbol ?? undefined,
        isActive: raw.isActive,
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(raw.createdAt, 'createdAt', 'Uom'),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(raw.updatedAt, 'updatedAt', 'Uom'),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log('UomMap.toDomain failed:', domainOrError.error);
      return null;
    }
    return domainOrError.getValue();
  }

  public static toDTO(u: Uom): UomDTO {
    return {
      id: u.id.toString(),
      name: u.name,
      code: u.code,
      symbol: u.symbol,
      isActive: u.isActive,
    };
  }
}
