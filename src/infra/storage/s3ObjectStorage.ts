import crypto from 'crypto';
import { Readable } from 'stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import {
  IObjectStorage,
  ObjectStorageError,
  PutObjectInput,
  ReadObjectResult,
  StoredObjectRef,
} from './types';

export interface S3StorageConfig {
  /** Empty = real AWS. Set for MinIO/Ceph (with forcePathStyle). */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  /** Optional key prefix within the bucket. */
  prefix: string;
}

/**
 * S3-compatible object storage (AWS, MinIO, Ceph).
 *
 * The config is validated at boot (see config/index.ts `superRefine`), so by
 * the time this is constructed the credentials and bucket are guaranteed present.
 */
export class S3ObjectStorage implements IObjectStorage {
  public readonly driver = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(cfg: S3StorageConfig) {
    this.bucket = cfg.bucket;
    this.prefix = cfg.prefix;
    this.client = new S3Client({
      region: cfg.region,
      ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
      forcePathStyle: cfg.forcePathStyle,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

  /** The stored key: the caller's driver-relative key under the configured prefix. */
  private fullKey(key: string): string {
    return this.prefix ? `${this.prefix.replace(/\/+$/, '')}/${key}` : key;
  }

  public async put(input: PutObjectInput): Promise<StoredObjectRef> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.fullKey(input.key),
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    } catch (err) {
      throw new ObjectStorageError(`failed to put object '${input.key}'`, err);
    }
    return {
      driver: this.driver,
      key: input.key,
      sizeBytes: input.body.length,
      contentType: input.contentType,
      checksumSha256: crypto
        .createHash('sha256')
        .update(input.body)
        .digest('hex'),
    };
  }

  public async get(key: string): Promise<ReadObjectResult> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
      );
      if (!res.Body) {
        throw new ObjectStorageError(`object has no body: ${key}`);
      }
      return {
        // On Node the SDK returns a Readable; the union also covers browser types.
        stream: res.Body as Readable,
        contentType: res.ContentType ?? 'application/octet-stream',
        sizeBytes: typeof res.ContentLength === 'number' ? res.ContentLength : 0,
      };
    } catch (err) {
      if (err instanceof ObjectStorageError) throw err;
      throw new ObjectStorageError(`object not found: ${key}`, err);
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
      );
      return true;
    } catch {
      return false;
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
      );
    } catch (err) {
      throw new ObjectStorageError(`failed to delete object '${key}'`, err);
    }
  }
}
