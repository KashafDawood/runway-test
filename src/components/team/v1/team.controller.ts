import { Request, Response } from 'express';
import httpStatus from 'http-status';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import { RoleName } from '@components/role/v1/role.interface';
import * as teamService from './team.service';

/**
 * POST /api/v1/teams
 * Create a new team
 * 
 * AUTHENTICATION: Required
 * EMAIL VERIFIED: Required (middleware)
 * CONSTRAINT: User must be a coach (or will become coach of new team)
 * 
 * @body name - Team name (required)
 * @body sport - Sport type (optional)
 * @body season - Season (optional)
 * @body color - Team color (optional)
 * @body settings - Team settings (optional)
 */
export const createTeam = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const { name, sport, season, color, logoPath, coverImagePath, settings } = req.body;

  const team = await teamService.createTeam(userId, {
    name,
    sport,
    season,
    color,
    logoPath,
    coverImagePath,
    settings
  });

  res.status(httpStatus.CREATED).json({
    success: true,
    message: 'Team created successfully',
    data: team
  });
});

/**
 * GET /api/v1/teams/:teamId
 * Get team details
 * 
 * AUTHENTICATION: Required
 * TEAM MEMBER: Required (any role)
 */
export const getTeam = asyncWrapper(async (req: Request, res: Response) => {
  const { teamId } = req.params;

  const team = await teamService.getTeamById(teamId);

  res.status(httpStatus.OK).json({
    success: true,
    data: team
  });
});

/**
 * GET /api/v1/teams
 * Get all teams for authenticated user
 * 
 * AUTHENTICATION: Required
 */
export const getMyTeams = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const teams = await teamService.getUserTeams(userId);

  res.status(httpStatus.OK).json({
    success: true,
    data: teams
  });
});

/**
 * PUT /api/v1/teams/:teamId
 * Update team
 * 
 * AUTHENTICATION: Required
 * EMAIL VERIFIED: Required
 * TEAM COACH: Required
 */
export const updateTeam = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { teamId } = req.params;
  const { name, sport, season, color, logoPath, coverImagePath, settings } = req.body;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const team = await teamService.updateTeam(teamId, userId, {
    name,
    sport,
    season,
    color,
    logoPath,
    coverImagePath,
    settings
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Team updated successfully',
    data: team
  });
});

/**
 * DELETE /api/v1/teams/:teamId
 * Delete team (only creator)
 * 
 * AUTHENTICATION: Required
 * EMAIL VERIFIED: Required
 * TEAM CREATOR: Required
 */
export const deleteTeam = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { teamId } = req.params;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  await teamService.deleteTeam(teamId, userId);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Team deleted successfully'
  });
});

/**
 * POST /api/v1/teams/:teamId/members
 * Add member to team
 * 
 * AUTHENTICATION: Required
 * EMAIL VERIFIED: Required
 * TEAM COACH: Required
 * 
 * @body memberId - User ID to add (required)
 * @body role - Role to assign (optional, default: PLAYER)
 */
export const addTeamMember = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { teamId } = req.params;
  const { memberId, role } = req.body;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  if (!memberId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Member ID is required');
  }

  await teamService.addTeamMember(teamId, userId, memberId, role || RoleName.PLAYER);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Team member added successfully'
  });
});