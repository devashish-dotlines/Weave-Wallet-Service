import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  IObjectStorage,
  ObjectStorageError,
  PutObjectInput,
  ReadObjectResult,
  StoredObjectRef,
} from './types';

/**
 * Local-disk object storage. Everything lives under a single configured root.
 *
 * The root MUST NOT be `media/` — app.ts serves it via
 * express.static with no auth, so putting deposit slips there would publish them.
 */
export class LocalFileStorage implements IObjectStorage {
  public readonly driver = 'local' as const;
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /**
   * Resolve a driver-relative key to an absolute path, refusing anything that
   * escapes the root. Keys reach us from request data, so `../..` traversal is
   * the obvious attack; the domain also rejects such keys, and this is the
   * backstop that makes a miss there harmless.
   */
  private resolveSafe(key: string): string {
    const resolved = path.resolve(this.root, key);
    if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
      throw new ObjectStorageError(
        `storage key escapes the storage root: ${key}`,
      );
    }
    return resolved;
  }

  public async put(input: PutObjectInput): Promise<StoredObjectRef> {
    const target = this.resolveSafe(input.key);
    try {
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, input.body);
    } catch (err) {
      throw new ObjectStorageError(
        `failed to write object '${input.key}'`,
        err,
      );
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
    const target = this.resolveSafe(key);
    let size: number;
    try {
      const stat = await fs.promises.stat(target);
      size = stat.size;
    } catch (err) {
      throw new ObjectStorageError(`object not found: ${key}`, err);
    }
    return {
      stream: fs.createReadStream(target),
      // The DB row is authoritative for content type; local disk stores none.
      contentType: 'application/octet-stream',
      sizeBytes: size,
    };
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await fs.promises.access(this.resolveSafe(key), fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await fs.promises.unlink(this.resolveSafe(key));
    } catch (err) {
      // Already gone is success — delete must be idempotent.
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return;
      throw new ObjectStorageError(`failed to delete object '${key}'`, err);
    }
  }
}
