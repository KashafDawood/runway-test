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

type UploadedEventFiles = {
  images?: UploadedMulterFile[];
};

const eventImageFieldsMiddleware = imageUploader.fields([
  { name: 'images', maxCount: 5 }
]);

const toUploadedImage = (file: UploadedMulterFile): UploadedImage => ({
  originalname: file.originalname,
  mimetype: file.mimetype,
  buffer: file.buffer
});

const parseJsonField = (value: unknown, fieldName: string): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new AppError(httpStatus.BAD_REQUEST, `${fieldName} must be valid JSON`);
  }
};

const processEventUploads = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const files = ((req as Request & { files?: UploadedEventFiles }).files ?? {});
    const teamId = req.params.teamId || `tmp-${randomUUID()}`;
    const eventFolder = req.params.eventId || 'new';

    const imageFiles = files.images ?? [];
    const uploadedImagePaths: string[] = [];

    for (const file of imageFiles) {
      const path = await storeImage(toUploadedImage(file), {
        keyParts: ['events', teamId, eventFolder, 'images'],
        namePrefix: 'image'
      });
      uploadedImagePaths.push(path);
    }

    if (uploadedImagePaths.length > 0) {
      req.body.uploadedImagePaths = uploadedImagePaths;
    }

    if (typeof req.body.recurrence === 'string') {
      req.body.recurrence = parseJsonField(req.body.recurrence, 'recurrence');
    }

    if (typeof req.body.images === 'string') {
      req.body.images = parseJsonField(req.body.images, 'images');
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const handleEventImageUpload = [eventImageFieldsMiddleware, processEventUploads];
