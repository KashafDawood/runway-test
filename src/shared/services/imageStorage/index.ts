import multer from 'multer';
import httpStatus from 'http-status';
import AppError from '@core/utils/appError';
import { MAX_IMAGE_SIZE_BYTES, storeImage as storeImageOnDisk } from './disk.storage';

export type { StoreImageParams, UploadedImage } from './types';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Shared multer instance (memory storage). Route modules compose `.single()`, `.fields()`, etc.
 */
export const imageUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(new AppError(httpStatus.BAD_REQUEST, 'Only JPG, PNG, and WebP images are allowed'));
    }
    cb(null, true);
  },
});

/** Persist image; today uses disk — replace internals in `disk.storage.ts` or branch here for buckets. */
export const storeImage = storeImageOnDisk;

export { MAX_IMAGE_SIZE_BYTES, UPLOAD_ROOT_DIR, RELATIVE_UPLOAD_PREFIX } from './disk.storage';
