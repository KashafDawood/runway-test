import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import {
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember
} from '@components/auth/v1/auth.middleware';
import * as guardianLinkController from './guardianLink.controller';
import * as guardianLinkValidation from './guardianLink.validation';

const router = Router();

/**
 * POST /api/v1/teams/:teamId/guardian-links
 * Request a guardian-player link in a team.
 */
router.post(
  '/:teamId/guardian-links',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  validate(guardianLinkValidation.requestGuardianLinkSchema),
  guardianLinkController.requestGuardianLink
);

/**
 * GET /api/v1/teams/:teamId/guardian-links
 * List guardian links visible to the current user in the team.
 */
router.get(
  '/:teamId/guardian-links',
  verifyToken,
  extractTeamContext,
  requireTeamMember,
  guardianLinkController.listGuardianLinks
);

/**
 * PUT /api/v1/teams/:teamId/guardian-links/:linkId/approve
 * Approve a pending guardian link.
 */
router.put(
  '/:teamId/guardian-links/:linkId/approve',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  validate(guardianLinkValidation.guardianLinkParamsSchema),
  guardianLinkController.approveGuardianLink
);

/**
 * PUT /api/v1/teams/:teamId/guardian-links/:linkId/reject
 * Reject a pending guardian link.
 */
router.put(
  '/:teamId/guardian-links/:linkId/reject',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  validate(guardianLinkValidation.guardianLinkParamsSchema),
  guardianLinkController.rejectGuardianLink
);

/**
 * DELETE /api/v1/teams/:teamId/guardian-links/:linkId
 * Remove (deactivate) a guardian link.
 */
router.delete(
  '/:teamId/guardian-links/:linkId',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  validate(guardianLinkValidation.guardianLinkParamsSchema),
  guardianLinkController.removeGuardianLink
);

export default router;

