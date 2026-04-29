import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import AppError from '@core/utils/appError';

const UPLOAD_ROOT_DIR = path.join(process.cwd(), 'public', 'uploads', 'teams');
const RELATIVE_UPLOAD_BASE = '/uploads/teams';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(new AppError(httpStatus.BAD_REQUEST, 'Only JPG, PNG, and WebP images are allowed'));
    }
    cb(null, true);
  }
});

const teamImageFieldsMiddleware = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]);

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type UploadedTeamFiles = {
  logo?: UploadedFile[];
  coverImage?: UploadedFile[];
};

const sanitizeFileName = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const getExtensionFromMimeType = (mimetype: string): string => {
  if (mimetype === 'image/jpeg') return '.jpg';
  if (mimetype === 'image/png') return '.png';
  return '.webp';
};

const storeTeamImage = async (
  file: UploadedFile,
  type: 'logo' | 'coverImage',
  teamFolder: string
): Promise<string> => {
  const ext = path.extname(file.originalname) || getExtensionFromMimeType(file.mimetype);
  const safeOriginal = sanitizeFileName(path.basename(file.originalname, path.extname(file.originalname)));
  const uniqueSegment = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const fileName = `${type}-${safeOriginal || 'image'}-${uniqueSegment}${ext.toLowerCase()}`;

  const dirPath = path.join(UPLOAD_ROOT_DIR, teamFolder, type);
  await fs.mkdir(dirPath, { recursive: true });

  const absolutePath = path.join(dirPath, fileName);
  await fs.writeFile(absolutePath, file.buffer);

  return `${RELATIVE_UPLOAD_BASE}/${teamFolder}/${type}/${fileName}`;
};

const processTeamUploads = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const files = ((req as Request & { files?: UploadedTeamFiles }).files ?? {});
    const teamFolder = req.params.teamId || `tmp-${randomUUID()}`;

    const logoFile = files.logo?.[0];
    const coverFile = files.coverImage?.[0];

    if (logoFile) {
      req.body.logoPath = await storeTeamImage(logoFile, 'logo', teamFolder);
    }

    if (coverFile) {
      req.body.coverImagePath = await storeTeamImage(coverFile, 'coverImage', teamFolder);
    }

    if (typeof req.body.settings === 'string') {
      try {
        req.body.settings = JSON.parse(req.body.settings);
      } catch {
        throw new AppError(httpStatus.BAD_REQUEST, 'settings must be valid JSON');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const handleTeamImageUpload = [
  teamImageFieldsMiddleware,
  processTeamUploads
];
