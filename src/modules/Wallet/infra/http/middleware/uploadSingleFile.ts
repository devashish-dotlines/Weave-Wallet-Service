import * as express from 'express';
import multer from 'multer';
import { config } from '../../../../../config';

const upload = multer({
  // In memory: the use case validates the bytes before anything is stored.
  storage: multer.memoryStorage(),
  limits: { fileSize: config.storage.maxFileBytes, files: 1 },
});

/**
 * Parses one multipart file from `field`. Multer's own failures (too large,
 * unexpected field, too many files) become a 400 instead of an unhandled error.
 */
export function uploadSingleFile(field = 'file'): express.RequestHandler {
  const handler = upload.single(field);
  return (req, res, next) => {
    handler(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? `file exceeds the maximum size of ${config.storage.maxFileBytes} bytes`
            : err.message;
        return res.status(400).json({ message });
      }
      return next(err);
    });
  };
}
