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
  const { emails, inviteEntries } = req.body;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const results = await teamInviteService.createBatchInvites({
    teamId,
    invitedBy: userId,
    emails,
    inviteEntries
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
  const { token, inviteCode } = req.query;

  const inviteToken = typeof token === 'string' ? token : undefined;
  const normalizedInviteCode = typeof inviteCode === 'string' ? inviteCode : undefined;

  if (!inviteToken && !normalizedInviteCode) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Token or invite code is required');
  }

  const result = await teamInviteService.checkInvite({
    ...(inviteToken ? { token: inviteToken } : {}),
    ...(normalizedInviteCode ? { inviteCode: normalizedInviteCode } : {})
  });

  res.status(httpStatus.OK).json({
    success: true,
    data: result
  });
});

/**
 * POST /api/v1/team-invites/accept
 * Accept team invite with role selection
 * User must be authenticated and already exist
 */
export const acceptInvite = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { token, inviteCode, role, dateOfBirth } = req.body;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const result = await teamInviteService.acceptInvite({
    ...(token ? { token } : {}),
    ...(inviteCode ? { inviteCode } : {}),
    role,
    userId,
    dateOfBirth,
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Invite accepted and pending coach approval',
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
 * GET /api/v1/team-invites/my-invites
 * Get all invites for the authenticated user
 * Query params: status (optional) - filter by status: pending, accepted, declined, expired, cancelled
 */
export const getUserInvites = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { status } = req.query;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const invites = await teamInviteService.getUserInvites(
    userId,
    status as string | undefined
  );

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

/**
 * POST /api/v1/team-invites/:inviteId/approve
 * Coach approves accepted invite that is pending approval.
 * Coach can set/change final role in the same API call.
 */
export const approvePendingInvite = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { inviteId } = req.params;
  const { role } = req.body;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const result = await teamInviteService.approvePendingInvite({
    inviteId,
    approvedBy: userId,
    role,
  });

  const message = result.userRole.needsGuardianLink
    ? 'Pending invite approved successfully. Guardian linking is required before minor player can use player actions.'
    : 'Pending invite approved successfully';

  res.status(httpStatus.OK).json({
    success: true,
    message,
    data: result
  });
});

