import httpStatus from 'http-status';
import { Response } from 'express';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import { RequestWithContext } from 'types/request';
import * as guardianLinkService from './guardianLink.service';

/**
 * POST /api/v1/teams/:teamId/guardian-links
 * Request a guardian-player link within a team.
 *
 * - Role: player or guardian in the team
 */
export const requestGuardianLink = asyncWrapper(
  async (req: RequestWithContext, res: Response) => {
    const userId = req.user?._id;
    const teamId = req.teamId as string;
    const body = req.body as { playerId?: string; guardianId?: string };

    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }

    if (!teamId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
    }

    const link = await guardianLinkService.requestGuardianLink({
      teamId,
      requesterUserId: String(userId),
      guardianId: body.guardianId ? String(body.guardianId).trim() : undefined,
      playerId: body.playerId ? String(body.playerId).trim() : undefined
    });

    res.status(httpStatus.CREATED).json({
      success: true,
      data: link
    });
  }
);

/**
 * GET /api/v1/teams/:teamId/guardian-links
 * List guardian links visible to the current user in the team.
 *
 * - Coach/assistant: all guardian links in team
 * - Guardian: own links
 * - Player: links for themselves
 */
export const listGuardianLinks = asyncWrapper(
  async (req: RequestWithContext, res: Response) => {
    const userId = req.user?._id;
    const teamId = req.teamId as string;

    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }

    if (!teamId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
    }

    const links = await guardianLinkService.listGuardianLinksForUser({
      teamId,
      userId: String(userId)
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: links
    });
  }
);

/**
 * PUT /api/v1/teams/:teamId/guardian-links/:linkId/approve
 * Approve a pending guardian link.
 *
 * - Only the non-requesting side (guardian or player) can approve
 */
export const approveGuardianLink = asyncWrapper(
  async (req: RequestWithContext, res: Response) => {
    const userId = req.user?._id;
    const teamId = req.teamId as string;
    const { linkId } = req.params;

    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }

    if (!teamId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
    }

    if (!linkId || String(linkId).trim() === '') {
      throw new AppError(httpStatus.BAD_REQUEST, 'linkId is required');
    }

    const link = await guardianLinkService.approveGuardianLink({
      teamId,
      userId: String(userId),
      linkId: String(linkId).trim()
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: link
    });
  }
);

/**
 * PUT /api/v1/teams/:teamId/guardian-links/:linkId/reject
 * Reject a pending guardian link.
 *
 * - Only the non-requesting side (guardian or player) can reject
 */
export const rejectGuardianLink = asyncWrapper(
  async (req: RequestWithContext, res: Response) => {
    const userId = req.user?._id;
    const teamId = req.teamId as string;
    const { linkId } = req.params;

    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }

    if (!teamId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
    }

    if (!linkId || String(linkId).trim() === '') {
      throw new AppError(httpStatus.BAD_REQUEST, 'linkId is required');
    }

    const link = await guardianLinkService.rejectGuardianLink({
      teamId,
      userId: String(userId),
      linkId: String(linkId).trim()
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: link
    });
  }
);

/**
 * DELETE /api/v1/teams/:teamId/guardian-links/:linkId
 * Remove (deactivate) a guardian link.
 *
 * - Coach/assistant: can remove any link
 * - Guardian: can remove their own links
 */
export const removeGuardianLink = asyncWrapper(
  async (req: RequestWithContext, res: Response) => {
    const userId = req.user?._id;
    const teamId = req.teamId as string;
    const { linkId } = req.params;

    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }

    if (!teamId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
    }

    if (!linkId || String(linkId).trim() === '') {
      throw new AppError(httpStatus.BAD_REQUEST, 'linkId is required');
    }

    const link = await guardianLinkService.removeGuardianLink({
      teamId,
      userId: String(userId),
      linkId: String(linkId).trim()
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: link
    });
  }
);

