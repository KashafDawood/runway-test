import { Response } from 'express';
import httpStatus from 'http-status';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import UserModel from '@components/user/v1/user.model';
import { RequestWithContext } from 'types/request';

/**
 * PATCH /api/v1/users/me/preferences
 * Update current user notification preferences.
 */
export const updatePreferences = asyncWrapper(
  async (req: RequestWithContext, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }

    const { notificationsEnabled } = req.body as { notificationsEnabled: boolean };
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { notificationsEnabled },
      { new: true }
    )
      .select('notificationsEnabled')
      .lean();

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        notificationsEnabled: user.notificationsEnabled ?? true,
      },
    });
  }
);

/**
 * PATCH /api/v1/users/me/avatar
 * Update current user profile picture (multipart field `avatar`).
 */
export const updateAvatar = asyncWrapper(
  async (req: RequestWithContext, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }

    const avatarPath = req.body?.avatarPath as string | undefined;
    if (!avatarPath?.trim()) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Avatar image is required');
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { avatar: avatarPath.trim() },
      { new: true }
    ).lean();

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        email_verified: user.email_verified,
        avatar: user.avatar,
        dateOfBirth: user.dateOfBirth,
      },
    });
  }
);
