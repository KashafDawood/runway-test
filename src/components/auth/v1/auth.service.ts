import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import httpStatus from 'http-status';
import UserModel from '@components/user/v1/user.model';
import { IUser } from '@components/user/v1/user.interface';
import { Team } from '@components/team/v1/team.model';
import { Role } from '@components/role/v1/role.model';
import { UserRole } from '@components/userRole/v1/userRole.model';
import { RoleName } from '@components/role/v1/role.interface';
import { UserRoleStatus } from '@components/userRole/v1/userRole.interface';
import TokenModel from './token.model';
import { TOKEN_TYPES, TOKEN_EXPIRY } from './auth.constants';
import { genAccessToken } from '@shared/services/jwt';
import { sendEmail } from '@shared/services/mail';
import AppError from '@core/utils/appError';
import config from '@config/config';
import logger from '@core/utils/logger';

interface ISignUpInput {
  email: string;
  password: string;
  name: string;
  teamName?: string; // Optional - coach can create team later
  sport?: string;
  season?: string;
}

interface IAuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    email_verified: boolean;
    avatar?: string;
  };
  team?: {
    id: string;
    name: string;
    role: RoleName;
  };
  token: string;
  verificationToken?: string; // For testing email verification
}

export const signUp = async (input: ISignUpInput): Promise<IAuthResponse> => {
  const { email, password, name, teamName, sport, season } = input;

  // Check if user already exists
  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    throw new AppError(httpStatus.CONFLICT, 'User with this email already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await UserModel.create({
    name,
    email,
    password: hashedPassword,
    email_verified: false,
  });

  let team;
  let userRole;

  // Create team if teamName provided (optional)
  if (teamName) {
    // Get coach role
    const coachRole = await Role.findOne({ name: RoleName.COACH });
    if (!coachRole) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Coach role not found. Please run database seeder.'
      );
    }

    // Create team
    team = await Team.create({
      name: teamName,
      sport: sport || '',
      season: season || '',
      createdBy: user._id,
      settings: {
        allowPlayerInvites: false,
        requireGuardianApproval: true
      }
    });

    // Assign coach role to user in team
    userRole = await UserRole.create({
      userId: user._id,
      teamId: team._id,
      roleId: coachRole._id,
      roleName: RoleName.COACH,
      status: UserRoleStatus.ACTIVE,
      joinedAt: new Date()
    });
  }

  // Generate email verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.EMAIL_VERIFICATION);

  await TokenModel.create({
    user: user._id,
    token: verificationToken,
    type: TOKEN_TYPES.EMAIL_VERIFICATION,
    expires_at: expiresAt,
  });

  // Send verification email
  const verificationUrl = `${config.app.frontEndUrl}/verify-email?token=${verificationToken}`;
  try {
    await sendEmail('verifyEmail', email, {
      name: user.name,
      url: verificationUrl,
    });
  } catch (error) {
    logger.error('Failed to send verification email', error);
    // Don't fail signup if email fails
  }

  // Generate JWT
  const token = await genAccessToken(user._id, {
    email: user.email,
    email_verified: user.email_verified,
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      email_verified: user.email_verified,
      avatar: user.avatar,
    },
    team: team ? {
      id: team._id,
      name: team.name,
      role: RoleName.COACH
    } : undefined,
    token,
    verificationToken: config.app.isDev ? verificationToken : undefined,
  };
};

export const signIn = async (email: string, password: string): Promise<IAuthResponse> => {
  // Find user with password
  const user = await UserModel.findOne({ email }).select('+password');

  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  // Generate JWT
  const token = await genAccessToken(user._id, {
    email: user.email,
    email_verified: user.email_verified,
  });

  // Get user's teams (optional, for convenience)
  const userTeams = await UserRole.find({
    userId: user._id,
    status: UserRoleStatus.ACTIVE
  })
    .populate('teamId', 'name sport season')
    .limit(1); // Get first team for backward compatibility

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      email_verified: user.email_verified,
      avatar: user.avatar,
    },
    team: userTeams[0] ? {
      id: (userTeams[0].teamId as any)._id,
      name: (userTeams[0].teamId as any).name,
      role: userTeams[0].roleName
    } : undefined,
    token,
  };
};

export const verifyEmail = async (token: string): Promise<IAuthResponse> => {
  // Find token
  const tokenDoc = await TokenModel.findOne({
    token,
    type: TOKEN_TYPES.EMAIL_VERIFICATION,
    expires_at: { $gt: new Date() },
  });

  if (!tokenDoc) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired verification token');
  }

  // Update user
  const user = await UserModel.findByIdAndUpdate(
    tokenDoc.user,
    { email_verified: true },
    { new: true }
  );

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Delete token
  await TokenModel.deleteOne({ _id: tokenDoc._id });

  // Generate new JWT with updated email_verified status
  const jwtToken = await genAccessToken(user._id, {
    email: user.email,
    email_verified: user.email_verified,
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      email_verified: user.email_verified,
      avatar: user.avatar,
    },
    token: jwtToken,
  };
};

export const resendVerificationEmail = async (userId: string): Promise<void> => {
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.email_verified) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Email already verified');
  }

  // Delete old verification tokens
  await TokenModel.deleteMany({
    user: userId,
    type: TOKEN_TYPES.EMAIL_VERIFICATION,
  });

  // Generate new token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.EMAIL_VERIFICATION);

  await TokenModel.create({
    user: user._id,
    token: verificationToken,
    type: TOKEN_TYPES.EMAIL_VERIFICATION,
    expires_at: expiresAt,
  });

  // Send email
  const verificationUrl = `${config.app.frontEndUrl}/verify-email?token=${verificationToken}`;
  await sendEmail('verifyEmail', user.email, {
    name: user.name,
    url: verificationUrl,
  });
};

export const forgotPassword = async (email: string): Promise<{ ResetToken: string } | void> => {
  const user = await UserModel.findOne({ email });

  // Don't reveal if user exists or not
  if (!user) {
    return;
  }

  // Delete old reset tokens
  await TokenModel.deleteMany({
    user: user._id,
    type: TOKEN_TYPES.PASSWORD_RESET,
  });

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.PASSWORD_RESET);

  await TokenModel.create({
    user: user._id,
    token: resetToken,
    type: TOKEN_TYPES.PASSWORD_RESET,
    expires_at: expiresAt,
  });

  // Send email
  const resetUrl = `${config.app.frontEndUrl}/reset-password?token=${resetToken}`;
  try {
    await sendEmail('changePassword', user.email, {
      name: user.name,
      url: resetUrl,
    });
    return {
        ResetToken: resetToken,
    }
  } catch (error) {
    logger.error('Failed to send password reset email', error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to send password reset email');
  }
};

export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  // Find token
  const tokenDoc = await TokenModel.findOne({
    token,
    type: TOKEN_TYPES.PASSWORD_RESET,
    expires_at: { $gt: new Date() },
  });

  if (!tokenDoc) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired password reset token');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update user password
  await UserModel.findByIdAndUpdate(tokenDoc.user, {
    password: hashedPassword,
  });

  // Delete all reset tokens for this user
  await TokenModel.deleteMany({
    user: tokenDoc.user,
    type: TOKEN_TYPES.PASSWORD_RESET,
  });
};

export const getUserProfile = async (userId: string): Promise<IUser> => {
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

/**
 * Get user's active team (with membership validation)
 */
export const getActiveTeam = async (userId: string) => {
  const user = await UserModel.findById(userId)
    .select('activeTeamId')
    .populate('activeTeamId', 'name sport season');

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.activeTeamId) {
    return null;
  }

  // Verify user is still an active member of this team
  const userRole = await UserRole.findOne({
    userId: user._id,
    teamId: user.activeTeamId,
    status: UserRoleStatus.ACTIVE,
  });

  if (!userRole) {
    // User is no longer a member of the active team, clear it
    await UserModel.findByIdAndUpdate(userId, { activeTeamId: null });
    return null;
  }

  const teamDoc = user.activeTeamId as any;

  return {
    id: teamDoc._id,
    name: teamDoc.name,
    sport: teamDoc.sport,
    season: teamDoc.season,
    role: userRole.roleName,
  };
};

/**
 * Set user's active team
 * Validates that user is an active member of the team before setting
 */
export const setActiveTeam = async (userId: string, teamId: string) => {
  // Verify user exists
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Verify team exists
  const team = await Team.findById(teamId);
  if (!team) {
    throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  }

  // Verify user is an active member of this team
  const userRole = await UserRole.findOne({
    userId: user._id,
    teamId,
    status: UserRoleStatus.ACTIVE,
  });

  if (!userRole) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not a member of this team',
    );
  }

  // Update user's active team
  await UserModel.findByIdAndUpdate(userId, { activeTeamId: teamId });

  return {
    id: team._id,
    name: team.name,
    sport: team.sport,
    season: team.season,
    role: userRole.roleName,
  };
};
