import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import { verifyToken } from '@components/auth/v1/auth.middleware';
import * as notificationController from './notification.controller';
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
 * Requires authentication; sends a test notification to all tokens for the current user
 */
router.post(
  '/test-send',
  verifyToken,
  notificationController.testSend
);

export default router;
