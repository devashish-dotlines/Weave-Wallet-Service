/**
 * Object storage seam. Cross-cutting infra wiring (same tier as infra/workflow),
 * so `core/` and the domain never learn where bytes physically live.
 *
 * Two drivers, chosen per installation by STORAGE_DRIVER: `local` disk for
 * single-host installs, `s3` for AWS/MinIO/Ceph. Callers depend only on
 * IObjectStorage — adding a third driver never touches a use case.
 */

export type StorageDriver = 'local' | 's3';

export interface PutObjectInput {
  /** Driver-relative key, e.g. `topup-requests/<reqId>/<attId>-slip.pdf`. */
  key: string;
  body: Buffer;
  contentType: string;
}

/** What the caller persists about a stored object (never the bytes). */
export interface StoredObjectRef {
  driver: StorageDriver;
  key: string;
  sizeBytes: number;
  contentType: string;
  /** Hex sha256 of the body — integrity + dedupe. */
  checksumSha256: string;
}

export interface ReadObjectResult {
  stream: NodeJS.ReadableStream;
  contentType: string;
  sizeBytes: number;
}

export interface IObjectStorage {
  readonly driver: StorageDriver;
  put(input: PutObjectInput): Promise<StoredObjectRef>;
  get(key: string): Promise<ReadObjectResult>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

/** Any storage-layer failure, so callers need not know driver-specific errors. */
export class ObjectStorageError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ObjectStorageError';
  }
}
