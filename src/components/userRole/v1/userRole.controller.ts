import { Request, Response } from 'express';
import httpStatus from 'http-status';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import * as userRoleService from './userRole.service';
import { notifyRoleChanged } from '@components/notification/v1/notificationDelivery.service';
import { Team } from '@components/team/v1/team.model';
import logger from '@core/utils/logger';

/**
 * PUT /api/v1/teams/:teamId/members/:userId/role
 * Update user's role in a team
 * 
 * ✅ Authentication: Required
 * ✅ Email Verified: Required
 * ✅ Permission: Coach only (checked in middleware)
 * 
 * Request body:
 * {
 *   "role": "player" | "guardian" | "assistant_coach" | "media"
 * }
 */
export const updateRole = asyncWrapper(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { teamId, userId: targetUserId } = req.params;
    const { role } = req.body;

    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }

    if (!teamId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
    }

    if (!targetUserId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required');
    }

    if (!role) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Role is required');
    }

    const result = await userRoleService.updateUserRole({
      teamId,
      userId: targetUserId,
      newRoleName: role,
      updatedBy: userId.toString(),
    });

    try {
      const team = await Team.findById(teamId).select('name').lean();
      if (team?.name) {
        await notifyRoleChanged({
          userId: targetUserId,
          teamId,
          teamName: team.name,
          newRole: result.newRole,
        });
      }
    } catch (err) {
      logger.error('Failed to send role-changed notification', err);
    }

    res.status(httpStatus.OK).json({
      success: true,
      message: `User role updated from ${result.previousRole} to ${result.newRole}`,
      data: {
        userRole: result.userRole,
        previousRole: result.previousRole,
        newRole: result.newRole,
      },
    });
  }
);

/**
 * GET /api/v1/teams/:teamId/members/:userId/role
 * Get user's role in a team
 * 
 * ✅ Authentication: Required
 * ✅ Permission: Team member (any role)
 */
export const getUserRole = asyncWrapper(
  async (req: Request, res: Response) => {
    const { teamId, userId: targetUserId } = req.params;

    if (!teamId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
    }

    if (!targetUserId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required');
    }

    const userRole = await userRoleService.getUserRoleInTeam(
      targetUserId,
      teamId
    );

    if (!userRole) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'User is not a member of this team'
      );
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        userRole,
      },
    });
  }
);
