import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import {
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  requireTeamAdmin
} from '@components/auth/v1/auth.middleware';
import * as teamController from './team.controller';
import * as teamValidation from './team.validation';

const router = Router();

/**
 * CREATE TEAM
 * POST /api/v1/teams
 * 
 * ✅ Authentication: Required
 * ✅ Email Verified: Required (middleware)
 * ✅ Constraint: Only verified coaches can create
 * 
 * When creating, user automatically becomes COACH of the new team
 */
router.post(
  '/',
  verifyToken,
  requireEmailVerified,
  validate(teamValidation.createTeamSchema),
  teamController.createTeam
);

/**
 * GET MY TEAMS
 * GET /api/v1/teams
 * 
 * Get all teams where authenticated user is a member
 */
router.get(
  '/',
  verifyToken,
  teamController.getMyTeams
);

/**
 * GET TEAM DETAILS
 * GET /api/v1/teams/:teamId
 * 
 * Get specific team (user must be member)
 */
router.get(
  '/:teamId',
  verifyToken,
  extractTeamContext,
  requireTeamMember,
  validate(teamValidation.getTeamSchema),
  teamController.getTeam
);

/**
 * UPDATE TEAM
 * PUT /api/v1/teams/:teamId
 * 
 * ✅ Authentication: Required
 * ✅ Email Verified: Required
 * ✅ Constraint: Only coaches can update
 */
router.put(
  '/:teamId',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  validate(teamValidation.updateTeamSchema),
  teamController.updateTeam
);

/**
 * DELETE TEAM
 * DELETE /api/v1/teams/:teamId
 * 
 * ✅ Authentication: Required
 * ✅ Email Verified: Required
 * ✅ Constraint: Only creator can delete
 */
router.delete(
  '/:teamId',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  teamController.deleteTeam
);

/**
 * ADD TEAM MEMBER
 * POST /api/v1/teams/:teamId/members
 * 
 * ✅ Authentication: Required
 * ✅ Email Verified: Required
 * ✅ Constraint: Only coaches can add members
 */
router.post(
  '/:teamId/members',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  validate(teamValidation.addTeamMemberSchema),
  teamController.addTeamMember
);

export default router;