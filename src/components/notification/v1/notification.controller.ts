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

/**
 * POST /api/v1/notifications/test-send
 * Send a test notification to all devices of the authenticated user.
 * Useful for verifying Firebase credentials and token validity.
 */
export const testSend = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const result = await notificationService.sendToUser(userId.toString(), {
    title: '🚀 Test Notification',
    body: 'This is a test push notification from Runway. If you see this, push notifications are working!',
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Test notification sent',
    result,
  });
});
