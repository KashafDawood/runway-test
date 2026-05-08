import { Request, Response } from 'express';
import httpStatus from 'http-status';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import * as notificationService from './notification.service';

/**
 * GET /api/v1/notifications
 * Paginated list of the authenticated user's notifications.
 * Query params: page, limit, unread (true/false), type
 */
export const listNotifications = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const unreadOnly = req.query.unread === 'true';
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;

  const result = await notificationService.listNotifications(userId.toString(), {
    page,
    limit,
    unreadOnly,
    type,
  });

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/v1/notifications/unread-count
 * Returns just the unread count, for lightweight bell-badge polling.
 */
export const getUnreadCount = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');

  const count = await notificationService.getUnreadCount(userId.toString());

  res.status(httpStatus.OK).json({
    success: true,
    data: { count },
  });
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a single notification as read.
 */
export const markRead = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');

  const { id } = req.params;
  await notificationService.markNotificationRead(id, userId.toString());

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Notification marked as read',
  });
});

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all notifications for the user as read.
 */
export const markAllRead = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');

  await notificationService.markAllNotificationsRead(userId.toString());

  res.status(httpStatus.OK).json({
    success: true,
    message: 'All notifications marked as read',
  });
});

/**
 * DELETE /api/v1/notifications/:id
 * Delete a single notification from the user's inbox.
 */
export const deleteNotification = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');

  const { id } = req.params;
  await notificationService.deleteNotification(id, userId.toString());

  res.status(httpStatus.NO_CONTENT).send();
});
