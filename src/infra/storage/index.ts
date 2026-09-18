import { config } from '../../config';
import { LocalFileStorage } from './localFileStorage';
import { S3ObjectStorage } from './s3ObjectStorage';
import { IObjectStorage } from './types';

/**
 * The process-wide object storage, selected once by STORAGE_DRIVER. The S3
 * branch's required settings are validated at boot by the config schema, so a
 * misconfigured install fails at startup rather than on the first upload.
 */
export const objectStorage: IObjectStorage =
  config.storage.driver === 's3'
    ? new S3ObjectStorage(config.storage.s3)
    : new LocalFileStorage(config.storage.local.root);

export * from './types';
export { LocalFileStorage } from './localFileStorage';
export { S3ObjectStorage } from './s3ObjectStorage';
