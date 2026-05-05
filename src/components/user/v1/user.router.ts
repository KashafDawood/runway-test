import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import { verifyToken, requireEmailVerified } from '@components/auth/v1/auth.middleware';
import * as userController from './user.controller';
import * as userValidation from './user.validation';
import { handleUserAvatarUpload } from './userAvatarUpload.middleware';

const router = Router();

/**
 * Update current user notification preferences
 * PATCH /api/v1/users/me/preferences
 */
router.patch(
  '/me/preferences',
  verifyToken,
  validate(userValidation.updatePreferencesSchema),
  userController.updatePreferences
);

/**
 * Update current user avatar (multipart: field `avatar`)
 * PATCH /api/v1/users/me/avatar
 */
router.patch(
  '/me/avatar',
  verifyToken,
  requireEmailVerified,
  ...handleUserAvatarUpload,
  userController.updateAvatar
);

export default router;
