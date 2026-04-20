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

const ensurePlayerBelongsToTeam = async (
  playerIdOrUserId: string,
  teamId: string
): Promise<string> => {
  const teamObjId = new Types.ObjectId(teamId);

  // Primary path: payload is actual Player._id
  let player = await Player.findOne({
    _id: playerIdOrUserId,
    teamId: teamObjId
  }).select('_id');

  // Fallback: payload is User._id of a player member
  if (!player) {
    player = await Player.findOne({
      userId: playerIdOrUserId,
      teamId: teamObjId
    }).select('_id');
  }

  if (!player) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Player not found for this team. Use Player._id or player userId for this team.'
    );
  }

  return player._id.toString();
};

export interface AttachGuardianLinkAsCoachInput {
  teamId: string;
  coachUserId: string;
  guardianUserId: string;
  playerId: string;
}

/**
 * Coach / assistant coach attaches an approved guardian–player link (immediate activation).
 */
export const attachGuardianLinkAsCoach = async (
  input: AttachGuardianLinkAsCoachInput
): Promise<GuardianLinkDto> => {
  const { teamId, coachUserId, guardianUserId, playerId } = input;

  const perm = await permissionService.checkPermission({
    userId: coachUserId,
    teamId,
    resource: Resource.GUARDIAN_LINK,
    action: Action.CREATE
  });

  if (!perm.allowed) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      perm.reason ?? 'Only coaches can attach guardian links'
    );
  }

  const guardianMembership = await UserRole.findOne({
    userId: guardianUserId,
    teamId,
    status: UserRoleStatus.ACTIVE,
    roleName: RoleName.GUARDIAN
  }).select('_id');

  if (!guardianMembership) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'User must be an active guardian on this team'
    );
  }

  const resolvedPlayerId = await ensurePlayerBelongsToTeam(playerId, teamId);

  const now = new Date();
  const coachOid = new Types.ObjectId(coachUserId);

  const existing = await GuardianLink.findOne({
    guardianId: new Types.ObjectId(guardianUserId),
    playerId: new Types.ObjectId(resolvedPlayerId),
    teamId: new Types.ObjectId(teamId)
  });

  if (existing) {
    if (existing.status === GuardianLinkStatus.APPROVED) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Guardian link already exists for this player and team'
      );
    }

    existing.status = GuardianLinkStatus.APPROVED;
    existing.requestedBy = coachOid;
    existing.requestedAt = existing.requestedAt || now;
    existing.respondedBy = coachOid;
    existing.respondedAt = now;
    await existing.save();
    return normalizeGuardianLink(existing);
  }

  const link = await GuardianLink.create({
    guardianId: new Types.ObjectId(guardianUserId),
    playerId: new Types.ObjectId(resolvedPlayerId),
    teamId: new Types.ObjectId(teamId),
    status: GuardianLinkStatus.APPROVED,
    requestedBy: coachOid,
    requestedAt: now,
    respondedBy: coachOid,
    respondedAt: now
  });

  return normalizeGuardianLink(link);
};

export interface RequestGuardianLinkInput {
  teamId: string;
  requesterUserId: string;
  guardianId: string;
  playerId: string;
}

/** @deprecated Use attachGuardianLinkAsCoach — kept as HTTP handler entry */
export const requestGuardianLink = async (
  input: RequestGuardianLinkInput
): Promise<GuardianLinkDto> => {
  return attachGuardianLinkAsCoach({
    teamId: input.teamId,
    coachUserId: input.requesterUserId,
    guardianUserId: input.guardianId,
    playerId: input.playerId
  });
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
  const { teamId, linkId } = input;

  const link = await GuardianLink.findOne({
    _id: new Types.ObjectId(linkId),
    teamId: new Types.ObjectId(teamId)
  });

  if (!link) {
    throw new AppError(httpStatus.NOT_FOUND, 'Guardian link not found');
  }

  throw new AppError(
    httpStatus.GONE,
    'Guardian link approval by players/guardians is no longer supported. Coaches attach links directly.'
  );
};

export const rejectGuardianLink = async (
  input: UpdateGuardianLinkStatusInput
): Promise<GuardianLinkDto> => {
  const { teamId, linkId } = input;

  const link = await GuardianLink.findOne({
    _id: new Types.ObjectId(linkId),
    teamId: new Types.ObjectId(teamId)
  });

  if (!link) {
    throw new AppError(httpStatus.NOT_FOUND, 'Guardian link not found');
  }

  throw new AppError(
    httpStatus.GONE,
    'Guardian link rejection by players/guardians is no longer supported. Coaches attach links directly.'
  );
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

