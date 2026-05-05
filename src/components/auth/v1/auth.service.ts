import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import httpStatus from 'http-status';
import UserModel from '@components/user/v1/user.model';
import { IUser } from '@components/user/v1/user.interface';
import { Team } from '@components/team/v1/team.model';
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
import { computeNeedsGuardianLink } from '@components/player/v1/playerOnboarding.util';

interface ISignUpInput {
  email: string;
  password: string;
  name: string;
  dateOfBirth?: Date | string;
  skipEmailVerification?: boolean;
}

interface ISignUpResponse {
  user: {
    id: string;
    name: string;
    email: string;
    email_verified: boolean;
    avatar?: string;
    dateOfBirth?: Date | string;
  };
  token: string;
  verificationCode?: string; // For testing email verification
}
interface IAuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    email_verified: boolean;
    avatar?: string;
    dateOfBirth?: Date | string;
  };
  team?: {
    id: string;
    name: string;
    role: RoleName;
    sport?: string;
    season?: string;
    needsGuardianLink?: boolean;
  };
  token: string;
  verificationCode?: string; // For testing email verification
}

/**
 * Generate a random 6 digit verification code
 */
const generateVerificationCode = (): string => {
  // Generate a random 6-digit number (100000 to 999999)
  const min = 100000;
  const max = 999999;
  const code = Math.floor(Math.random() * (max - min + 1)) + min;
  return code.toString();
}

export const signUp = async (input: ISignUpInput): Promise<ISignUpResponse> => {
  const { email, password, name, dateOfBirth, skipEmailVerification = false } = input;

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
    email_verified: skipEmailVerification,
    ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {})
  });

  // No role assignment at signup - roles will be assigned after verification
  // via "create team" (COACH) or "join team" (PLAYER) actions

  let verificationCode: string | undefined;
  if (!skipEmailVerification) {
    // Generate email verification code (4-6 digits)
    verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.EMAIL_VERIFICATION);

    await TokenModel.create({
      user: user._id,
      token: verificationCode,
      type: TOKEN_TYPES.EMAIL_VERIFICATION,
      expires_at: expiresAt,
    });

    // Send verification email
    try {
      await sendEmail('verifyEmail', email, {
        name: user.name,
        code: verificationCode,
      });
    } catch (error) {
      logger.error('Failed to send verification email', error);
      // Don't fail signup if email fails
    }
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
      dateOfBirth: user.dateOfBirth,
    },
    token,
    verificationCode: !skipEmailVerification && config.app.isDev ? verificationCode : undefined,
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

  const userRecord = await UserModel.findById(user._id).select('activeTeamId');
  const preferredTeamId = userRecord?.activeTeamId;

  let membership = null;
  if (preferredTeamId) {
    membership = await UserRole.findOne({
      userId: user._id,
      teamId: preferredTeamId,
      status: UserRoleStatus.ACTIVE
    }).populate('teamId', 'name sport season');
  }
  if (!membership) {
    membership = await UserRole.findOne({
      userId: user._id,
      status: UserRoleStatus.ACTIVE
    })
      .sort({ joinedAt: -1 })
      .populate('teamId', 'name sport season');
  }

  let sessionTeam: IAuthResponse['team'];
  if (membership?.teamId) {
    const teamDoc = membership.teamId as unknown as {
      _id: string;
      name: string;
      sport?: string;
      season?: string;
    };
    const needsGuardianLink =
      membership.roleName === RoleName.PLAYER
        ? await computeNeedsGuardianLink(user._id.toString(), teamDoc._id.toString())
        : false;

    sessionTeam = {
      id: teamDoc._id.toString(),
      name: teamDoc.name,
      sport: teamDoc.sport,
      season: teamDoc.season,
      role: membership.roleName,
      ...(membership.roleName === RoleName.PLAYER ? { needsGuardianLink } : {})
    };
  }

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      email_verified: user.email_verified,
      avatar: user.avatar,
      dateOfBirth: user.dateOfBirth,
    },
    ...(sessionTeam ? { team: sessionTeam } : {}),
    token,
  };
};

export const verifyEmail = async (code: string, email: string): Promise<IAuthResponse> => {
  // Find user by email
  const user = await UserModel.findOne({ email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Find verification code
  const tokenDoc = await TokenModel.findOne({
    user: user._id,
    token: code,
    type: TOKEN_TYPES.EMAIL_VERIFICATION,
    expires_at: { $gt: new Date() },
  });

  if (!tokenDoc) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired verification code');
  }

  // Update user
  const updatedUser = await UserModel.findByIdAndUpdate(
    user._id,
    { email_verified: true },
    { new: true }
  );

  if (!updatedUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Delete token
  await TokenModel.deleteOne({ _id: tokenDoc._id });

  // Generate new JWT with updated email_verified status
  const jwtToken = await genAccessToken(updatedUser._id, {
    email: updatedUser.email,
    email_verified: updatedUser.email_verified,
  });

  return {
    user: {
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      email_verified: updatedUser.email_verified,
      avatar: updatedUser.avatar,
      dateOfBirth: updatedUser.dateOfBirth,
    },
    token: jwtToken,
  };
};

export const resendVerificationEmail = async (userIdOrEmail?: string, email?: string): Promise<void> => {
  let user;
  
  // If email is provided, find by email (for unauthenticated requests)
  if (email) {
    user = await UserModel.findOne({ email });
  } else if (userIdOrEmail) {
    // Otherwise, find by userId (for authenticated requests)
    user = await UserModel.findById(userIdOrEmail);
  } else {
    throw new AppError(httpStatus.BAD_REQUEST, 'User identifier is required');
  }

  if (!user) {
    // Don't reveal if user exists for security
    return;
  }

  if (user.email_verified) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Email already verified');
  }

  // Delete old verification codes
  await TokenModel.deleteMany({
    user: user._id,
    type: TOKEN_TYPES.EMAIL_VERIFICATION,
  });

  // Generate new verification code (4-6 digits)
  const verificationCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.EMAIL_VERIFICATION);

  await TokenModel.create({
    user: user._id,
    token: verificationCode,
    type: TOKEN_TYPES.EMAIL_VERIFICATION,
    expires_at: expiresAt,
  });

  // Send email
  await sendEmail('verifyEmail', user.email, {
    name: user.name,
    code: verificationCode,
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

  const teamDoc = user.activeTeamId as unknown as { _id: string; name: string; sport?: string; season?: string };

  const needsGuardianLink =
    userRole.roleName === RoleName.PLAYER
      ? await computeNeedsGuardianLink(user._id.toString(), teamDoc._id.toString())
      : false;

  return {
    id: teamDoc._id,
    name: teamDoc.name,
    sport: teamDoc.sport,
    season: teamDoc.season,
    role: userRole.roleName,
    ...(userRole.roleName === RoleName.PLAYER ? { needsGuardianLink } : {})
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

  const needsGuardianLink =
    userRole.roleName === RoleName.PLAYER
      ? await computeNeedsGuardianLink(userId, team._id.toString())
      : false;

  return {
    id: team._id,
    name: team.name,
    sport: team.sport,
    season: team.season,
    role: userRole.roleName,
    ...(userRole.roleName === RoleName.PLAYER ? { needsGuardianLink } : {})
  };
};


