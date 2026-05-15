import path from 'path';
import { randomUUID } from 'crypto';
import type { StoreImageParams, UploadedImage } from './types';

const sanitizeSegment = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const sanitizeFileName = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const getExtensionFromMimeType = (mimetype: string): string => {
  if (mimetype === 'image/jpeg') return '.jpg';
  if (mimetype === 'image/png') return '.png';
  return '.webp';
};

export interface BuiltImageObjectKey {
  /** Object key without leading slash, e.g. `uploads/users/abc/avatar/avatar-...jpg` */
  objectKey: string;
  /** Relative URL path for disk storage, e.g. `/uploads/users/abc/avatar/...` */
  relativePath: string;
}

/**
 * Build a stable object key / relative path from upload params.
 * Shared by disk and Firebase storage backends.
 */
export function buildImageObjectKey(
  file: UploadedImage,
  params: StoreImageParams,
): BuiltImageObjectKey {
  const { keyParts, namePrefix } = params;

  if (!keyParts?.length) {
    throw new Error('buildImageObjectKey: keyParts must be a non-empty array');
  }

  const safeParts = keyParts.map((p) => sanitizeSegment(String(p)));
  const prefix = namePrefix ? sanitizeSegment(namePrefix) : 'image';

  const ext = path.extname(file.originalname) || getExtensionFromMimeType(file.mimetype);
  const safeOriginal = sanitizeFileName(
    path.basename(file.originalname, path.extname(file.originalname)),
  );
  const uniqueSegment = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const fileName = `${prefix}-${safeOriginal || 'image'}-${uniqueSegment}${ext.toLowerCase()}`;

  const objectKey = `uploads/${safeParts.join('/')}/${fileName}`;
  return {
    objectKey,
    relativePath: `/${objectKey}`,
  };
}
