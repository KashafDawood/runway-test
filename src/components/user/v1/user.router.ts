import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import { verifyToken } from '@components/auth/v1/auth.middleware';
import * as userController from './user.controller';
import * as userValidation from './user.validation';

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

export default router;
