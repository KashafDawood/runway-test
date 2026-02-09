import { Team } from './team.model';
import { UserRole } from '@components/userRole/v1/userRole.model';
import { RoleName } from '@components/role/v1/role.interface';
import { Role } from '@components/role/v1/role.model';
import { UserRoleStatus } from '@components/userRole/v1/userRole.interface';
import AppError from '@core/utils/appError';
import httpStatus from 'http-status';
import logger from '@core/utils/logger';
import { ITeam } from './team.interface';

interface ICreateTeamInput {
  name: string;
  sport?: string;
  season?: string;
  color?: string;
  settings?: {
    allowPlayerInvites?: boolean;
    requireGuardianApproval?: boolean;
  };
}

interface IUpdateTeamInput {
  name?: string;
  sport?: string;
  season?: string;
  color?: string;
  settings?: {
    allowPlayerInvites?: boolean;
    requireGuardianApproval?: boolean;
  };
}

interface ITeamResponse {
  id: string;
  name: string;
  sport?: string;
  season?: string;
  color?: string;
  createdBy: string;
  settings: {
    allowPlayerInvites: boolean;
    requireGuardianApproval: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new team
 * CONSTRAINT: Only verified coaches can create teams
 * 
 * @param userId - User ID (coach)
 * @param data - Team data
 * @returns Created team document
 */
export const createTeam = async (
  userId: string,
  data: ICreateTeamInput
): Promise<ITeamResponse> => {
  const coachRole = await Role.findOne({ name: RoleName.COACH });
  if (!coachRole) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Coach role not found. Please run role seeder.');
  }

  // Create team with user as creator
  const team = await Team.create({
    name: data.name,
    sport: data.sport,
    season: data.season,
    color: data.color,
    settings: data.settings || {
      allowPlayerInvites: false,
      requireGuardianApproval: true
    },
    createdBy: userId
  });

  // Add creator as COACH with active status
  await UserRole.create({
    userId,
    teamId: team._id,
    roleId: coachRole._id,
    roleName: RoleName.COACH,
    status: UserRoleStatus.ACTIVE,
    joinedAt: new Date()
  });

  logger.info(`Team created: ${team._id} by user ${userId}`);

  return {
    id: team._id,
    name: team.name,
    sport: team.sport,
    season: team.season,
    color: team.color,
    createdBy: team.createdBy.toString(),
    settings: team.settings,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt
  };
};

/**
 * Get team by ID
 * @param teamId - Team ID
 * @returns Team document
 */
export const getTeamById = async (teamId: string): Promise<ITeam> => {
  const team = await Team.findById(teamId).populate('createdBy', 'name email');

  if (!team) {
    throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  }

  return team;
};

/**
 * Get all teams where user is a member
 * @param userId - User ID
 * @returns Array of teams
 */
export const getUserTeams = async (userId: string): Promise<ITeam[]> => {
  // Get all active user roles
  const userRoles = await UserRole.find({
    userId,
    status: UserRoleStatus.ACTIVE
  }).select('teamId');

  if (userRoles.length === 0) {
    return [];
  }

  const teamIds = userRoles.map(ur => ur.teamId);

  // Fetch teams
  const teams = await Team.find({
    _id: { $in: teamIds }
  }).populate('createdBy', 'name email');

  return teams;
};

/**
 * Update team
 * CONSTRAINT: Only coaches in team can update
 * 
 * @param teamId - Team ID
 * @param userId - User ID (must be coach in team)
 * @param data - Update data
 * @returns Updated team
 */
export const updateTeam = async (
  teamId: string,
  userId: string,
  data: IUpdateTeamInput
): Promise<ITeamResponse> => {
  const team = await getTeamById(teamId);

  // Check if user is coach in this team
  const userRole = await UserRole.findOne({
    userId,
    teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (!userRole || userRole.roleName !== RoleName.COACH) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only coaches can update team'
    );
  }

  // Update allowed fields
  const updateData: Partial<ITeam> = {};
  if (data.name) updateData.name = data.name;
  if (data.sport) updateData.sport = data.sport;
  if (data.season) updateData.season = data.season;
  if (data.color) updateData.color = data.color;
  if (data.settings) {
    updateData.settings = { ...team.settings, ...data.settings };
  }

  const updatedTeam = await Team.findByIdAndUpdate(teamId, updateData, { new: true });

  if (!updatedTeam) {
    throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  }

  logger.info(`Team updated: ${teamId} by user ${userId}`);

  return {
    id: updatedTeam._id,
    name: updatedTeam.name,
    sport: updatedTeam.sport,
    season: updatedTeam.season,
    color: updatedTeam.color,
    createdBy: updatedTeam.createdBy.toString(),
    settings: updatedTeam.settings,
    createdAt: updatedTeam.createdAt,
    updatedAt: updatedTeam.updatedAt
  };
};

/**
 * Delete team
 * CONSTRAINT: Only creator can delete
 * 
 * @param teamId - Team ID
 * @param userId - User ID (must be creator)
 */
export const deleteTeam = async (teamId: string, userId: string): Promise<void> => {
  // Get team without populating to compare ObjectIds directly
  const team = await Team.findById(teamId);

  if (!team) {
    throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  }

  // Only creator can delete - use equals() for ObjectId comparison
  if (!team.createdBy.equals(userId)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only team creator can delete team'
    );
  }

  // Delete team and all associated roles
  await Team.deleteOne({ _id: teamId });
  await UserRole.deleteMany({ teamId });

  logger.info(`Team deleted: ${teamId} by user ${userId}`);
};

/**
 * Add member to team
 * CONSTRAINT: Only coaches can add members
 * 
 * @param teamId - Team ID
 * @param userId - User adding member (coach)
 * @param newMemberId - User being added
 * @param role - Role to assign
 */
export const addTeamMember = async (
  teamId: string,
  userId: string,
  newMemberId: string,
  role: RoleName
): Promise<void> => {
  // Verify team exists
  await getTeamById(teamId);

  // Verify actor is coach
  const actorRole = await UserRole.findOne({
    userId,
    teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (!actorRole || actorRole.roleName !== RoleName.COACH) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only coaches can add team members'
    );
  }

  // Check if member already exists
  const existingMember = await UserRole.findOne({
    userId: newMemberId,
    teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (existingMember) {
    throw new AppError(
      httpStatus.CONFLICT,
      'User is already a member of this team'
    );
  }

  // SECURITY: Prevent adding multiple coaches to a team
  // Each team can only have ONE coach
  if (role === RoleName.COACH) {
    const existingCoach = await UserRole.findOne({
      teamId,
      roleName: RoleName.COACH,
      status: UserRoleStatus.ACTIVE
    });

    if (existingCoach) {
      throw new AppError(
        httpStatus.CONFLICT,
        'This team already has a coach. Only one coach is allowed per team.'
      );
    }
  }

  // Add member with specified role
  const roleDoc = await Role.findOne({ name: role });
  if (!roleDoc) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid role provided');
  }

  await UserRole.create({
    userId: newMemberId,
    teamId,
    roleId: roleDoc._id,
    roleName: role,
    status: UserRoleStatus.ACTIVE,
    joinedAt: new Date()
  });

  logger.info(`Member ${newMemberId} added to team ${teamId} by ${userId}`);
};
