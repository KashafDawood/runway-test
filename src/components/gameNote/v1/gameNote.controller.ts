import httpStatus from 'http-status';
import { Response } from 'express';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import { RequestWithContext } from 'types/request';
import { RoleName } from '@components/role/v1/role.interface';
import * as gameNoteService from './gameNote.service';
import { postSystemMessage } from '@components/teamChat/v1/systemMessage.service';
import { SystemEventKind } from '@components/teamChat/v1/teamChat.interface';
import { Team } from '@components/team/v1/team.model';
import { Event } from '@components/event/v1/event.model';
import { notifyGameNotesPublished } from '@components/notification/v1/notificationDelivery.service';
import logger from '@core/utils/logger';

/**
 * POST /api/v1/teams-event/:teamId/events/:eventId/notes/team
 * Create or update team-level game note (coach/assistant only).
 */
export const upsertTeamNote = asyncWrapper(async (req: RequestWithContext, res: Response) => {
  const userId = req.user?._id;
  const teamId = req.teamId as string;
  const { eventId } = req.params;
  const body = req.body as { text?: string; tags?: string[] };

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }
  if (!teamId || !eventId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID and Event ID are required');
  }
  if (!body.text || String(body.text).trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'text is required');
  }

  const note = await gameNoteService.upsertTeamNote({
    teamId,
    eventId,
    userId: String(userId),
    text: String(body.text).trim(),
    tags: body.tags
  });

  try {
    await postSystemMessage(teamId, SystemEventKind.GAME_NOTES_PUBLISHED, {
      teamId,
      eventId: note.eventId,
      noteId: note.id
    });
  } catch (err) {
    logger.error('Failed to post system message for game notes published', err);
  }

  try {
    const [team, eventDoc] = await Promise.all([
      Team.findById(teamId).select('name').lean(),
      Event.findById(eventId).select('title').lean(),
    ]);
    if (team?.name && eventDoc?.title) {
      await notifyGameNotesPublished({
        teamId,
        eventId: note.eventId,
        authorUserId: String(userId),
        authorName: req.user?.name ?? 'A coach',
        teamName: team.name,
        eventTitle: eventDoc.title,
      });
    }
  } catch (err) {
    logger.error('Failed to send game notes published notifications', err);
  }

  res.status(httpStatus.OK).json({
    success: true,
    data: note
  });
});

/**
 * POST /api/v1/teams-event/:teamId/events/:eventId/notes/player
 * Create or update player-specific game note (coach/assistant only).
 */
export const upsertPlayerNote = asyncWrapper(async (req: RequestWithContext, res: Response) => {
  const userId = req.user?._id;
  const teamId = req.teamId as string;
  const { eventId } = req.params;
  const body = req.body as { text?: string; playerId?: string; tags?: string[] };

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }
  if (!teamId || !eventId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID and Event ID are required');
  }
  if (!body.playerId || String(body.playerId).trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'playerId is required');
  }
  if (!body.text || String(body.text).trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'text is required');
  }

  const note = await gameNoteService.upsertPlayerNote({
    teamId,
    eventId,
    userId: String(userId),
    playerId: String(body.playerId).trim(),
    text: String(body.text).trim(),
    tags: body.tags
  });

  try {
    await postSystemMessage(teamId, SystemEventKind.GAME_NOTES_PUBLISHED, {
      teamId,
      eventId: note.eventId,
      noteId: note.id,
      playerId: note.playerId
    });
  } catch (err) {
    logger.error('Failed to post system message for player game notes published', err);
  }

  try {
    const [team, eventDoc] = await Promise.all([
      Team.findById(teamId).select('name').lean(),
      Event.findById(eventId).select('title').lean(),
    ]);
    if (team?.name && eventDoc?.title) {
      await notifyGameNotesPublished({
        teamId,
        eventId: note.eventId,
        authorUserId: String(userId),
        authorName: req.user?.name ?? 'A coach',
        teamName: team.name,
        eventTitle: eventDoc.title,
      });
    }
  } catch (err) {
    logger.error('Failed to send game notes published notifications', err);
  }

  res.status(httpStatus.OK).json({
    success: true,
    data: note
  });
});

/**
 * GET /api/v1/teams-event/:teamId/events/:eventId/notes
 * Get team-level and player-specific notes visible to current user.
 * - Coach/assistant: team note + all player notes.
 * - Player: team note + own player note.
 * - Guardian: team note + notes for linked player(s).
 */
export const getEventNotes = asyncWrapper(async (req: RequestWithContext, res: Response) => {
  const userId = req.user?._id;
  const teamId = req.teamId as string;
  const userTeamRole = req.userTeamRole as RoleName;
  const { eventId } = req.params;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }
  if (!teamId || !eventId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID and Event ID are required');
  }

  const result = await gameNoteService.getEventNotesForUser({
    teamId,
    eventId,
    userId: String(userId),
    userTeamRole
  });

  res.status(httpStatus.OK).json({
    success: true,
    data: result
  });
});

