import { Request, Response } from 'express';
import httpStatus from 'http-status';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import * as eventService from './event.service';
import * as rsvpService from './rsvp.service';
import { postSystemMessage } from '@components/teamChat/v1/systemMessage.service';
import { SystemEventKind } from '@components/teamChat/v1/teamChat.interface';
import { EventType } from './event.interface';
import { permissionService } from '@shared/services/permission.service';
import { Resource, Action } from '@shared/types/permission.types';
import { RoleName } from '@components/role/v1/role.interface';

/**
 * POST /api/v1/teams-event/:teamId/events
 * Create event (admin only). Posts system message to team chat on success.
 */
export const createEvent = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { teamId } = req.params;
  const body = req.body as {
    type: EventType;
    title: string;
    description?: string;
    start?: string;
    end?: string | null;
    location?: string;
    recurrence?: { frequency: string; interval: number; endDate?: string; count?: number };
  };

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }
  if (!teamId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
  }

  const event = await eventService.createEvent(teamId, String(userId), {
    type: body.type as EventType,
    title: body.title,
    description: body.description,
    start: body.start != null ? new Date(body.start) : undefined,
    end: body.end != null ? new Date(body.end) : null,
    location: body.location,
    recurrence: body.recurrence
      ? {
          frequency: body.recurrence.frequency as 'daily' | 'weekly' | 'monthly',
          interval: body.recurrence.interval,
          endDate: body.recurrence.endDate ? new Date(body.recurrence.endDate) : undefined,
          count: body.recurrence.count
        }
      : undefined
  });

  try {
    await postSystemMessage(teamId, SystemEventKind.EVENT_CREATED, {
      eventId: event.id,
      title: event.title
    });
  } catch (err) {
    console.error('Failed to post system message for event created:', err);
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    data: event
  });
});

/**
 * GET /api/v1/teams-event/:teamId/events/:eventId
 * Get one event by ID (team member).
 */
export const getEvent = asyncWrapper(async (req: Request, res: Response) => {
  const { teamId, eventId } = req.params;

  if (!teamId || !eventId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID and Event ID are required');
  }

  const doc = await eventService.getEventById(eventId, teamId);
  const normalized = eventService.normalizeEvent(doc);

  res.status(httpStatus.OK).json({
    success: true,
    data: normalized
  });
});

/**
 * PUT /api/v1/teams-event/:teamId/events/:eventId
 * Update event (admin only).
 */
export const updateEvent = asyncWrapper(async (req: Request, res: Response) => {
  const { teamId, eventId } = req.params;
  const body = req.body as {
    type?: EventType;
    title?: string;
    description?: string;
    start?: string;
    end?: string;
    location?: string;
    recurrence?: { frequency: string; interval: number; endDate?: string; count?: number } | null;
  };

  if (!teamId || !eventId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID and Event ID are required');
  }

  const event = await eventService.updateEvent(eventId, teamId, {
    type: body.type,
    title: body.title,
    description: body.description,
    start: body.start ? new Date(body.start) : undefined,
    end: Object.prototype.hasOwnProperty.call(body, 'end')
      ? (body.end != null ? new Date(body.end) : null)
      : undefined,
    location: body.location,
    recurrence:
      body.recurrence === null
        ? null
        : body.recurrence
          ? {
              frequency: body.recurrence.frequency as 'daily' | 'weekly' | 'monthly',
              interval: body.recurrence.interval,
              endDate: body.recurrence.endDate ? new Date(body.recurrence.endDate) : undefined,
              count: body.recurrence.count
            }
          : undefined
  });

  try {
    await postSystemMessage(teamId, SystemEventKind.EVENT_UPDATED, {
      eventId: event.id,
      title: event.title
    });
  } catch (err) {
    console.error('Failed to post system message for event updated:', err);
  }

  res.status(httpStatus.OK).json({
    success: true,
    data: event
  });
});

/**
 * DELETE /api/v1/teams-event/:teamId/events/:eventId
 * Delete event (admin only).
 */
export const deleteEvent = asyncWrapper(async (req: Request, res: Response) => {
  const { teamId, eventId } = req.params;

  if (!teamId || !eventId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID and Event ID are required');
  }

  await eventService.deleteEvent(eventId, teamId);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * GET /api/v1/teams-event/:teamId/events?start=ISO&end=ISO&page=1&limit=20
 * Or ?view=month|week|day&date=ISO for calendar view (rangeStart, rangeEnd, groupedByDay, meta).
 * List events for team (team member). start/end optional; if omitted returns all events. Paginated unless view+date used.
 */
export const getEventsByDateRange = asyncWrapper(async (req: Request, res: Response) => {
  const { teamId } = req.params;
  const { start, end, page, limit, view, date } = req.query as {
    start?: string;
    end?: string;
    page?: string;
    limit?: string;
    view?: 'month' | 'week' | 'day';
    date?: string;
  };

  if (!teamId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
  }

  const isCalendarView =
    (view === 'month' || view === 'week' || view === 'day') && date != null && String(date).trim() !== '';
  if ((view === 'month' || view === 'week' || view === 'day') && (!date || String(date).trim() === '')) {
    throw new AppError(httpStatus.BAD_REQUEST, 'date is required when view is provided');
  }

  if (isCalendarView && view && date) {
    const range = eventService.getRangeForView(view, new Date(date));
    const result = await eventService.getEventsByTeamAndDateRange(teamId, {
      rangeStart: range.rangeStart,
      rangeEnd: range.rangeEnd,
      calendarView: true
    });
    const enriched = result.events.map(eventService.enrichEventForCalendar);
    const groupedByDay = eventService.groupEventsByDay(enriched);
    res.status(httpStatus.OK).json({
      success: true,
      data: enriched,
      rangeStart: range.rangeStart.toISOString(),
      rangeEnd: range.rangeEnd.toISOString(),
      groupedByDay,
      meta: { view, date }
    });
    return;
  }

  const options: Parameters<typeof eventService.getEventsByTeamAndDateRange>[1] = {
    page: page ? parseInt(page, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined
  };
  if (start != null && end != null) {
    options.rangeStart = new Date(start);
    options.rangeEnd = new Date(end);
  }

  const result = await eventService.getEventsByTeamAndDateRange(teamId, options);

  res.status(httpStatus.OK).json({
    success: true,
    data: result.events,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    }
  });
});

/**
 * GET /api/v1/teams-event/events?teamIds=id1,id2&start=ISO&end=ISO&page=1&limit=20
 * Or ?view=month|week|day&date=ISO for calendar view (rangeStart, rangeEnd, groupedByDay, meta).
 * Broad view: list events for one or more teams (teamIds filter). If teamIds omitted, returns events for all teams the user is a member of. start/end optional; paginated unless view+date used.
 */
export const getEventsBroadView = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { teamIds, start, end, page, limit, view, date } = req.query as {
    teamIds?: string | string[];
    start?: string;
    end?: string;
    page?: string;
    limit?: string;
    view?: 'month' | 'week' | 'day';
    date?: string;
  };

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const isCalendarViewBroad =
    (view === 'month' || view === 'week' || view === 'day') && date != null && String(date).trim() !== '';
  if ((view === 'month' || view === 'week' || view === 'day') && (!date || String(date).trim() === '')) {
    throw new AppError(httpStatus.BAD_REQUEST, 'date is required when view is provided');
  }

  const { UserRole } = await import('@components/userRole/v1/userRole.model');
  const { UserRoleStatus } = await import('@components/userRole/v1/userRole.interface');

  let teamIdsList: string[];
  if (teamIds != null) {
    const requested = Array.isArray(teamIds) ? teamIds : teamIds.split(',').map((s) => s.trim()).filter(Boolean);
    const memberRoles = await UserRole.find({
      userId,
      teamId: { $in: requested },
      status: UserRoleStatus.ACTIVE
    })
      .select('teamId')
      .lean();
    teamIdsList = memberRoles.map((r: any) => r.teamId?.toString()).filter(Boolean);
  } else {
    const roles = await UserRole.find({
      userId,
      status: UserRoleStatus.ACTIVE
    })
      .select('teamId')
      .lean();
    teamIdsList = roles.map((r: any) => r.teamId?.toString()).filter(Boolean);
  }

  if (isCalendarViewBroad && view && date) {
    const range = eventService.getRangeForView(view, new Date(date));
    const result = await eventService.getEventsByTeams(teamIdsList, {
      rangeStart: range.rangeStart,
      rangeEnd: range.rangeEnd,
      calendarView: true
    });
    const enriched = result.events.map(eventService.enrichEventForCalendar);
    const groupedByDay = eventService.groupEventsByDay(enriched);
    res.status(httpStatus.OK).json({
      success: true,
      data: enriched,
      rangeStart: range.rangeStart.toISOString(),
      rangeEnd: range.rangeEnd.toISOString(),
      groupedByDay,
      meta: { view, date }
    });
    return;
  }

  const options: Parameters<typeof eventService.getEventsByTeams>[1] = {
    page: page ? parseInt(page, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined
  };
  if (start != null && end != null) {
    options.rangeStart = new Date(start);
    options.rangeEnd = new Date(end);
  }

  const result = await eventService.getEventsByTeams(teamIdsList, options);

  res.status(httpStatus.OK).json({
    success: true,
    data: result.events,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    }
  });
});

/**
 * PUT /api/v1/teams-event/:teamId/events/:eventId/rsvp
 * Create or update RSVP (player or guardian only). Last action wins.
 */
export const putRsvp = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const teamId = (req as any).teamId as string;
  const userTeamRole = (req as any).userTeamRole as RoleName;
  const { eventId } = req.params;
  const body = req.body as { status: 'attending' | 'not_attending'; playerId?: string };

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }
  if (!teamId || !eventId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID and Event ID are required');
  }

  if (userTeamRole !== RoleName.PLAYER && userTeamRole !== RoleName.GUARDIAN) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only players and guardians can set RSVP');
  }

  await eventService.getEventById(eventId, teamId);

  let playerId: string;
  if (userTeamRole === RoleName.PLAYER) {
    const resolved = await rsvpService.getPlayerIdForUser(teamId, String(userId));
    playerId =
      resolved ??
      (await rsvpService.ensurePlayerForUser(teamId, String(userId), {
        name: req.user?.name,
        email: req.user?.email
      }));
  } else {
    if (!body.playerId || String(body.playerId).trim() === '') {
      throw new AppError(httpStatus.BAD_REQUEST, 'playerId is required for guardians');
    }
    playerId = body.playerId.trim();
  }

  const perm = await permissionService.checkPermission({
    userId: String(userId),
    teamId,
    resource: Resource.RSVP,
    action: Action.UPDATE,
    playerId: userTeamRole === RoleName.GUARDIAN ? playerId : undefined,
    targetUserId: userTeamRole === RoleName.PLAYER ? String(userId) : undefined
  });
  if (!perm.allowed) {
    throw new AppError(httpStatus.FORBIDDEN, perm.reason ?? 'Not allowed to set RSVP for this player');
  }

  const rsvp = await rsvpService.upsertRsvp(
    eventId,
    playerId,
    teamId,
    body.status as 'attending' | 'not_attending',
    String(userId)
  );

  res.status(httpStatus.OK).json({
    success: true,
    data: rsvp
  });
});

/**
 * GET /api/v1/teams-event/:teamId/events/:eventId/rsvp?playerId=...
 * Get RSVP for event. Player: own (no playerId). Guardian: playerId required. Coach: any playerId or omit for summary via other endpoint.
 */
export const getRsvp = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const teamId = (req as any).teamId as string;
  const userTeamRole = (req as any).userTeamRole as RoleName;
  const { eventId } = req.params;
  const { playerId: queryPlayerId } = req.query as { playerId?: string };

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }
  if (!teamId || !eventId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID and Event ID are required');
  }

  await eventService.getEventById(eventId, teamId);

  let playerId: string;
  if (userTeamRole === RoleName.PLAYER) {
    const resolved = await rsvpService.getPlayerIdForUser(teamId, String(userId));
    playerId =
      resolved ??
      (await rsvpService.ensurePlayerForUser(teamId, String(userId), {
        name: req.user?.name,
        email: req.user?.email
      }));
  } else if (userTeamRole === RoleName.GUARDIAN) {
    if (!queryPlayerId || String(queryPlayerId).trim() === '') {
      throw new AppError(httpStatus.BAD_REQUEST, 'playerId query is required for guardians');
    }
    playerId = queryPlayerId.trim();
  } else {
    if (!queryPlayerId || String(queryPlayerId).trim() === '') {
      throw new AppError(httpStatus.BAD_REQUEST, 'playerId query is required');
    }
    playerId = queryPlayerId.trim();
  }

  const perm = await permissionService.checkPermission({
    userId: String(userId),
    teamId,
    resource: Resource.RSVP,
    action: Action.VIEW,
    playerId: userTeamRole === RoleName.GUARDIAN || userTeamRole === RoleName.COACH || userTeamRole === RoleName.ASSISTANT_COACH ? playerId : undefined,
    targetUserId: userTeamRole === RoleName.PLAYER ? String(userId) : undefined
  });
  if (!perm.allowed) {
    throw new AppError(httpStatus.FORBIDDEN, perm.reason ?? 'Not allowed to view this RSVP');
  }

  const rsvp = await rsvpService.getRsvp(eventId, playerId);
  if (!rsvp) {
    throw new AppError(httpStatus.NOT_FOUND, 'RSVP not found');
  }

  res.status(httpStatus.OK).json({
    success: true,
    data: rsvp
  });
});

/**
 * GET /api/v1/teams-event/:teamId/events/:eventId/rsvp/summary
 * RSVP aggregation for event (coach/assistant only).
 */
export const getRsvpSummary = asyncWrapper(async (req: Request, res: Response) => {
  const { teamId, eventId } = req.params;

  if (!teamId || !eventId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID and Event ID are required');
  }

  await eventService.getEventById(eventId, teamId);

  const summary = await rsvpService.getRsvpSummary(eventId, teamId);

  res.status(httpStatus.OK).json({
    success: true,
    data: summary
  });
});
