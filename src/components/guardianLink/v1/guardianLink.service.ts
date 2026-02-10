import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '@core/utils/appError';
import { GuardianLink } from './guardianLink.model';
import { GuardianLinkStatus, IGuardianLink } from './guardianLink.interface';
import { Player } from '@components/player/v1/player.model';
import { UserRole } from '@components/userRole/v1/userRole.model';
import { UserRoleStatus } from '@components/userRole/v1/userRole.interface';
import { RoleName } from '@components/role/v1/role.interface';
import { permissionService } from '@shared/services/permission.service';
import { Action, Resource } from '@shared/types/permission.types';

export interface GuardianLinkDto {
  id: string;
  guardianId: string;
  playerId: string;
  teamId: string;
  status: GuardianLinkStatus;
  requestedBy: string;
  requestedAt: Date;
  respondedBy?: string;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const normalizeGuardianLink = (link: IGuardianLink): GuardianLinkDto => ({
  id: link._id.toString(),
  guardianId: link.guardianId.toString(),
  playerId: link.playerId.toString(),
  teamId: link.teamId.toString(),
  status: link.status,
  requestedBy: link.requestedBy.toString(),
  requestedAt: link.requestedAt,
  respondedBy: link.respondedBy ? link.respondedBy.toString() : undefined,
  respondedAt: link.respondedAt,
  createdAt: link.createdAt,
  updatedAt: link.updatedAt
});

const ensurePlayerBelongsToTeam = async (playerId: string, teamId: string) => {
  const player = await Player.findOne({
    _id: new Types.ObjectId(playerId),
    teamId: new Types.ObjectId(teamId)
  }).select('_id');

  if (!player) {
    throw new AppError(httpStatus.NOT_FOUND, 'Player not found for this team');
  }
};

export interface RequestGuardianLinkInput {
  teamId: string;
  requesterUserId: string;
  /**
   * Optional explicit guardianId and playerId.
   * Service will resolve any missing side based on requester role.
   */
  guardianId?: string;
  playerId?: string;
}

export const requestGuardianLink = async (
  input: RequestGuardianLinkInput
): Promise<GuardianLinkDto> => {
  const { teamId, requesterUserId } = input;
  let { guardianId, playerId } = input;

  // Determine requester's role in the team
  const membership = await UserRole.findOne({
    userId: requesterUserId,
    teamId,
    status: UserRoleStatus.ACTIVE
  }).select('roleName');

  if (!membership) {
    throw new AppError(httpStatus.FORBIDDEN, 'User is not a member of this team');
  }

  const roleName = membership.roleName as RoleName;

  // Resolve guardian/player sides based on who is requesting
  if (roleName === RoleName.GUARDIAN) {
    // Guardian is always the authenticated user
    guardianId = requesterUserId;
    if (!playerId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'playerId is required for guardian requests');
    }
  } else if (roleName === RoleName.PLAYER) {
    // Player side is derived from authenticated user + team if not provided
    if (!playerId) {
      const player = await Player.findOne({
        userId: requesterUserId,
        teamId
      }).select('_id');

      if (!player) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Player record not found for this user in the team'
        );
      }

      playerId = player._id.toString();
    }

    if (!guardianId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'guardianId is required for player requests');
    }
  } else {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only players or guardians can request guardian links'
    );
  }

  // At this point both sides must be present
  if (!guardianId || !playerId) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'guardianId and playerId must be resolved before creating guardian link'
    );
  }

  await ensurePlayerBelongsToTeam(playerId, teamId);

  const perm = await permissionService.checkPermission({
    userId: requesterUserId,
    teamId,
    resource: Resource.GUARDIAN_LINK,
    action: Action.CREATE
  });

  if (!perm.allowed) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      perm.reason ?? 'Only players or guardians can request guardian links'
    );
  }

  const existing = await GuardianLink.findOne({
    guardianId: new Types.ObjectId(guardianId),
    playerId: new Types.ObjectId(playerId),
    teamId: new Types.ObjectId(teamId)
  });

  if (existing) {
    if (existing.status === GuardianLinkStatus.REMOVED) {
      existing.status = GuardianLinkStatus.PENDING;
      existing.requestedBy = new Types.ObjectId(requesterUserId);
      existing.requestedAt = new Date();
      existing.respondedBy = undefined;
      existing.respondedAt = undefined;

      await existing.save();
      return normalizeGuardianLink(existing);
    }

    throw new AppError(
      httpStatus.CONFLICT,
      'Guardian link already exists for this player and team'
    );
  }

  const link = await GuardianLink.create({
    guardianId: new Types.ObjectId(guardianId),
    playerId: new Types.ObjectId(playerId),
    teamId: new Types.ObjectId(teamId),
    status: GuardianLinkStatus.PENDING,
    requestedBy: new Types.ObjectId(requesterUserId),
    requestedAt: new Date()
  });

  return normalizeGuardianLink(link);
};

export interface ListGuardianLinksInput {
  teamId: string;
  userId: string;
}

export const listGuardianLinksForUser = async (
  input: ListGuardianLinksInput
): Promise<GuardianLinkDto[]> => {
  const { teamId, userId } = input;

  const membership = await UserRole.findOne({
    userId,
    teamId,
    status: UserRoleStatus.ACTIVE
  }).select('roleName');

  if (!membership) {
    throw new AppError(httpStatus.FORBIDDEN, 'User is not a member of this team');
  }

  const roleName = membership.roleName as RoleName;

  const baseFilter: {
    teamId: Types.ObjectId;
    status: { $ne: GuardianLinkStatus };
    guardianId?: Types.ObjectId | string;
    playerId?: Types.ObjectId | string;
  } = {
    teamId: new Types.ObjectId(teamId),
    status: { $ne: GuardianLinkStatus.REMOVED }
  };

  if (roleName === RoleName.COACH || roleName === RoleName.ASSISTANT_COACH) {
    // Admins see all guardian links in the team
  } else if (roleName === RoleName.GUARDIAN) {
    baseFilter.guardianId = new Types.ObjectId(userId);
  } else if (roleName === RoleName.PLAYER) {
    const player = await Player.findOne({
      userId,
      teamId
    }).select('_id');

    if (!player) {
      return [];
    }

    baseFilter.playerId = player._id;
  } else {
    // Other roles (e.g. media) currently cannot view guardian links
    return [];
  }

  const links = await GuardianLink.find(baseFilter)
    .sort({ createdAt: -1 })
    .exec();

  return links.map(normalizeGuardianLink);
};

export interface UpdateGuardianLinkStatusInput {
  teamId: string;
  userId: string;
  linkId: string;
}

export const approveGuardianLink = async (
  input: UpdateGuardianLinkStatusInput
): Promise<GuardianLinkDto> => {
  const { teamId, userId, linkId } = input;

  const link = await GuardianLink.findOne({
    _id: new Types.ObjectId(linkId),
    teamId: new Types.ObjectId(teamId)
  });

  if (!link) {
    throw new AppError(httpStatus.NOT_FOUND, 'Guardian link not found');
  }

  if (link.status !== GuardianLinkStatus.PENDING) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Only pending links can be approved');
  }

  // Figure out which side requested and which side must respond
  const guardianId = link.guardianId.toString();
  const player = await Player.findOne({
    _id: link.playerId
  }).select('userId');

  const playerUserId = player?.userId ? player.userId.toString() : undefined;

  let targetUserId: string | undefined;

  // Case 1: guardian initiated the request → player must respond
  if (link.requestedBy.toString() === guardianId) {
    targetUserId = playerUserId;
  }
  // Case 2: player (user) initiated the request → guardian must respond
  else if (playerUserId && link.requestedBy.toString() === playerUserId) {
    targetUserId = guardianId;
  }

  if (!targetUserId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the linked guardian or player can approve this request'
    );
  }

  const perm = await permissionService.checkPermission({
    userId,
    teamId,
    resource: Resource.GUARDIAN_LINK,
    action: Action.APPROVE,
    targetUserId
  });

  if (!perm.allowed) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      perm.reason ?? 'Not allowed to approve this guardian link'
    );
  }

  link.status = GuardianLinkStatus.APPROVED;
  link.respondedBy = new Types.ObjectId(userId);
  link.respondedAt = new Date();

  await link.save();

  return normalizeGuardianLink(link);
};

export const rejectGuardianLink = async (
  input: UpdateGuardianLinkStatusInput
): Promise<GuardianLinkDto> => {
  const { teamId, userId, linkId } = input;

  const link = await GuardianLink.findOne({
    _id: new Types.ObjectId(linkId),
    teamId: new Types.ObjectId(teamId)
  });

  if (!link) {
    throw new AppError(httpStatus.NOT_FOUND, 'Guardian link not found');
  }

  if (link.status !== GuardianLinkStatus.PENDING) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Only pending links can be rejected');
  }

  // Determine who is allowed to reject: the non-requesting side
  const guardianId = link.guardianId.toString();
  const player = await Player.findOne({
    _id: link.playerId
  }).select('userId');

  const playerUserId = player?.userId ? player.userId.toString() : undefined;

  let targetUserId: string | undefined;

  // Case 1: guardian initiated the request → player must respond
  if (link.requestedBy.toString() === guardianId) {
    targetUserId = playerUserId;
  }
  // Case 2: player (user) initiated the request → guardian must respond
  else if (playerUserId && link.requestedBy.toString() === playerUserId) {
    targetUserId = guardianId;
  }

  if (!targetUserId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the linked guardian or player can reject this request'
    );
  }

  const perm = await permissionService.checkPermission({
    userId,
    teamId,
    resource: Resource.GUARDIAN_LINK,
    action: Action.APPROVE,
    targetUserId
  });

  if (!perm.allowed) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      perm.reason ?? 'Not allowed to reject this guardian link'
    );
  }

  link.status = GuardianLinkStatus.REJECTED;
  link.respondedBy = new Types.ObjectId(userId);
  link.respondedAt = new Date();

  await link.save();

  return normalizeGuardianLink(link);
};

export const removeGuardianLink = async (
  input: UpdateGuardianLinkStatusInput
): Promise<GuardianLinkDto> => {
  const { teamId, userId, linkId } = input;

  const link = await GuardianLink.findOne({
    _id: new Types.ObjectId(linkId),
    teamId: new Types.ObjectId(teamId)
  });

  if (!link) {
    throw new AppError(httpStatus.NOT_FOUND, 'Guardian link not found');
  }

  if (link.status === GuardianLinkStatus.REMOVED) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Guardian link is already removed');
  }

  const perm = await permissionService.checkPermission({
    userId,
    teamId,
    resource: Resource.GUARDIAN_LINK,
    action: Action.DELETE,
    targetUserId: link.guardianId.toString()
  });

  if (!perm.allowed) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      perm.reason ?? 'Not allowed to remove this guardian link'
    );
  }

  link.status = GuardianLinkStatus.REMOVED;
  link.respondedBy = new Types.ObjectId(userId);
  link.respondedAt = new Date();

  await link.save();

  return normalizeGuardianLink(link);
};

