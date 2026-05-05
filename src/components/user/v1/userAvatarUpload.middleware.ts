import { NextFunction, Response } from 'express';
import httpStatus from 'http-status';
import AppError from '@core/utils/appError';
import { imageUploader, storeImage, type UploadedImage } from '@shared/services/imageStorage';
import { RequestWithContext } from 'types/request';

type UploadedMulterFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

const uploadSingle = imageUploader.single('avatar');

const toUploadedImage = (file: UploadedMulterFile): UploadedImage => ({
  originalname: file.originalname,
  mimetype: file.mimetype,
  buffer: file.buffer,
});

const processUserAvatar = async (req: RequestWithContext, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const file = (req as RequestWithContext & { file?: UploadedMulterFile }).file;
    if (!file?.buffer) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Avatar image is required');
    }

    const userId = req.user?._id;
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }

    req.body.avatarPath = await storeImage(toUploadedImage(file), {
      keyParts: ['users', String(userId), 'avatar'],
      namePrefix: 'avatar',
    });

    next();
  } catch (error) {
    next(error);
  }
};

export const handleUserAvatarUpload = [uploadSingle, processUserAvatar];
