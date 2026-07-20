import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { RegisteredService } from '../domain/registeredService';
import { RegisteredService as RegisteredServiceModel } from '../../../infra/sequelize/models/Wallet/registeredService';

export class RegisteredServiceMap extends Mapper<RegisteredService> {
  public static async toPersistence(
    entity: RegisteredService,
  ): Promise<Partial<RegisteredServiceModel>> {
    return {
      id: entity.id.toString(),
      name: entity.name,
      apiKey: entity.apiKey,
      description: entity.description ?? null,
      isActive: entity.isActive,
      voided: entity.voided ?? false,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt ? entity.createdAt.value : null!,
      updatedBy: entity.updatedBy,
      updatedAt: entity.updatedAt ? entity.updatedAt.value : null!,
      deletedBy: entity.deletedBy,
      deletedAt: entity.deletedAt ? entity.deletedAt.value : null!,
      serverVersion: await new ServerVersion().getServerVersion(),
    };
  }

  public static async toDomain(raw: any): Promise<RegisteredService | null> {
    if (!raw) return null;
    const domainOrError = RegisteredService.create(
      {
        name: raw.name,
        apiKey: raw.apiKey ?? raw.api_key,
        description: raw.description ?? null,
        isActive: raw.isActive ?? raw.is_active,
        voided: raw.voided,
        serverVersion: raw.serverVersion ?? raw.server_version,
        createdBy: raw.createdBy ?? raw.created_by,
        createdAt: Mapper.toDateRequired(
          raw.createdAt ?? raw.created_at,
          'createdAt',
          'RegisteredService',
        ),
        updatedBy: raw.updatedBy ?? raw.updated_by,
        updatedAt: Mapper.toDateRequired(
          raw.updatedAt ?? raw.updated_at,
          'updatedAt',
          'RegisteredService',
        ),
        deletedBy: raw.deletedBy ?? raw.deleted_by ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt ?? raw.deleted_at),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) console.log(domainOrError.error);
    return domainOrError.isSuccess ? domainOrError.getValue() : null;
  }
}
