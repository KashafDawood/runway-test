import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { GameNote } from './gameNote.model';
import { IGameNote } from './gameNote.interface';
import AppError from '@core/utils/appError';
import { Event } from '@components/event/v1/event.model';
import { Player } from '@components/player/v1/player.model';
import { permissionService } from '@shared/services/permission.service';
import { Action, Resource } from '@shared/types/permission.types';
import { RoleName } from '@components/role/v1/role.interface';

export interface UpsertTeamNoteInput {
  teamId: string;
  eventId: string;
  userId: string;
  text: string;
  tags?: string[];
}

export interface UpsertPlayerNoteInput {
  teamId: string;
  eventId: string;
  userId: string;
  playerId: string;
  text: string;
  tags?: string[];
}

export interface EventNotesForUserInput {
  teamId: string;
  eventId: string;
  userId: string;
  userTeamRole: RoleName;
}

export interface NormalizedGameNote {
  id: string;
  teamId: string;
  eventId: string;
  playerId?: string | null;
  text: string;
  tags: string[];
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventNotesForUserResult {
  teamNote?: NormalizedGameNote;
  playerNotes: NormalizedGameNote[];
}

const normalizeNote = (note: IGameNote): NormalizedGameNote => ({
  id: note._id.toString(),
  teamId: note.teamId.toString(),
  eventId: note.eventId.toString(),
  playerId: note.playerId ? note.playerId.toString() : null,
  text: note.text,
  tags: Array.isArray(note.tags) ? note.tags.map((t) => String(t).trim()).filter(Boolean) : [],
  createdBy: note.createdBy.toString(),
  updatedBy: note.updatedBy ? note.updatedBy.toString() : undefined,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt
});

const ensureEventBelongsToTeam = async (eventId: string, teamId: string) => {
  const event = await Event.findOne({ _id: eventId, teamId });
  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, 'Event not found for this team');
  }
};

const ensurePlayerBelongsToTeam = async (playerId: string, teamId: string) => {
  const player = await Player.findOne({ _id: playerId, teamId });
  if (!player) {
    throw new AppError(httpStatus.NOT_FOUND, 'Player not found for this team');
  }
};

export const upsertTeamNote = async (input: UpsertTeamNoteInput): Promise<NormalizedGameNote> => {
  const { teamId, eventId, userId, text, tags } = input;

  await ensureEventBelongsToTeam(eventId, teamId);

  const perm = await permissionService.checkPermission({
    userId,
    teamId,
    resource: Resource.GAME_NOTE,
    action: Action.PUBLISH
  });
  if (!perm.allowed) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      perm.reason ?? 'Only coaches can publish game notes'
    );
  }

  const now = new Date();
  const filter = {
    teamId: new Types.ObjectId(teamId),
    eventId: new Types.ObjectId(eventId),
    playerId: null as Types.ObjectId | null
  };

  const update = {
    text,
    tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
    createdBy: new Types.ObjectId(userId),
    updatedBy: new Types.ObjectId(userId),
    updatedAt: now
  };

  const note = await GameNote.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true
  });

  if (!note) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to save game note');
  }

  return normalizeNote(note);
};

export const upsertPlayerNote = async (
  input: UpsertPlayerNoteInput
): Promise<NormalizedGameNote> => {
  const { teamId, eventId, userId, playerId, text, tags } = input;

  await ensureEventBelongsToTeam(eventId, teamId);
  await ensurePlayerBelongsToTeam(playerId, teamId);

  const perm = await permissionService.checkPermission({
    userId,
    teamId,
    resource: Resource.GAME_NOTE,
    action: Action.PUBLISH,
    playerId
  });
  if (!perm.allowed) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      perm.reason ?? 'Only coaches can publish player notes'
    );
  }

  const now = new Date();
  const filter = {
    teamId: new Types.ObjectId(teamId),
    eventId: new Types.ObjectId(eventId),
    playerId: new Types.ObjectId(playerId)
  };

  const update = {
    text,
    tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
    createdBy: new Types.ObjectId(userId),
    updatedBy: new Types.ObjectId(userId),
    updatedAt: now
  };

  const note = await GameNote.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true
  });

  if (!note) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to save player game note');
  }

  return normalizeNote(note);
};

export const getEventNotesForUser = async (
  input: EventNotesForUserInput
): Promise<EventNotesForUserResult> => {
  const { teamId, eventId, userId, userTeamRole } = input;

  await ensureEventBelongsToTeam(eventId, teamId);

  const baseFilter = {
    teamId: new Types.ObjectId(teamId),
    eventId: new Types.ObjectId(eventId)
  };

  // Team-level note (always visible to team members if they reached this service)
  const teamNoteDoc = await GameNote.findOne({
    ...baseFilter,
    playerId: null
  });

  let playerNotesDocs: IGameNote[] = [];

  if (userTeamRole === RoleName.COACH || userTeamRole === RoleName.ASSISTANT_COACH) {
    // Coaches/assistants can see all player notes
    playerNotesDocs = await GameNote.find({
      ...baseFilter,
      playerId: { $ne: null }
    });
  } else if (userTeamRole === RoleName.PLAYER) {
    // Player sees only their own notes; resolve their player record
    const player = await Player.findOne({
      userId,
      teamId
    }).select('_id');

    if (player) {
      playerNotesDocs = await GameNote.find({
        ...baseFilter,
        playerId: player._id
      });
    } else {
      playerNotesDocs = [];
    }
  } else if (userTeamRole === RoleName.GUARDIAN) {
    // Guardian sees notes for linked players via permission service checks
    // First fetch all player notes, then filter by guardian links using permission service
    const candidateNotes = await GameNote.find({
      ...baseFilter,
      playerId: { $ne: null }
    });

    const allowedNotes: IGameNote[] = [];
    for (const note of candidateNotes) {
      const playerId = note.playerId?.toString();
      if (!playerId) continue;

      const perm = await permissionService.checkPermission({
        userId,
        teamId,
        resource: Resource.GAME_NOTE,
        action: Action.VIEW,
        playerId
      });
      if (perm.allowed) {
        allowedNotes.push(note);
      }
    }

    playerNotesDocs = allowedNotes;
  } else {
    playerNotesDocs = [];
  }

  return {
    teamNote: teamNoteDoc ? normalizeNote(teamNoteDoc) : undefined,
    playerNotes: playerNotesDocs.map(normalizeNote)
  };
};

