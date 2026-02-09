import httpStatus from 'http-status';
import mongoose from 'mongoose';
import AppError from '@core/utils/appError';
import { Attendance } from './attendance.model';
import { IAttendance, AttendanceStatus } from './attendance.interface';
import { Player } from '@components/player/v1/player.model';

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

export interface AttendanceNormalized {
  id: string;
  eventId: string;
  playerId: string;
  teamId: string;
  status: AttendanceStatus;
  markedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mark attendance for a player at an event (present or absent). Coach only. Upserts; last write wins.
 */
export async function markAttendance(
  eventId: string,
  playerId: string,
  teamId: string,
  status: AttendanceStatus,
  userId: string
): Promise<AttendanceNormalized> {
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

  const doc = await Attendance.findOneAndUpdate(
    { eventId: eventObjId, playerId: playerObjId },
    {
      $set: {
        teamId: teamObjId,
        status,
        markedBy: userObjId
      }
    },
    { new: true, upsert: true, runValidators: true }
  );

  return normalizeAttendance(doc);
}

function normalizeAttendance(doc: IAttendance): AttendanceNormalized {
  const json = doc.toJSON() as Record<string, unknown>;
  return {
    id: (json._id as mongoose.Types.ObjectId).toString(),
    eventId: (json.eventId as mongoose.Types.ObjectId).toString(),
    playerId: (json.playerId as mongoose.Types.ObjectId).toString(),
    teamId: (json.teamId as mongoose.Types.ObjectId).toString(),
    status: json.status as AttendanceStatus,
    markedBy: (json.markedBy as mongoose.Types.ObjectId).toString(),
    createdAt: json.createdAt as Date,
    updatedAt: json.updatedAt as Date
  };
}

/**
 * Get a single attendance record for event+player. Returns null if not marked.
 */
export async function getAttendance(eventId: string, playerId: string): Promise<AttendanceNormalized | null> {
  const doc = await Attendance.findOne({
    eventId: toObjectId(eventId),
    playerId: toObjectId(playerId)
  });

  return doc ? normalizeAttendance(doc) : null;
}

export interface AttendanceSummaryByPlayer {
  playerId: string;
  status: AttendanceStatus;
  markedBy?: string;
  updatedAt: Date;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  unmarked: number;
  byPlayer: AttendanceSummaryByPlayer[];
}

/**
 * Aggregate attendance counts and per-player list for an event. Roster = all Players for teamId.
 */
export async function getAttendanceSummary(eventId: string, teamId: string): Promise<AttendanceSummary> {
  const teamObjId = toObjectId(teamId);
  const eventObjId = toObjectId(eventId);

  const [roster, attendances] = await Promise.all([
    Player.find({ teamId: teamObjId }).select('_id').lean(),
    Attendance.find({ eventId: eventObjId, teamId: teamObjId }).lean()
  ]);

  const attendanceByPlayer = new Map<
    string,
    { status: AttendanceStatus; markedBy?: string; updatedAt: Date }
  >();
  for (const a of attendances as Array<{
    playerId: { toString: () => string } | string;
    status: AttendanceStatus;
    markedBy?: { toString: () => string } | string;
    updatedAt: Date;
  }>) {
    const pid = String(a.playerId);
    attendanceByPlayer.set(pid, {
      status: a.status,
      markedBy: a.markedBy ? String(a.markedBy) : undefined,
      updatedAt: a.updatedAt
    });
  }

  let present = 0;
  let absent = 0;
  let unmarked = 0;
  const byPlayer: AttendanceSummaryByPlayer[] = [];

  for (const p of roster) {
    const playerId = String(p._id);
    const att = attendanceByPlayer.get(playerId);
    if (att) {
      if (att.status === 'present') present++;
      else absent++;
      byPlayer.push({
        playerId,
        status: att.status,
        markedBy: att.markedBy,
        updatedAt: att.updatedAt
      });
    } else {
      unmarked++;
    }
  }

  return {
    present,
    absent,
    unmarked,
    byPlayer
  };
}

export interface ParticipantWithAttendance {
  playerId: string;
  firstName: string;
  lastName: string;
  jerseyNumber?: string;
  position?: string;
  attendance?: AttendanceStatus;
  markedBy?: string;
  attendanceUpdatedAt?: Date;
}

/**
 * Search-first participant list for an event: roster (players) for the event's team, optionally filtered by search.
 * Includes current attendance status for the event when present.
 */
export async function getParticipantsForEvent(
  eventId: string,
  teamId: string,
  options: { search?: string } = {}
): Promise<ParticipantWithAttendance[]> {
  const teamObjId = toObjectId(teamId);
  const eventObjId = toObjectId(eventId);

  const searchTerm = options.search?.trim();
  const rosterQuery: Record<string, unknown> = { teamId: teamObjId };
  if (searchTerm) {
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    rosterQuery.$or = [
      { firstName: regex },
      { lastName: regex },
      { jerseyNumber: regex },
      { position: regex }
    ];
  }

  const [players, attendances] = await Promise.all([
    Player.find(rosterQuery)
      .select('_id firstName lastName jerseyNumber position')
      .sort({ lastName: 1, firstName: 1 })
      .lean(),
    Attendance.find({ eventId: eventObjId, teamId: teamObjId })
      .select('playerId status markedBy updatedAt')
      .lean()
  ]);

  const attendanceByPlayer = new Map<
    string,
    { status: AttendanceStatus; markedBy?: string; updatedAt: Date }
  >();
  for (const a of attendances as Array<{
    playerId: { toString: () => string } | string;
    status: AttendanceStatus;
    markedBy?: { toString: () => string } | string;
    updatedAt: Date;
  }>) {
    const pid = String(a.playerId);
    attendanceByPlayer.set(pid, {
      status: a.status,
      markedBy: a.markedBy ? String(a.markedBy) : undefined,
      updatedAt: a.updatedAt
    });
  }

  return (players as Array<{
    _id: { toString: () => string } | string;
    firstName?: string;
    lastName?: string;
    jerseyNumber?: string;
    position?: string;
  }>).map((p) => {
    const playerId = String(p._id);
    const att = attendanceByPlayer.get(playerId);
    return {
      playerId,
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      jerseyNumber: p.jerseyNumber,
      position: p.position,
      attendance: att?.status,
      markedBy: att?.markedBy,
      attendanceUpdatedAt: att?.updatedAt
    };
  });
}
