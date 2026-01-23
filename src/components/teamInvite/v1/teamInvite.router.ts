import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import {
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin
} from '@components/auth/v1/auth.middleware';
import * as teamInviteController from './teamInvite.controller';
import * as teamInviteValidation from './teamInvite.validation';

const router = Router();

/**
 * CREATE BATCH INVITES
 * POST /api/v1/:teamId/invites/batch
 * 
 * Coach sends invites to multiple emails (max 20)
 * NO ROLE specified - user chooses when accepting
 */
router.post(
  '/:teamId/invites/batch',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  validate(teamInviteValidation.createBatchInviteSchema),
  teamInviteController.createBatchInvites
);

/**
 * CHECK INVITE
 * GET /api/v1/team-invites/check?token=xxx
 * 
 * PUBLIC - No auth required
 * Returns invite details and whether registration is needed
 */
router.get(
  '/check',
  validate(teamInviteValidation.checkInviteSchema),
  teamInviteController.checkInvite
);

/**
 * COMPLETE REGISTRATION (Step 1 for new users)
 * POST /api/v1/team-invites/register
 * 
 * PUBLIC - No auth required
 * New user provides name, password, phone (optional)
 * Creates account with email verification
 */
router.post(
  '/register',
  validate(teamInviteValidation.completeRegistrationSchema),
  teamInviteController.completeRegistration
);

/**
 * ACCEPT INVITE (Step 2 or only step)
 * POST /api/v1/team-invites/accept
 * 
 * Can be called with or without auth:
 * - New users: After registration, call this with token + role
 * - Existing users: Must be authenticated, call with token + role
 */
router.post(
  '/accept',
  validate(teamInviteValidation.acceptInviteSchema),
  teamInviteController.acceptInvite
);

export default router;