/**
 * Upload checks shared by every use case that accepts a file. Pure functions —
 * the allowed content types come from the caller (config), not from here.
 */

/** Leading-byte signatures for the content types we accept by default. */
const MAGIC_BYTES: Record<string, readonly number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
};

/**
 * True when the body starts with a signature of the claimed content type. A
 * type with no known signature passes: the allowlist already gated it, and a
 * weak invented check would be worse than none.
 */
export function matchesMagicBytes(contentType: string, body: Buffer): boolean {
  const signatures = MAGIC_BYTES[contentType.toLowerCase()];
  if (!signatures) return true;
  return signatures.some((sig) => sig.every((byte, i) => body[i] === byte));
}

/** A storage-safe file name: no path separators, no leading dots, ≤100 chars. */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+/, '');
  return (cleaned || 'file').slice(0, 100);
}

export interface UploadCheckInput {
  body: Buffer | undefined;
  contentType: string | undefined;
  allowedContentTypes: readonly string[];
  maxBytes: number;
}

/** Why an uploaded file is unacceptable, or null when it is fine. */
export function uploadRejection(input: UploadCheckInput): string | null {
  const body = input.body;
  if (!body || body.length === 0) return 'file is required and must not be empty';
  if (body.length > input.maxBytes) {
    return `file exceeds the maximum size of ${input.maxBytes} bytes`;
  }
  const contentType = (input.contentType ?? '').trim().toLowerCase();
  if (!input.allowedContentTypes.includes(contentType)) {
    return `content type '${input.contentType ?? ''}' is not allowed`;
  }
  if (!matchesMagicBytes(contentType, body)) {
    return `file content does not match its declared type '${contentType}'`;
  }
  return null;
}
