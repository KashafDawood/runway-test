import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import { verifyToken } from '@components/auth/v1/auth.middleware';
import * as notificationController from './notification.controller';
import * as notificationInboxController from './notificationInbox.controller';
import * as notificationValidation from './notification.validation';

const router = Router();

/**
 * Register device token for push notifications
 * POST /api/v1/notifications/register
 */
router.post(
  '/register',
  verifyToken,
  validate(notificationValidation.registerTokenSchema),
  notificationController.registerToken
);

/**
 * Unregister device token
 * POST /api/v1/notifications/unregister
 */
router.post(
  '/unregister',
  verifyToken,
  validate(notificationValidation.unregisterTokenSchema),
  notificationController.unregisterToken
);

/**
 * Test send a notification to the authenticated user's registered devices
 * POST /api/v1/notifications/test-send
 */
router.post(
  '/test-send',
  verifyToken,
  notificationController.testSend
);

// ---------------------------------------------------------------------------
// Inbox endpoints
// ---------------------------------------------------------------------------

/**
 * Mark all notifications as read (must come BEFORE /:id to avoid route conflict)
 * PATCH /api/v1/notifications/read-all
 */
router.patch('/read-all', verifyToken, notificationInboxController.markAllRead);

/**
 * Get paginated notification list
 * GET /api/v1/notifications?page=1&limit=20&unread=true&type=event_created
 */
router.get('/', verifyToken, notificationInboxController.listNotifications);

/**
 * Get unread notification count (for bell badge)
 * GET /api/v1/notifications/unread-count
 */
router.get('/unread-count', verifyToken, notificationInboxController.getUnreadCount);

/**
 * Mark a single notification as read
 * PATCH /api/v1/notifications/:id/read
 */
router.patch('/:id/read', verifyToken, notificationInboxController.markRead);

/**
 * Delete a notification from inbox
 * DELETE /api/v1/notifications/:id
 */
router.delete('/:id', verifyToken, notificationInboxController.deleteNotification);

export default router;
