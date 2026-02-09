import { Router } from 'express';
import * as authController from './auth.controller';
import validate from '@core/middlewares/validate.middleware';
import * as authValidation from './auth.validation';
import { verifyToken, requireEmailVerified, optionalVerifyToken } from './auth.middleware';

const router: Router = Router();

// Public routes
router.post('/signup', validate(authValidation.signUpValidation), authController.signUp);

router.post('/signin', validate(authValidation.signInValidation), authController.signIn);

router.post(
  '/verify-email',
  validate(authValidation.verifyEmailValidation),
  authController.verifyEmail
);

router.post(
  '/forgot-password',
  validate(authValidation.forgotPasswordValidation),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  validate(authValidation.resetPasswordValidation),
  authController.resetPassword
);

router.post(
  '/resend-verification',
  optionalVerifyToken,
  validate(authValidation.resendVerificationValidation),
  authController.resendVerificationEmail
);

// Protected routes

router.get('/me', verifyToken, authController.getMe);

// Active team routes
router.get(
  '/active-team',
  verifyToken,
  requireEmailVerified,
  authController.getActiveTeam,
);

router.post(
  '/active-team',
  verifyToken,
  requireEmailVerified,
  validate(authValidation.setActiveTeamValidation),
  authController.setActiveTeam,
);

export default router;
