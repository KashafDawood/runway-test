import { Request, Response } from 'express';
import httpStatus from 'http-status';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import * as teamInviteService from './teamInvite.service';

/**
 * POST /api/v1/teams/:teamId/invites/batch
 * Create batch team invites (up to 20)
 */
export const createBatchInvites = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { teamId } = req.params;
  const { emails } = req.body;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const results = await teamInviteService.createBatchInvites({
    teamId,
    invitedBy: userId,
    emails
  });

  res.status(httpStatus.CREATED).json({
    success: true,
    message: `Successfully sent ${results.success.length} invite(s)`,
    data: results
  });
});

/**
 * GET /api/v1/team-invites/check
 * Check invite and determine if registration is required
 * PUBLIC - no auth required
 */
export const checkInvite = asyncWrapper(async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Token is required');
  }

  const result = await teamInviteService.checkInvite({ token });

  res.status(httpStatus.OK).json({
    success: true,
    data: result
  });
});

/**
 * POST /api/v1/team-invites/accept
 * Accept team invite with role selection
 * Auto-registers user if they don't exist (with optional userData)
 * Can be called with or without authentication
 */
export const acceptInvite = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id; // Optional - for existing users
  const { token, role, userData } = req.body;

  const result = await teamInviteService.acceptInvite({
    token,
    role,
    userId,
    userData
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: result.isNewUser 
      ? 'Welcome! You\'ve successfully joined the team' 
      : 'Invite accepted successfully',
    data: result
  });
});

/**
 * GET /api/v1/teams/:teamId/invites
 * Get all invites for team
 */
export const getTeamInvites = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { teamId } = req.params;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const invites = await teamInviteService.getTeamInvites(teamId, userId);

  res.status(httpStatus.OK).json({
    success: true,
    data: invites
  });
});

/**
 * DELETE /api/v1/team-invites/:inviteId
 * Cancel invite
 */
export const cancelInvite = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { inviteId } = req.params;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  await teamInviteService.cancelInvite(inviteId, userId);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Invite cancelled successfully'
  });
});

/**
 * POST /api/v1/team-invites/:inviteId/resend
 * Resend invite email
 */
export const resendInvite = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { inviteId } = req.params;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  await teamInviteService.resendInvite(inviteId, userId);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Invite resent successfully'
  });
});
