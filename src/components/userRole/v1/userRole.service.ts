import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { UserRole } from './userRole.model';
import { UserRoleStatus } from './userRole.interface';
import { RoleName } from '../../role/v1/role.interface';
import { Role as RoleModel } from '../../role/v1/role.model';
import AppError from '@core/utils/appError';
import UserModel from '../../user/v1/user.model';
import { Team } from '../../team/v1/team.model';

interface IUpdateRoleInput {
  teamId: string;
  userId: string;
  newRoleName: RoleName;
  updatedBy: string; // Coach who is making the change
}

interface IUpdateRoleResult {
  userRole: any;
  previousRole: RoleName;
  newRole: RoleName;
}

/**
 * Update user's role in a team
 * Only coaches can change roles
 * Prevents invalid role transitions
 * Preserves all existing data (no data loss)
 */
export const updateUserRole = async (
  input: IUpdateRoleInput
): Promise<IUpdateRoleResult> => {
  const { teamId, userId, newRoleName, updatedBy } = input;

  // 1. Verify the user making the change is a coach in the team
  const coachUserRole = await UserRole.findOne({
    userId: updatedBy,
    teamId: teamId,
    status: UserRoleStatus.ACTIVE,
  });

  if (!coachUserRole) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You must be a member of this team to change roles'
    );
  }

  // Check if the user is a coach or assistant coach
  const isAdmin =
    coachUserRole.roleName === RoleName.COACH ||
    coachUserRole.roleName === RoleName.ASSISTANT_COACH;

  if (!isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only coaches can change user roles'
    );
  }

  // 2. Verify the target user exists
  const targetUser = await UserModel.findById(userId);
  if (!targetUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // 3. Verify the team exists
  const team = await Team.findById(teamId);
  if (!team) {
    throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  }

  // 4. Verify the target user is a member of the team
  const existingUserRole = await UserRole.findOne({
    userId: userId,
    teamId: teamId,
    status: UserRoleStatus.ACTIVE,
  });

  if (!existingUserRole) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'User is not an active member of this team'
    );
  }

  // 5. Prevent changing own role (coach can't demote themselves)
  if (userId === updatedBy) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You cannot change your own role'
    );
  }

  // 6. Prevent changing role to the same role
  if (existingUserRole.roleName === newRoleName) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `User already has the role: ${newRoleName}`
    );
  }

  // 7. Validate the new role exists
  const newRole = await RoleModel.findOne({ name: newRoleName });
  if (!newRole) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid role: ${newRoleName}`
    );
  }

  // 8. Prevent invalid role transitions
  // Business rule: Can't change from coach to another role if they're the only coach
  // (This prevents removing the last coach from a team)
  if (existingUserRole.roleName === RoleName.COACH) {
    const coachCount = await UserRole.countDocuments({
      teamId: teamId,
      roleName: RoleName.COACH,
      status: UserRoleStatus.ACTIVE,
    });

    if (coachCount === 1 && newRoleName !== RoleName.COACH) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Cannot change role: Team must have at least one coach'
      );
    }
  }

  // 8b. SECURITY: Prevent adding multiple coaches to a team
  // Each team can only have ONE coach
  if (newRoleName === RoleName.COACH && existingUserRole.roleName !== RoleName.COACH) {
    const existingCoach = await UserRole.findOne({
      teamId: teamId,
      roleName: RoleName.COACH,
      status: UserRoleStatus.ACTIVE,
    });

    if (existingCoach) {
      throw new AppError(
        httpStatus.CONFLICT,
        'This team already has a coach. Only one coach is allowed per team.'
      );
    }
  }

  // 9. Store previous role for response
  const previousRole = existingUserRole.roleName;

  // 10. Update the user role (preserve all other fields)
  existingUserRole.roleId = new mongoose.Types.ObjectId(newRole._id);
  existingUserRole.roleName = newRoleName;
  // Preserve: userId, teamId, status, invitedBy, invitedAt, joinedAt, removedAt, timestamps
  await existingUserRole.save();

  // 11. Return updated user role with populated fields
  const updatedUserRole = await UserRole.findById(existingUserRole._id)
    .populate('userId', 'name email avatar')
    .populate('roleId', 'name displayName description');

  return {
    userRole: updatedUserRole,
    previousRole,
    newRole: newRoleName,
  };
};

/**
 * Get user's role in a team
 */
export const getUserRoleInTeam = async (
  userId: string,
  teamId: string
): Promise<any> => {
  const userRole = await UserRole.findOne({
    userId: userId,
    teamId: teamId,
    status: UserRoleStatus.ACTIVE,
  })
    .populate('userId', 'name email avatar')
    .populate('roleId', 'name displayName description')
    .populate('teamId', 'name sport season');

  return userRole;
};
