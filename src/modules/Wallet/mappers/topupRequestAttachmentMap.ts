import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { TopupRequestAttachment as TopupRequestAttachmentModel } from '../../../infra/sequelize/models/Wallet/topupRequestAttachment';
import {
  TopupRequestAttachment,
  AttachmentStorageDriver,
} from '../domain/topupRequestAttachment';
import { TopupRequestAttachmentDTO } from '../DTO/topupRequestDTO';

export class TopupRequestAttachmentMap extends Mapper<TopupRequestAttachment> {
  public static async toPersistence(
    a: TopupRequestAttachment,
  ): Promise<Partial<TopupRequestAttachmentModel>> {
    return {
      id: a.id.toString(),
      topupRequestId: a.topupRequestId,
      originalFilename: a.originalFilename,
      storageDriver: a.storageDriver,
      storageKey: a.storageKey,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
      checksumSha256: a.checksumSha256,
      voided: a.voided ?? false,
      createdBy: a.createdBy,
      createdAt: a.createdAt ? a.createdAt.value : 0,
      updatedBy: a.updatedBy,
      updatedAt: a.updatedAt ? a.updatedAt.value : 0,
      deletedBy: a.deletedBy ?? null,
      deletedAt: a.deletedAt ? a.deletedAt.value : null,
      serverVersion: await new ServerVersion().getServerVersion(),
    };
  }

  public static toDomain(raw: any): TopupRequestAttachment | null {
    if (!raw) return null;
    const domainOrError = TopupRequestAttachment.create(
      {
        topupRequestId: raw.topupRequestId,
        originalFilename: raw.originalFilename,
        storageDriver: raw.storageDriver as AttachmentStorageDriver,
        storageKey: raw.storageKey,
        contentType: raw.contentType,
        sizeBytes: Number(raw.sizeBytes),
        checksumSha256: raw.checksumSha256,
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(raw.createdAt, 'createdAt', 'TopupRequestAttachment'),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(raw.updatedAt, 'updatedAt', 'TopupRequestAttachment'),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log('TopupRequestAttachmentMap.toDomain failed:', domainOrError.error);
      return null;
    }
    return domainOrError.getValue();
  }

  /** Never exposes the storage driver/key — downloads go through the API. */
  public static toDTO(a: TopupRequestAttachment): TopupRequestAttachmentDTO {
    return {
      id: a.id.toString(),
      topupRequestId: a.topupRequestId,
      originalFilename: a.originalFilename,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
      checksumSha256: a.checksumSha256,
      createdAt: a.createdAt ? a.createdAt.value : 0,
      createdBy: a.createdBy,
    };
  }
}
