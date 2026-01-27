import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import {
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  requireTeamMember,
} from '@components/auth/v1/auth.middleware';
import * as userRoleController from './userRole.controller';
import * as userRoleValidation from './userRole.validation';

const router = Router();

/**
 * UPDATE USER ROLE
 * PUT /api/v1/user-roles/:teamId/members/:userId/role
 * 
 * ✅ Authentication: Required
 * ✅ Email Verified: Required
 * ✅ Permission: Coach only (requireTeamAdmin)
 * 
 * Allows coaches to correct roles after a user joins
 * Prevents invalid role transitions
 * No data loss - preserves all existing UserRole fields
 */
router.put(
  '/:teamId/members/:userId/role',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  validate(userRoleValidation.updateRoleSchema),
  userRoleController.updateRole
);

/**
 * GET USER ROLE
 * GET /api/v1/user-roles/:teamId/members/:userId/role
 * 
 * ✅ Authentication: Required
 * ✅ Permission: Team member (any role)
 * 
 * Get user's role information in a team
 */
router.get(
  '/:teamId/members/:userId/role',
  verifyToken,
  extractTeamContext,
  requireTeamMember,
  validate(userRoleValidation.getUserRoleSchema),
  userRoleController.getUserRole
);

export default router;
