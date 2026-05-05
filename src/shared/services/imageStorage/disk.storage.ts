import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { StoreImageParams, UploadedImage } from './types';

/** Root on disk: `public/uploads` (relative URLs start with `/uploads/...`). */
export const UPLOAD_ROOT_DIR = path.join(process.cwd(), 'public', 'uploads');

export const RELATIVE_UPLOAD_PREFIX = '/uploads';

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const sanitizeSegment = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const sanitizeFileName = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const getExtensionFromMimeType = (mimetype: string): string => {
  if (mimetype === 'image/jpeg') return '.jpg';
  if (mimetype === 'image/png') return '.png';
  return '.webp';
};

/**
 * Persist an image to local disk under `public/uploads/<keyParts>/`.
 * Returns a path suitable for storing on models and serving via `/api/static` (e.g. `/uploads/teams/...`).
 * Swap this implementation for S3/Cloudinary later without changing callers.
 */
export async function storeImage(file: UploadedImage, params: StoreImageParams): Promise<string> {
  const { keyParts, namePrefix } = params;

  if (!keyParts?.length) {
    throw new Error('storeImage: keyParts must be a non-empty array');
  }

  const safeParts = keyParts.map((p) => sanitizeSegment(String(p)));
  const prefix = namePrefix ? sanitizeSegment(namePrefix) : 'image';

  const ext = path.extname(file.originalname) || getExtensionFromMimeType(file.mimetype);
  const safeOriginal = sanitizeFileName(
    path.basename(file.originalname, path.extname(file.originalname))
  );
  const uniqueSegment = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const fileName = `${prefix}-${safeOriginal || 'image'}-${uniqueSegment}${ext.toLowerCase()}`;

  const dirPath = path.join(UPLOAD_ROOT_DIR, ...safeParts);
  await fs.mkdir(dirPath, { recursive: true });

  const absolutePath = path.join(dirPath, fileName);
  await fs.writeFile(absolutePath, file.buffer);

  return `${RELATIVE_UPLOAD_PREFIX}/${safeParts.join('/')}/${fileName}`;
}
