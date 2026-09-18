import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

export type AttachmentStorageDriver = 'local' | 's3';
export const ATTACHMENT_STORAGE_DRIVERS: AttachmentStorageDriver[] = ['local', 's3'];

export interface TopupRequestAttachmentProps extends BaseEntityProps {
  topupRequestId: string;
  /** Sanitized original name (see core/utils/fileValidation.sanitizeFilename). */
  originalFilename: string;
  storageDriver: AttachmentStorageDriver;
  /** Driver-relative key: `topup-requests/<requestId>/<attachmentId>-<name>`. */
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
}

/**
 * Metadata for one uploaded proof (deposit slip) of a top-up request. The bytes
 * live in object storage; this row is the only way to reach them.
 */
export class TopupRequestAttachment extends AuditableEntity<TopupRequestAttachmentProps> {
  get id(): UniqueEntityID {
    return this._id;
  }
  get topupRequestId(): string {
    return this.props.topupRequestId;
  }
  get originalFilename(): string {
    return this.props.originalFilename;
  }
  get storageDriver(): AttachmentStorageDriver {
    return this.props.storageDriver;
  }
  get storageKey(): string {
    return this.props.storageKey;
  }
  get contentType(): string {
    return this.props.contentType;
  }
  get sizeBytes(): number {
    return this.props.sizeBytes;
  }
  get checksumSha256(): string {
    return this.props.checksumSha256;
  }

  private constructor(props: TopupRequestAttachmentProps, id?: UniqueEntityID) {
    super(props, id);
  }

  public static create(
    props: TopupRequestAttachmentProps,
    id?: UniqueEntityID,
  ): Result<TopupRequestAttachment> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.topupRequestId, argumentName: 'topupRequestId' },
      { argument: props.originalFilename, argumentName: 'originalFilename' },
      { argument: props.storageKey, argumentName: 'storageKey' },
      { argument: props.contentType, argumentName: 'contentType' },
      { argument: props.checksumSha256, argumentName: 'checksumSha256' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<TopupRequestAttachment>(guard.message);

    const driverOk = Guard.isOneOf(
      props.storageDriver,
      ATTACHMENT_STORAGE_DRIVERS,
      'storageDriver',
    );
    if (!driverOk.succeeded) return Result.fail<TopupRequestAttachment>(driverOk.message);

    if (!Number.isInteger(props.sizeBytes) || props.sizeBytes <= 0) {
      return Result.fail<TopupRequestAttachment>('sizeBytes must be a positive integer');
    }
    // Keys are built by the use case, but reject traversal here too so a bug
    // there can't point a row outside the request's prefix.
    if (
      props.storageKey.includes('..') ||
      !props.storageKey.startsWith(`topup-requests/${props.topupRequestId}/`)
    ) {
      return Result.fail<TopupRequestAttachment>('storageKey is not under the request prefix');
    }

    return Result.ok<TopupRequestAttachment>(new TopupRequestAttachment({ ...props }, id));
  }
}
