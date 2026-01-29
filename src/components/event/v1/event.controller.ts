import { Request, Response } from 'express';
import httpStatus from 'http-status';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import * as eventService from './event.service';
import { postSystemMessage } from '@components/teamChat/v1/systemMessage.service';
import { SystemEventKind } from '@components/teamChat/v1/teamChat.interface';
import { EventType } from './event.interface';

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
 * List events for team (team member). start/end optional; if omitted returns all events. Paginated.
 */
export const getEventsByDateRange = asyncWrapper(async (req: Request, res: Response) => {
  const { teamId } = req.params;
  const { start, end, page, limit } = req.query as {
    start?: string;
    end?: string;
    page?: string;
    limit?: string;
  };

  if (!teamId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
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
 * Broad view: list events for one or more teams (teamIds filter). If teamIds omitted, returns events for all teams the user is a member of. start/end optional; paginated.
 */
export const getEventsBroadView = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { teamIds, start, end, page, limit } = req.query as {
    teamIds?: string | string[];
    start?: string;
    end?: string;
    page?: string;
    limit?: string;
  };

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
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
