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
 */
router.get(
  '/check',
  validate(teamInviteValidation.checkInviteSchema),
  teamInviteController.checkInvite
);

/**
 * ACCEPT INVITE (Combined: Check + Register if needed + Accept)
 * POST /api/v1/team-invites/accept
 */
router.post(
  '/accept',
  validate(teamInviteValidation.acceptInviteSchema),
  teamInviteController.acceptInvite
);
/**
 * GET TEAM INVITES
 * GET /api/v1/team-invites/:teamId/invites
 * 
 * Coach only - view all invites for team
 */
router.get(
  '/:teamId/invites',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  teamInviteController.getTeamInvites
);

/**
 * CANCEL INVITE
 * DELETE /api/v1/team-invites/:inviteId
 * 
 * Coach only - cancel pending invite
 */
router.delete(
  '/:inviteId',
  verifyToken,
  requireEmailVerified,
  validate(teamInviteValidation.cancelInviteSchema),
  teamInviteController.cancelInvite
);

/**
 * RESEND INVITE
 * POST /api/v1/team-invites/:inviteId/resend
 * 
 * Coach only - resend invite email
 */
router.post(
  '/:inviteId/resend',
  verifyToken,
  requireEmailVerified,
  validate(teamInviteValidation.cancelInviteSchema),
  teamInviteController.resendInvite
);
export default router;