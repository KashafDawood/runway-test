import fs from 'fs/promises';
import path from 'path';
import { buildImageObjectKey } from './objectKey';
import type { StoreImageParams, UploadedImage } from './types';

/** Root on disk: `public/uploads` (relative URLs start with `/uploads/...`). */
export const UPLOAD_ROOT_DIR = path.join(process.cwd(), 'public', 'uploads');

export const RELATIVE_UPLOAD_PREFIX = '/uploads';

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Persist an image to local disk under `public/uploads/<keyParts>/`.
 * Returns a path suitable for storing on models and serving via `/api/static` (e.g. `/uploads/teams/...`).
 */
export async function storeImage(file: UploadedImage, params: StoreImageParams): Promise<string> {
  const { objectKey, relativePath } = buildImageObjectKey(file, params);
  const safeParts = objectKey.replace(/^uploads\//, '').split('/');
  const dirPath = path.join(UPLOAD_ROOT_DIR, ...safeParts.slice(0, -1));
  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_ROOT_DIR, ...safeParts), file.buffer);
  return relativePath;
}
