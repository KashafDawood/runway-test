import { Request, Response } from 'express';
import httpStatus from 'http-status';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import * as notificationService from './notification.service';

/**
 * POST /api/v1/notifications/register
 * Register FCM device token for the authenticated user.
 */
export const registerToken = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const { token, platform, label } = req.body;
  await notificationService.registerToken(userId.toString(), token, { platform, label });

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Device token registered for push notifications',
  });
});

/**
 * POST /api/v1/notifications/unregister
 * Remove FCM device token (e.g. on logout).
 */
export const unregisterToken = asyncWrapper(async (req: Request, res: Response) => {
  const { token } = req.body;
  await notificationService.unregisterToken(token);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Device token unregistered',
  });
});
