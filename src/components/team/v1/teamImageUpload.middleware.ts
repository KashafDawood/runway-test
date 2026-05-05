import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import AppError from '@core/utils/appError';
import { imageUploader, storeImage, type UploadedImage } from '@shared/services/imageStorage';

type UploadedMulterFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type UploadedTeamFiles = {
  logo?: UploadedMulterFile[];
  coverImage?: UploadedMulterFile[];
};

const teamImageFieldsMiddleware = imageUploader.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
]);

const toUploadedImage = (file: UploadedMulterFile): UploadedImage => ({
  originalname: file.originalname,
  mimetype: file.mimetype,
  buffer: file.buffer,
});

const processTeamUploads = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const files = ((req as Request & { files?: UploadedTeamFiles }).files ?? {});
    const teamFolder = req.params.teamId || `tmp-${randomUUID()}`;

    const logoFile = files.logo?.[0];
    const coverFile = files.coverImage?.[0];

    if (logoFile) {
      req.body.logoPath = await storeImage(toUploadedImage(logoFile), {
        keyParts: ['teams', teamFolder, 'logo'],
        namePrefix: 'logo',
      });
    }

    if (coverFile) {
      req.body.coverImagePath = await storeImage(toUploadedImage(coverFile), {
        keyParts: ['teams', teamFolder, 'coverImage'],
        namePrefix: 'coverImage',
      });
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

export const handleTeamImageUpload = [teamImageFieldsMiddleware, processTeamUploads];
