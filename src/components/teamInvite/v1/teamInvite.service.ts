import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import { TeamInvite } from './teamInvite.model';
import { InviteStatus, ITeamInvite } from './teamInvite.interface';
import { Team } from '@components/team/v1/team.model';
import { UserRole } from '@components/userRole/v1/userRole.model';
import { Role } from '@components/role/v1/role.model';
import UserModel from '@components/user/v1/user.model';
import { RoleName } from '@components/role/v1/role.interface';
import { UserRoleStatus } from '@components/userRole/v1/userRole.interface';
import { Player } from '@components/player/v1/player.model';
import { splitDisplayNameForPlayer } from '@components/player/v1/playerName.util';
import { attachGuardianLinkAsCoach } from '@components/guardianLink/v1/guardianLink.service';
import { sendEmail } from '@shared/services/mail';
import { isMinorFromDateOfBirth } from '@shared/utils/age.util';
import { computeNeedsGuardianLink } from '@components/player/v1/playerOnboarding.util';
import AppError from '@core/utils/appError';
import httpStatus from 'http-status';
import logger from '@core/utils/logger';
import config from '@config/config';
import { INVITE_EXPIRY_MS, INVITE_ERRORS } from './teamInvite.constants';
import { getTeamChatGateway } from '@components/teamChat/v1/teamChat.gateway';
import {
  notifyInviteReceived,
  notifyInviteApprovedOrRejected,
} from '@components/notification/v1/notificationDelivery.service';

export interface IInviteEntry {
  email: string;
  /** When inviting a future guardian to attach to this minor player after they join */
  minorPlayerId?: string;
}

interface ICreateBatchInviteInput {
  teamId: string;
  invitedBy: string; // Coach user ID
  /** @deprecated Prefer inviteEntries when using minorPlayerId */
  emails?: string[];
  inviteEntries?: IInviteEntry[];
}

interface ICheckInviteInput {
  token?: string;
  inviteCode?: string;
}

interface IAcceptInviteInput {
  token?: string;
  inviteCode?: string;
  role: RoleName; // User chooses role
  userId: string; // Required - user must exist and be authenticated
  /** Required for player role if the user has no dateOfBirth yet (ISO date) */
  dateOfBirth?: Date | string;
}

interface IApprovePendingInviteInput {
  inviteId: string;
  approvedBy: string;
  role: RoleName;
}

interface IBatchInviteResult {
  success: ITeamInvite[];
  failed: Array<{
    email: string;
    reason: string;
  }>;
}

const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CREDENTIAL_GENERATION_ATTEMPTS = 5;

const asIdString = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value !== null && '_id' in value) {
    const nested = (value as { _id?: unknown })._id;
    if (typeof nested === 'string') return nested;
    if (nested instanceof Types.ObjectId) return nested.toString();
  }
  return String(value);
};

const generateInviteToken = (): string => crypto.randomBytes(32).toString('hex');

const generateInviteCode = (): string => {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    const randomIndex = crypto.randomInt(0, INVITE_CODE_ALPHABET.length);
    code += INVITE_CODE_ALPHABET[randomIndex];
  }
  return code;
};

const generateUniqueInviteCredentials = async (): Promise<{ token: string; inviteCode: string }> => {
  for (let attempt = 0; attempt < MAX_CREDENTIAL_GENERATION_ATTEMPTS; attempt += 1) {
    const token = generateInviteToken();
    const inviteCode = generateInviteCode();
    const existingInvite = await TeamInvite.exists({
      $or: [{ token }, { inviteCode }]
    });
    if (!existingInvite) {
      return { token, inviteCode };
    }
  }

  throw new AppError(
    httpStatus.INTERNAL_SERVER_ERROR,
    'Unable to generate unique invite credentials. Please try again.'
  );
};

const findInviteByCredential = async (data: ICheckInviteInput): Promise<ITeamInvite | null> => {
  const token = data.token?.trim();
  const inviteCode = data.inviteCode?.trim().toUpperCase();

  if (!token && !inviteCode) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Token or invite code is required');
  }

  const filter = token ? { token } : { inviteCode };
  return TeamInvite.findOne(filter).populate('teamId', 'name sport season').populate('invitedBy', 'name email');
};

type InviteRecipientSummary = {
  _id: Types.ObjectId | string;
  name: string;
  email: string;
  avatar?: string | null;
  age?: number;
  playerId?: string;
};

type AugmentedTeamInvite = ITeamInvite & {
  recipient?: InviteRecipientSummary;
};

const calculateAge = (dateOfBirth?: Date | string | null): number | undefined => {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : undefined;
};

/**
 * Create batch team invites (up to 20)
 * NO ROLE specified - user chooses when accepting
 * Optimized: Uses batch DB queries and async email queue
 */
const validateMinorPlayerForGuardianInvite = async (
  teamId: string,
  minorPlayerId: string
): Promise<void> => {
  const player = await Player.findOne({
    _id: new Types.ObjectId(minorPlayerId),
    teamId: new Types.ObjectId(teamId)
  }).select('dateOfBirth isMinor');

  if (!player) {
    throw new AppError(httpStatus.NOT_FOUND, 'minorPlayerId not found on this team');
  }

  const minor = player.dateOfBirth
    ? isMinorFromDateOfBirth(new Date(player.dateOfBirth))
    : player.isMinor;

  if (!minor) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'minorPlayerId must reference a minor player on this team'
    );
  }
};

export const createBatchInvites = async (
  data: ICreateBatchInviteInput
): Promise<IBatchInviteResult> => {
  const { teamId, invitedBy } = data;

  const entries: IInviteEntry[] =
    data.inviteEntries?.length
      ? data.inviteEntries
      : (data.emails ?? []).map((email) => ({ email }));

  if (entries.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'At least one email is required');
  }

  if (entries.length > 20) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Maximum 20 emails allowed per batch');
  }

  // Verify team exists
  const team = await Team.findById(teamId);
  if (!team) {
    throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  }

  // Verify inviter is a team manager in this team
  const inviterRole = await UserRole.findOne({
    userId: invitedBy,
    teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (!inviterRole || ![RoleName.COACH, RoleName.ASSISTANT_COACH].includes(inviterRole.roleName)) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only team managers can create invites');
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

  const validEntries: IInviteEntry[] = [];

  for (const raw of entries) {
    const email = raw.email.toLowerCase().trim();
    if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      results.failed.push({
        email: raw.email,
        reason: 'Invalid email format'
      });
      continue;
    }
    try {
      if (raw.minorPlayerId) {
        await validateMinorPlayerForGuardianInvite(teamId, raw.minorPlayerId);
      }
    } catch (e: unknown) {
      const msg = e instanceof AppError ? e.message : String(e);
      results.failed.push({
        email,
        reason: msg
      });
      continue;
    }
    validEntries.push({
      email,
      ...(raw.minorPlayerId ? { minorPlayerId: raw.minorPlayerId } : {})
    });
  }

  const validEmails = validEntries.map((e) => e.email);

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
  const invitesToCreate: Array<{
    teamId: mongoose.Types.ObjectId;
    invitedBy: mongoose.Types.ObjectId;
    email: string;
    status: InviteStatus;
    token: string;
    inviteCode: string;
    expiresAt: Date;
    minorPlayerId?: mongoose.Types.ObjectId;
  }> = [];
  const emailsToSend: Array<{ 
    to: string; 
    template: string; 
    data: Record<string, unknown> 
  }> = [];

  for (const entry of validEntries) {
    const { email, minorPlayerId } = entry;
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

      const { token, inviteCode } = await generateUniqueInviteCredentials();
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

      // Add to batch creation array
      invitesToCreate.push({
        teamId: new mongoose.Types.ObjectId(teamId),
        invitedBy: new mongoose.Types.ObjectId(invitedBy),
        email,
        status: InviteStatus.PENDING,
        token,
        inviteCode,
        expiresAt,
        ...(minorPlayerId
          ? { minorPlayerId: new mongoose.Types.ObjectId(minorPlayerId) }
          : {})
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
          inviteCode,
          expiresInDays: Math.floor(INVITE_EXPIRY_MS / (24 * 60 * 60 * 1000))
        }
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.failed.push({
        email,
        reason: errorMessage || 'Failed to process email'
      });
    }
  }

  // Query 4: Create all invites at once
  if (invitesToCreate.length > 0) {
    try {
      const createdInvites = await TeamInvite.insertMany(invitesToCreate);
      results.success = createdInvites;

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

      // Notify existing users via push (non-blocking)
      Promise.allSettled(
        createdInvites.map(async (inv) => {
          try {
            const invUser = existingUserMap.get(inv.email.toLowerCase());
            if (invUser) {
              await notifyInviteReceived({
                invitedUserId: invUser._id.toString(),
                teamId,
                teamName: team.name,
                inviteId: inv._id.toString(),
                inviteToken: inv.token,
              });
            }
          } catch (err) {
            logger.error(`Failed to send invite push notification for ${inv.email}`, err);
          }
        })
      ).catch((err) => {
        logger.error('Unexpected error sending invite push notifications', err);
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create batch invites', error);
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to create invites: ' + errorMessage
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
  const invite = await findInviteByCredential(data);

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
 * User must already exist and be authenticated
 */
export const acceptInvite = async (data: IAcceptInviteInput): Promise<{
  invite: ITeamInvite;
  user: {
    _id: string;
    name: string;
    email: string;
    email_verified: boolean;
    avatar?: string;
  };
}> => {
  const { role, userId, dateOfBirth: inputDob } = data;
  const invite = await findInviteByCredential({
    token: data.token,
    inviteCode: data.inviteCode
  });

  if (!invite) {
    throw new AppError(httpStatus.NOT_FOUND, INVITE_ERRORS.NOT_FOUND);
  }

  // Check if invite is pending (before user acceptance)
  if (invite.status !== InviteStatus.PENDING) {
    if (invite.status === InviteStatus.PENDING_APPROVAL) {
      throw new AppError(httpStatus.CONFLICT, 'Invite already accepted by user and waiting for coach approval');
    }
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

  if (role === RoleName.COACH) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Coach role cannot be selected when accepting a team invite'
    );
  }

  if (invite.minorPlayerId && role !== RoleName.GUARDIAN) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This invite is reserved for a guardian joining to attach to a minor player'
    );
  }

  // User must exist and be authenticated
  if (!userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required. User must be authenticated.');
  }

  // Find user
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Verify email matches invite
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'This invite is for a different email address'
    );
  }

  // Ensure email is verified
  if (!user.email_verified) {
    user.email_verified = true;
    await user.save();
  }

  if (role === RoleName.PLAYER) {
    let dob: Date | undefined;
    if (inputDob !== undefined && inputDob !== null && inputDob !== '') {
      dob = new Date(inputDob);
    } else if (user.dateOfBirth) {
      dob = new Date(user.dateOfBirth);
    }

    if (!dob || Number.isNaN(dob.getTime())) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'dateOfBirth is required when accepting as a player'
      );
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (dob.getTime() > today.getTime()) {
      throw new AppError(httpStatus.BAD_REQUEST, 'dateOfBirth cannot be in the future');
    }

    user.dateOfBirth = dob;
    await user.save();
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

  // Store pending membership request. User is not active in team yet.
  await UserRole.findOneAndUpdate(
    {
      userId: user._id,
      teamId: invite.teamId,
      status: UserRoleStatus.INVITED,
    },
    {
      roleId: roleDoc._id,
      roleName: role,
      status: UserRoleStatus.INVITED,
      invitedBy: invite.invitedBy,
      invitedAt: invite.createdAt,
      joinedAt: undefined,
      removedAt: undefined,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  // Mark invite as awaiting coach approval
  invite.status = InviteStatus.PENDING_APPROVAL;
  invite.acceptedBy = new Types.ObjectId(user._id);
  invite.acceptedRole = role;
  invite.acceptedAt = new Date();
  await invite.save();

  logger.info(
    `Invite accepted by user and pending approval: ${invite._id} by user ${user._id} with role ${role}`
  );

  // Notify the inviting coach that a member has accepted and is pending approval
  const invitedBy = invite.invitedBy as unknown as { name: string; email: string };
  const teamDoc = invite.teamId as unknown as { name: string };
  const manageTeamUrl = `${config.app.frontEndUrl}/manage-team`;

  sendEmail('joinRequest', invitedBy.email, {
    coachName: invitedBy.name,
    memberName: user.name,
    memberEmail: user.email,
    teamName: teamDoc.name,
    role,
    manageTeamUrl,
  }).catch((err) => {
    logger.warn(`Failed to send join-request email to coach ${invitedBy.email}: ${err?.message}`);
  });

  // Remove password from response
  const userObj = user.toObject();
  delete userObj.password;

  return {
    invite,
    user: userObj
  };
};

/**
 * Coach approves an invite already accepted by user (pending approval).
 * Coach can override role in this API call.
 */
export const approvePendingInvite = async (data: IApprovePendingInviteInput): Promise<{
  invite: ITeamInvite;
  userRole: {
    userId: string;
    teamId: string;
    role: RoleName;
    status: UserRoleStatus;
    needsGuardianLink?: boolean;
  };
}> => {
  const { inviteId, approvedBy, role } = data;

  const invite = await TeamInvite.findById(inviteId)
    .populate('teamId', 'name')
    .populate('invitedBy', 'name');

  if (!invite) {
    throw new AppError(httpStatus.NOT_FOUND, 'Invite not found');
  }

  if (invite.status !== InviteStatus.PENDING_APPROVAL) {
    throw new AppError(httpStatus.BAD_REQUEST, INVITE_ERRORS.NOT_AWAITING_APPROVAL);
  }

  if (!invite.acceptedBy) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invite has no accepted user');
  }

  const coachRole = await UserRole.findOne({
    userId: approvedBy,
    teamId: invite.teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (!coachRole || ![RoleName.COACH, RoleName.ASSISTANT_COACH].includes(coachRole.roleName)) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only team managers can approve pending invites');
  }

  const roleDoc = await Role.findOne({ name: role });
  if (!roleDoc) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid role selected');
  }

  if (role === RoleName.COACH) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Coach role cannot be assigned through invite approval'
    );
  }

  if (invite.minorPlayerId && role !== RoleName.GUARDIAN) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This invite is reserved for a guardian joining to attach to a minor player'
    );
  }


  const existingActiveMembership = await UserRole.findOne({
    userId: invite.acceptedBy,
    teamId: invite.teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (existingActiveMembership) {
    throw new AppError(httpStatus.CONFLICT, INVITE_ERRORS.ALREADY_MEMBER);
  }

  const pendingMembership = await UserRole.findOne({
    userId: invite.acceptedBy,
    teamId: invite.teamId,
    status: UserRoleStatus.INVITED,
  });

  if (!pendingMembership) {
    throw new AppError(httpStatus.NOT_FOUND, 'Pending membership not found for this invite');
  }

  // Create roster before activating membership so we never leave the user active without a valid Player row.
  if (role === RoleName.PLAYER) {
    const acceptedUser = await UserModel.findById(invite.acceptedBy);
    if (!acceptedUser) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }
    const existingPlayer = await Player.findOne({
      userId: invite.acceptedBy,
      teamId: invite.teamId,
    });

    if (!existingPlayer) {
      const { firstName, lastName } = splitDisplayNameForPlayer(
        acceptedUser.name,
        acceptedUser.email?.split('@')[0]
      );
      await Player.create({
        userId: invite.acceptedBy,
        teamId: invite.teamId,
        firstName,
        lastName: lastName?.trim() || '-',
        hasEmail: true,
        createdBy: invite.invitedBy,
        dateOfBirth: acceptedUser.dateOfBirth
      });
    } else if (
      acceptedUser.dateOfBirth &&
      (!existingPlayer.dateOfBirth ||
        new Date(existingPlayer.dateOfBirth).getTime() !==
          new Date(acceptedUser.dateOfBirth).getTime())
    ) {
      existingPlayer.dateOfBirth = acceptedUser.dateOfBirth;
      await existingPlayer.save();
    }
  }

  const roleUnchanged = pendingMembership.roleName === role;
  const updatedUserRole = await UserRole.findOneAndUpdate(
    {
      userId: invite.acceptedBy,
      teamId: invite.teamId,
      status: UserRoleStatus.INVITED,
    },
    {
      ...(roleUnchanged
        ? {}
        : { roleId: roleDoc._id, roleName: role }),
      status: UserRoleStatus.ACTIVE,
      joinedAt: new Date(),
      removedAt: undefined,
    },
    { new: true }
  );

  if (!updatedUserRole) {
    throw new AppError(httpStatus.NOT_FOUND, 'Pending membership not found for this invite');
  }

  invite.status = InviteStatus.ACCEPTED;
  invite.acceptedRole = role;
  await invite.save();

  // For deferred guardian-link invites, attach only after guardian membership is active.
  if (role === RoleName.GUARDIAN && invite.minorPlayerId) {
    const inviteTeamId = asIdString(invite.teamId);
    const acceptedById = asIdString(invite.acceptedBy);
    await attachGuardianLinkAsCoach({
      teamId: inviteTeamId,
      coachUserId: approvedBy,
      guardianUserId: acceptedById,
      playerId: invite.minorPlayerId.toString()
    });
  }

  const needsGuardianLink =
    role === RoleName.PLAYER
      ? await computeNeedsGuardianLink(asIdString(invite.acceptedBy), asIdString(invite.teamId))
      : false;

  logger.info(
    `Pending invite approved: ${invite._id} by coach ${approvedBy} with role ${role}`
  );

  const gateway = getTeamChatGateway();
  if (gateway) {
    gateway.emitMembershipApproved(asIdString(invite.acceptedBy), {
      inviteId: invite._id.toString(),
      teamId: asIdString(invite.teamId),
      role
    });
  }

  notifyInviteApprovedOrRejected({
    requesterUserId: asIdString(invite.acceptedBy),
    teamId: asIdString(invite.teamId),
    teamName: (invite.teamId as unknown as { name: string }).name ?? 'your team',
    inviteId: invite._id.toString(),
    approved: true,
  }).catch((err) => {
    logger.error('Failed to send invite-approved notification', err);
  });

  return {
    invite,
    userRole: {
      userId: updatedUserRole.userId.toString(),
      teamId: updatedUserRole.teamId.toString(),
      role: updatedUserRole.roleName,
      status: updatedUserRole.status,
      ...(role === RoleName.PLAYER ? { needsGuardianLink } : {})
    }
  };
};

/**
 * Get all invites for a team (for team managers to see)
 */
export const getTeamInvites = async (
  teamId: string,
  userId: string
): Promise<ITeamInvite[]> => {
  // Verify user is team manager
  const userRole = await UserRole.findOne({
    userId,
    teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (!userRole || ![RoleName.COACH, RoleName.ASSISTANT_COACH].includes(userRole.roleName)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have permission to access this resource.',
    );
  }

  const invites = await TeamInvite.find({ teamId })
    .populate('invitedBy', 'name email')
    .populate('acceptedBy', 'name email avatar')
    .sort({ createdAt: -1 });

  // Augment invites with recipient metadata when possible so the frontend can
  // show human-friendly names and associated player IDs (if the invite email
  // belongs to an existing user who already has a Player row on this team).
  const inviteObjs = invites.map((inv) => inv.toObject() as AugmentedTeamInvite);

  // Collect all invite emails to lookup users in a single query
  const emails = Array.from(new Set(inviteObjs.map((i) => String(i.email).toLowerCase()))).filter(Boolean);
  if (emails.length === 0) return inviteObjs as unknown as ITeamInvite[];

  const users = await UserModel.find({ email: { $in: emails } }).select('name email avatar dateOfBirth _id');
  const userByEmail = new Map(users.map((u) => [String(u.email).toLowerCase(), u]));

  // Find any Player rows for these users on this team so we can return playerId
  const userIds = users.map((u) => u._id);
  const players =
    userIds.length > 0
      ? await Player.find({ userId: { $in: userIds }, teamId }).select('_id userId dateOfBirth')
      : [];
  const playerByUserId = new Map(players.map((p) => [String(p.userId), p]));

  // Attach a `recipient` object to each invite when we can resolve a user
  for (const invObj of inviteObjs) {
    try {
      const emailKey = String(invObj.email || '').toLowerCase();
      const user = userByEmail.get(emailKey);
      if (user) {
        const player = playerByUserId.get(String(user._id));
        // Attach a lightweight recipient object so frontend can show name and
        // select playerId when creating player-specific notes.
        // Do not modify the DB; this is only for the response payload.
        invObj.recipient = {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar ?? null,
          age: calculateAge(player?.dateOfBirth ?? user.dateOfBirth),
          playerId: player ? String(player._id) : undefined,
        };
      }
    } catch (err) {
      // If augmentation fails for any invite, log and continue returning base invite data
      logger.warn(`Failed to augment invite ${invObj._id} with recipient info: ${err}`);
    }
  }

  return inviteObjs as unknown as ITeamInvite[];
};

/**
 * Get all invites for a user (by user ID)
 * Returns all invites sent to the user's email address
 * @param userId - User ID
 * @param status - Optional status filter (pending, accepted, declined, expired, cancelled)
 */
export const getUserInvites = async (
  userId: string,
  status?: string
): Promise<ITeamInvite[]> => {
  // Get user to find their email
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Build query filter
  const queryFilter: {
    email: string;
    status?: InviteStatus;
  } = { 
    email: user.email.toLowerCase() 
  };

  // Add status filter if provided (validate it's a valid InviteStatus)
  if (status) {
    if (!Object.values(InviteStatus).includes(status as InviteStatus)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid status. Must be one of: ${Object.values(InviteStatus).join(', ')}`
      );
    }
    queryFilter.status = status as InviteStatus;
  }

  // Find all invites for this user's email
  const invites = await TeamInvite.find(queryFilter)
    .populate('teamId', 'name sport season')
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

  // Verify user is team manager in team
  const userRole = await UserRole.findOne({
    userId,
    teamId: invite.teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (!userRole || ![RoleName.COACH, RoleName.ASSISTANT_COACH].includes(userRole.roleName)) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only team managers can cancel invites');
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

  // Verify user is team manager
  const userRole = await UserRole.findOne({
    userId,
    teamId: invite.teamId,
    status: UserRoleStatus.ACTIVE
  });

  if (!userRole || ![RoleName.COACH, RoleName.ASSISTANT_COACH].includes(userRole.roleName)) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only team managers can resend invites');
  }

  if (invite.status !== InviteStatus.PENDING) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Can only resend pending invites');
  }

  const { token, inviteCode } = await generateUniqueInviteCredentials();
  invite.token = token;
  invite.inviteCode = inviteCode;
  invite.expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
  await invite.save();

  const inviteUrl = `${config.app.frontEndUrl}/team/invite/accept?token=${invite.token}`;

  await sendEmail('teamInvite', invite.email, {
    teamName: (invite.teamId as unknown as { name: string }).name,
    inviterName: (invite.invitedBy as unknown as { name: string }).name,
    inviteUrl,
    inviteCode: invite.inviteCode,
    expiresInDays: Math.floor((invite.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  });

  logger.info(`Invite resent: ${inviteId}`);
};

