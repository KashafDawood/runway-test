import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { TeamInvite } from './teamInvite.model';
import { InviteStatus, ITeamInvite } from './teamInvite.interface';
import { Team } from '@components/team/v1/team.model';
import { UserRole } from '@components/userRole/v1/userRole.model';
import { Role } from '@components/role/v1/role.model';
import UserModel from '@components/user/v1/user.model';
import { RoleName } from '@components/role/v1/role.interface';
import { UserRoleStatus } from '@components/userRole/v1/userRole.interface';
import { Player } from '@components/player/v1/player.model';
import { sendEmail } from '@shared/services/mail';
import AppError from '@core/utils/appError';
import httpStatus from 'http-status';
import logger from '@core/utils/logger';
import config from '@config/config';
import { INVITE_EXPIRY_MS, INVITE_ERRORS } from './teamInvite.constants';

interface ICreateBatchInviteInput {
  teamId: string;
  invitedBy: string; // Coach user ID
  emails: string[]; // Array of emails (max 20)
}

interface ICheckInviteInput {
  token: string;
}

interface ICompleteRegistrationInput {
  token: string;
  name: string;
  password: string;
  phone?: string;
}

interface IAcceptInviteInput {
  token: string;
  role: RoleName; // User chooses role
  userId?: string; // For existing users (if authenticated)
  userData?: {
    name?: string;
    password?: string;
    phone?: string;
  }; // Optional user data for auto-registration
}

interface IBatchInviteResult {
  success: ITeamInvite[];
  failed: Array<{
    email: string;
    reason: string;
  }>;
}

/**
 * Create batch team invites (up to 20)
 * NO ROLE specified - user chooses when accepting
 * Optimized: Uses batch DB queries and async email queue
 */
export const createBatchInvites = async (
  data: ICreateBatchInviteInput
): Promise<IBatchInviteResult> => {
  const { teamId, invitedBy, emails } = data;

  // Validate email count
  if (emails.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'At least one email is required');
  }

  if (emails.length > 20) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Maximum 20 emails allowed per batch');
  }

  // Verify team exists
  const team = await Team.findById(teamId);
  if (!team) {
    throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  }

  // Verify inviter is a coach in this team
  const inviterRole = await UserRole.findOne({
    userId: invitedBy,
    teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (!inviterRole || inviterRole.roleName !== RoleName.COACH) {
    throw new AppError(httpStatus.FORBIDDEN, INVITE_ERRORS.NOT_COACH);
  }

  // Get inviter details for email
  const inviter = await UserModel.findById(invitedBy);
  if (!inviter) {
    throw new AppError(httpStatus.NOT_FOUND, 'Inviter not found');
  }

  const results: IBatchInviteResult = {
    success: [],
    failed: []
  };

  // Normalize and validate email format
  const normalizedEmails = emails.map(e => e.toLowerCase().trim());
  const validEmails: string[] = [];
  const invalidEmails: string[] = [];

  for (const email of normalizedEmails) {
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      invalidEmails.push(email);
      results.failed.push({
        email,
        reason: 'Invalid email format'
      });
    } else {
      validEmails.push(email);
    }
  }

  if (validEmails.length === 0) {
    return results;
  }

  // OPTIMIZATION: Batch Database Queries (Instead of N queries, use 4 queries)

  // Query 1: Get all existing users at once
  const existingUsers = await UserModel.find({ email: { $in: validEmails } });
  const existingUserMap = new Map(existingUsers.map(u => [u.email.toLowerCase(), u]));

  // Query 2: Check all memberships at once
  const existingUserIds = existingUsers.map(u => u._id);
  const memberships = await UserRole.find({
    userId: { $in: existingUserIds },
    teamId,
    status: UserRoleStatus.ACTIVE
  });
  const membershipMap = new Map(memberships.map(m => [m.userId.toString(), true]));

  // Query 3: Check all pending invites at once
  const pendingInvites = await TeamInvite.find({
    teamId,
    email: { $in: validEmails },
    status: InviteStatus.PENDING,
    expiresAt: { $gt: new Date() }
  });
  const pendingInviteMap = new Map(pendingInvites.map(i => [i.email, true]));

  // Process emails and collect for batch creation
  const invitesToCreate: any[] = [];
  const emailsToSend: Array<{ to: string; template: string; data: Record<string, any> }> = [];

  for (const email of validEmails) {
    try {
      // Check if inviter is trying to invite themselves
      if (inviter.email.toLowerCase() === email) {
        results.failed.push({
          email,
          reason: INVITE_ERRORS.SELF_INVITE
        });
        continue;
      }

      // Check if user exists and is already a member
      const existingUser = existingUserMap.get(email);
      if (existingUser && membershipMap.has(existingUser._id.toString())) {
        results.failed.push({
          email,
          reason: INVITE_ERRORS.ALREADY_MEMBER
        });
        continue;
      }

      // Check if pending invite already exists
      if (pendingInviteMap.has(email)) {
        results.failed.push({
          email,
          reason: INVITE_ERRORS.PENDING_INVITE_EXISTS
        });
        continue;
      }

      // Generate secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

      // Add to batch creation array
      invitesToCreate.push({
        teamId,
        invitedBy,
        email,
        status: InviteStatus.PENDING,
        token,
        expiresAt
      });

      // Queue email for async sending
      const inviteUrl = `${config.app.frontEndUrl}/team/invite/accept?token=${token}`;
      emailsToSend.push({
        to: email,
        template: 'teamInvite',
        data: {
          teamName: team.name,
          inviterName: inviter.name,
          inviteUrl,
          expiresInDays: Math.floor(INVITE_EXPIRY_MS / (24 * 60 * 60 * 1000))
        }
      });

    } catch (error: any) {
      results.failed.push({
        email,
        reason: error.message || 'Failed to process email'
      });
    }
  }

  // Query 4: Create all invites at once
  if (invitesToCreate.length > 0) {
    try {
      const createdInvites = await TeamInvite.insertMany(invitesToCreate);
      results.success = createdInvites as any;

      logger.info(`Batch invites created: ${createdInvites.length} invites for team ${teamId}`);

      // Send all emails in parallel (non-blocking) with per-email error capture
      if (emailsToSend.length > 0) {
        Promise.allSettled(
          emailsToSend.map((email) =>
            sendEmail(email.template, email.to, email.data).catch((error) => {
              logger.error(`Failed to send invite email to ${email.to}: ${error.message}`);
              return null;
            })
          )
        ).catch((err) => {
          logger.error('Unexpected error sending invite emails', err);
        });
      }

    } catch (error: any) {
      logger.error('Failed to create batch invites', error);
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to create invites: ' + error.message
      );
    }
  }

  return results;
};

/**
 * Check invite and determine if user needs to register
 * PUBLIC endpoint - no auth required
 */
export const checkInvite = async (data: ICheckInviteInput): Promise<{
  invite: ITeamInvite;
  requiresRegistration: boolean;
  userExists: boolean;
}> => {
  const { token } = data;

  // Find invite by token
  const invite = await TeamInvite.findOne({ token })
    .populate('teamId', 'name sport season')
    .populate('invitedBy', 'name email');

  if (!invite) {
    throw new AppError(httpStatus.NOT_FOUND, INVITE_ERRORS.NOT_FOUND);
  }

  // Check if invite is pending
  if (invite.status !== InviteStatus.PENDING) {
    if (invite.status === InviteStatus.ACCEPTED) {
      throw new AppError(httpStatus.CONFLICT, INVITE_ERRORS.ALREADY_ACCEPTED);
    }
    throw new AppError(httpStatus.BAD_REQUEST, 'Invite is no longer valid');
  }

  // Check if invite has expired
  if (invite.expiresAt < new Date()) {
    invite.status = InviteStatus.EXPIRED;
    await invite.save();
    throw new AppError(httpStatus.GONE, INVITE_ERRORS.EXPIRED);
  }

  // Check if user exists
  const existingUser = await UserModel.findOne({ email: invite.email.toLowerCase() });
  
  return {
    invite,
    requiresRegistration: !existingUser,
    userExists: !!existingUser
  };
};

/**
 * Accept team invite with role selection
 * Auto-registers user if they don't exist (with optional userData)
 * For existing users: Can call directly (but must be authenticated)
 */
export const acceptInvite = async (data: IAcceptInviteInput): Promise<{
  invite: ITeamInvite;
  user: any;
  isNewUser: boolean;
}> => {
  const { token, role, userId, userData } = data;

  // Find invite by token
  const invite = await TeamInvite.findOne({ token })
    .populate('teamId', 'name sport season')
    .populate('invitedBy', 'name email');

  if (!invite) {
    throw new AppError(httpStatus.NOT_FOUND, INVITE_ERRORS.NOT_FOUND);
  }

  // Check if invite is pending
  if (invite.status !== InviteStatus.PENDING) {
    if (invite.status === InviteStatus.ACCEPTED) {
      throw new AppError(httpStatus.CONFLICT, INVITE_ERRORS.ALREADY_ACCEPTED);
    }
    throw new AppError(httpStatus.BAD_REQUEST, 'Invite is no longer valid');
  }

  // Check if invite has expired
  if (invite.expiresAt < new Date()) {
    invite.status = InviteStatus.EXPIRED;
    await invite.save();
    throw new AppError(httpStatus.GONE, INVITE_ERRORS.EXPIRED);
  }

  // Validate role
  const roleDoc = await Role.findOne({ name: role });
  if (!roleDoc) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid role selected');
  }

  // Get or find user, auto-register if needed
  let user;
  let isNewUser = false;

  if (userId) {
    // Existing authenticated user
    user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Verify email matches
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'This invite is for a different email address'
      );
    }

    // Optionally update profile data if provided
    let needsSave = false;
    if (userData?.name && !user.name) {
      user.name = userData.name;
      needsSave = true;
    }
    if (userData?.phone && !user.phone) {
      user.phone = userData.phone;
      needsSave = true;
    }
    
    // Ensure email is verified
    if (!user.email_verified) {
      user.email_verified = true;
      needsSave = true;
    }

    if (needsSave) {
      await user.save();
    }
  } else {
    // Check if user exists
    user = await UserModel.findOne({ email: invite.email.toLowerCase() });
    
    if (!user) {
      // AUTO-REGISTER: Create user if they don't exist
      isNewUser = true;

      // Generate random password if not provided (user can reset later)
      const passwordToUse = userData?.password || crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(passwordToUse, 10);

      // Use provided name or default to email prefix
      const userName = userData?.name || invite.email.split('@')[0];

      user = await UserModel.create({
        email: invite.email.toLowerCase(),
        name: userName,
        password: hashedPassword,
        email_verified: true, // Auto-verify email via invite
        phone: userData?.phone || undefined
      });

      logger.info(`Auto-registered user: ${user._id} (${user.email}) via team invite`);
    } else {
      // EXISTING USER: Optionally update profile data
      let needsSave = false;
      if (userData?.name && !user.name) {
        user.name = userData.name;
        needsSave = true;
      }
      if (userData?.phone && !user.phone) {
        user.phone = userData.phone;
        needsSave = true;
      }
      
      // Ensure email is verified (in case it wasn't before)
      if (!user.email_verified) {
        user.email_verified = true;
        needsSave = true;
      }

      if (needsSave) {
        await user.save();
      }
    }
  }

  // Check if user is already a member
  const existingMembership = await UserRole.findOne({
    userId: user._id,
    teamId: invite.teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (existingMembership) {
    // Mark invite as accepted anyway
    invite.status = InviteStatus.ACCEPTED;
    invite.acceptedBy = new Types.ObjectId(user._id);
    invite.acceptedRole = role;
    invite.acceptedAt = new Date();
    await invite.save();

    throw new AppError(httpStatus.CONFLICT, INVITE_ERRORS.ALREADY_MEMBER);
  }

  // Create UserRole (add user to team with chosen role)
  await UserRole.create({
    userId: user._id,
    teamId: invite.teamId,
    roleId: roleDoc._id,
    roleName: role,
    status: UserRoleStatus.ACTIVE,
    invitedBy: invite.invitedBy,
    invitedAt: invite.createdAt,
    joinedAt: new Date()
  });

  // When user accepts as PLAYER, create a roster (Player) record linked to their account so RSVP and other per-player features work
  if (role === RoleName.PLAYER) {
    const nameParts = (user.name || user.email?.split('@')[0] || 'Player').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Player';
    const lastName = nameParts.slice(1).join(' ') || ' ';
    await Player.create({
      userId: user._id,
      teamId: invite.teamId,
      firstName,
      lastName,
      hasEmail: true,
      createdBy: invite.invitedBy
    });
    logger.info(`Created roster (Player) record for user ${user._id} on team ${invite.teamId}`);
  }

  // Mark invite as accepted
  invite.status = InviteStatus.ACCEPTED;
  invite.acceptedBy = new Types.ObjectId(user._id);
  invite.acceptedRole = role;
  invite.acceptedAt = new Date();
  await invite.save();

  logger.info(
    `Invite accepted: ${invite._id} by user ${user._id} (${isNewUser ? 'NEW' : 'EXISTING'}) with role ${role}`
  );

  // Remove password from response
  const userObj = user.toObject();
  delete userObj.password;

  return {
    invite,
    user: userObj,
    isNewUser
  };
};

/**
 * Get all invites for a team (for coaches to see)
 */
export const getTeamInvites = async (
  teamId: string,
  userId: string
): Promise<ITeamInvite[]> => {
  // Verify user is coach
  const userRole = await UserRole.findOne({
    userId,
    teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (!userRole || userRole.roleName !== RoleName.COACH) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only coaches can view invites');
  }

  const invites = await TeamInvite.find({ teamId })
    .populate('invitedBy', 'name email')
    .populate('acceptedBy', 'name email')
    .sort({ createdAt: -1 });

  return invites;
};

/**
 * Cancel/revoke an invite (before it's accepted)
 */
export const cancelInvite = async (
  inviteId: string,
  userId: string
): Promise<void> => {
  const invite = await TeamInvite.findById(inviteId);

  if (!invite) {
    throw new AppError(httpStatus.NOT_FOUND, 'Invite not found');
  }

  // Verify user is coach in team
  const userRole = await UserRole.findOne({
    userId,
    teamId: invite.teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (!userRole || userRole.roleName !== RoleName.COACH) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only coaches can cancel invites');
  }

  if (invite.status !== InviteStatus.PENDING) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Can only cancel pending invites');
  }

  invite.status = InviteStatus.CANCELLED;
  await invite.save();

  logger.info(`Invite cancelled: ${inviteId} by user ${userId}`);
};

/**
 * Resend invite email
 */
export const resendInvite = async (
  inviteId: string,
  userId: string
): Promise<void> => {
  const invite = await TeamInvite.findById(inviteId)
    .populate('teamId', 'name')
    .populate('invitedBy', 'name');

  if (!invite) {
    throw new AppError(httpStatus.NOT_FOUND, 'Invite not found');
  }

  // Verify user is coach
  const userRole = await UserRole.findOne({
    userId,
    teamId: invite.teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (!userRole || userRole.roleName !== RoleName.COACH) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only coaches can resend invites');
  }

  if (invite.status !== InviteStatus.PENDING) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Can only resend pending invites');
  }

  if (invite.expiresAt < new Date()) {
    throw new AppError(httpStatus.GONE, 'Invite has expired');
  }

  const inviteUrl = `${config.app.frontEndUrl}/team/invite/accept?token=${invite.token}`;

  await sendEmail('teamInvite', invite.email, {
    teamName: (invite.teamId as any).name,
    inviterName: (invite.invitedBy as any).name,
    inviteUrl,
    expiresInDays: Math.floor((invite.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  });

  logger.info(`Invite resent: ${inviteId}`);
};