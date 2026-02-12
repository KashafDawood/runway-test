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
