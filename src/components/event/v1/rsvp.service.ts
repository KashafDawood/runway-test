import httpStatus from 'http-status';
import mongoose from 'mongoose';
import AppError from '@core/utils/appError';
import { Rsvp } from './rsvp.model';
import { IRsvp, RsvpStatus } from './rsvp.interface';
import { Player } from '@components/player/v1/player.model';
import { splitDisplayNameForPlayer } from '@components/player/v1/playerName.util';

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

export interface RsvpNormalized {
  id: string;
  eventId: string;
  playerId: string;
  teamId: string;
  status: RsvpStatus;
  updatedAt: Date;
  updatedBy?: string;
  createdAt: Date;
}

/**
 * Resolve playerId for a user on a team (when user has role PLAYER and is linked to a roster entry).
 */
export async function getPlayerIdForUser(teamId: string, userId: string): Promise<string | null> {
  const player = await Player.findOne({
    userId: toObjectId(userId),
    teamId: toObjectId(teamId)
  })
    .select('_id')
    .lean();

  return player ? String(player._id) : null;
}

/**
 * Ensure a roster (Player) record exists for a user with role PLAYER on the team.
 * If none exists (e.g. user joined as player before we auto-created roster on accept), create one so RSVP works.
 */
export async function ensurePlayerForUser(
  teamId: string,
  userId: string,
  userInfo: { name?: string; email?: string }
): Promise<string> {
  const existing = await getPlayerIdForUser(teamId, userId);
  if (existing) return existing;

  const { firstName, lastName } = splitDisplayNameForPlayer(
    userInfo.name,
    userInfo.email?.split('@')[0]
  );

  const player = await Player.create({
    userId: toObjectId(userId),
    teamId: toObjectId(teamId),
    firstName,
    lastName,
    hasEmail: !!userInfo.email,
    createdBy: toObjectId(userId)
  });

  return String(player._id);
}

/**
 * Upsert RSVP for event+player. Last action wins. Ensures player belongs to event's team.
 */
export async function upsertRsvp(
  eventId: string,
  playerId: string,
  teamId: string,
  status: RsvpStatus,
  userId: string
): Promise<RsvpNormalized> {
  const eventObjId = toObjectId(eventId);
  const playerObjId = toObjectId(playerId);
  const teamObjId = toObjectId(teamId);
  const userObjId = toObjectId(userId);

  const player = await Player.findOne({
    _id: playerObjId,
    teamId: teamObjId
  });

  if (!player) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Player not found on this team');
  }

  const doc = await Rsvp.findOneAndUpdate(
    { eventId: eventObjId, playerId: playerObjId },
    {
      $set: {
        teamId: teamObjId,
        status,
        updatedBy: userObjId
      }
    },
    { new: true, upsert: true, runValidators: true }
  );

  return normalizeRsvp(doc);
}

function normalizeRsvp(doc: IRsvp): RsvpNormalized {
  const json = doc.toJSON() as Record<string, unknown>;
  return {
    id: (json._id as mongoose.Types.ObjectId).toString(),
    eventId: (json.eventId as mongoose.Types.ObjectId).toString(),
    playerId: (json.playerId as mongoose.Types.ObjectId).toString(),
    teamId: (json.teamId as mongoose.Types.ObjectId).toString(),
    status: json.status as RsvpStatus,
    updatedAt: json.updatedAt as Date,
    updatedBy: json.updatedBy ? (json.updatedBy as mongoose.Types.ObjectId).toString() : undefined,
    createdAt: json.createdAt as Date
  };
}

/**
 * Get a single RSVP for event+player. Returns null if none.
 */
export async function getRsvp(eventId: string, playerId: string): Promise<RsvpNormalized | null> {
  const doc = await Rsvp.findOne({
    eventId: toObjectId(eventId),
    playerId: toObjectId(playerId)
  });

  return doc ? normalizeRsvp(doc) : null;
}

export interface RsvpSummaryByPlayer {
  playerId: string;
  status: RsvpStatus;
  updatedAt: Date;
  updatedBy?: string;
}

export interface RsvpSummary {
  attending: number;
  not_attending: number;
  no_response: number;
  byPlayer: RsvpSummaryByPlayer[];
}

/**
 * Aggregate RSVP counts and per-player list for an event. Roster = all Players for teamId.
 */
export async function getRsvpSummary(eventId: string, teamId: string): Promise<RsvpSummary> {
  const teamObjId = toObjectId(teamId);
  const eventObjId = toObjectId(eventId);

  const [roster, rsvps] = await Promise.all([
    Player.find({ teamId: teamObjId }).select('_id').lean(),
    Rsvp.find({ eventId: eventObjId, teamId: teamObjId }).lean()
  ]);

  const rsvpByPlayer = new Map<string, { status: RsvpStatus; updatedAt: Date; updatedBy?: string }>();
  for (const r of rsvps as Array<{
    playerId: mongoose.Types.ObjectId;
    status: RsvpStatus;
    updatedAt: Date;
    updatedBy?: mongoose.Types.ObjectId;
  }>) {
    const pid = (r.playerId as mongoose.Types.ObjectId).toString();
    rsvpByPlayer.set(pid, {
      status: r.status,
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy ? (r.updatedBy as mongoose.Types.ObjectId).toString() : undefined
    });
  }

  let attending = 0;
  let not_attending = 0;
  let no_response = 0;
  const byPlayer: RsvpSummaryByPlayer[] = [];

  for (const p of roster) {
    const playerId = String(p._id);
    const rsvp = rsvpByPlayer.get(playerId);
    if (rsvp) {
      if (rsvp.status === 'attending') attending++;
      else not_attending++;
      byPlayer.push({
        playerId,
        status: rsvp.status,
        updatedAt: rsvp.updatedAt,
        updatedBy: rsvp.updatedBy
      });
    } else {
      no_response++;
    }
  }

  return {
    attending,
    not_attending,
    no_response,
    byPlayer
  };
}
