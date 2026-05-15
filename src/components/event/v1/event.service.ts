import httpStatus from 'http-status';
import mongoose from 'mongoose';
import AppError from '@core/utils/appError';
import { Event } from './event.model';
import { IEvent, EventType, RecurrenceRule, RecurrenceFrequency, CalendarView } from './event.interface';

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

/**
 * Compute date range for calendar view (month / week / day). Uses UTC for consistency.
 * Week: ISO week (Monday start).
 */
export function getRangeForView(view: CalendarView, date: Date): { rangeStart: Date; rangeEnd: Date } {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  if (view === 'month') {
    const rangeStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const rangeEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    return { rangeStart, rangeEnd };
  }

  if (view === 'week') {
    const dayOfWeek = d.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + mondayOffset);
    const rangeStart = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, 0, 0, 0));
    const sunday = new Date(rangeStart);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const rangeEnd = new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate(), 23, 59, 59, 999));
    return { rangeStart, rangeEnd };
  }

  const rangeStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const rangeEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  return { rangeStart, rangeEnd };
}

export interface CreateEventInput {
  type: EventType;
  title: string;
  description?: string;
  start?: Date;
  end?: Date | null;
  location?: string;
  locationUrl?: string;
  recurrence?: RecurrenceRule;
}

export interface UpdateEventInput {
  type?: EventType;
  title?: string;
  description?: string;
  start?: Date;
  end?: Date | null;
  location?: string;
  locationUrl?: string;
  recurrence?: RecurrenceRule | null;
}

export interface EventInstance {
  eventId: string;
  title: string;
  type: EventType;
  start: Date;
  end: Date | null;
  description?: string;
  location?: string;
  locationUrl?: string;
  isRecurring?: boolean;
  teamId?: string;
}

/** Event metadata for UI rendering (response-only, not stored). */
export interface CalendarEventMeta {
  allDay: boolean;
  durationMinutes: number | null;
  typeLabel: string;
}

export type EventInstanceWithMeta = EventInstance & CalendarEventMeta;

const TYPE_LABELS: Record<EventType, string> = {
  [EventType.PRACTICE]: 'Practice',
  [EventType.GAME]: 'Game',
  [EventType.CUSTOM]: 'Custom'
};

/** Enrich event instance with UI metadata (allDay, durationMinutes, typeLabel). */
export function enrichEventForCalendar(instance: EventInstance): EventInstanceWithMeta {
  const start = new Date(instance.start);
  const end = instance.end ? new Date(instance.end) : null;
  const allDay = end == null;
  const durationMinutes =
    end != null ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
  const typeLabel = TYPE_LABELS[instance.type] ?? instance.type;
  return {
    ...instance,
    allDay,
    durationMinutes,
    typeLabel
  };
}

/** Group events by day (YYYY-MM-DD in UTC). Each day's array sorted by start. */
export function groupEventsByDay(events: EventInstanceWithMeta[]): Record<string, EventInstanceWithMeta[]> {
  const byDay: Record<string, EventInstanceWithMeta[]> = {};
  for (const event of events) {
    const key = new Date(event.start).toISOString().slice(0, 10);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(event);
  }
  for (const key of Object.keys(byDay)) {
    byDay[key].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }
  return byDay;
}

/** Single-event response: one id only (no duplicate eventId). */
export function normalizeEvent(
  doc: IEvent
): Omit<EventInstance, 'eventId'> & { 
  id: string; 
  teamId?: string; 
  createdAt: Date; 
  updatedAt: Date; 
  createdBy: string 
} {
  const json = doc.toJSON() as {
    _id: { toString: () => string };
    teamId?: { toString: () => string };
    type: string;
    title: string;
    description?: string;
    start: Date;
    end?: Date;
    location?: string;
    locationUrl?: string;
    createdBy?: { toString: () => string };
    createdAt: Date;
    updatedAt: Date;
    recurrence?: unknown;
  };
  return {
    id: json._id.toString(),
    teamId: json.teamId?.toString(),
    type: json.type as EventType,
    title: json.title,
    description: json.description,
    start: json.start,
    end: json.end,
    location: json.location,
    locationUrl: json.locationUrl,
    createdBy: json.createdBy?.toString(),
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
    isRecurring: !!json.recurrence
  };
}

function addDuration(start: Date, frequency: RecurrenceFrequency, interval: number, times: number): Date {
  const d = new Date(start);
  if (frequency === 'daily') {
    d.setDate(d.getDate() + interval * times);
  } else if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7 * interval * times);
  } else {
    d.setMonth(d.getMonth() + interval * times);
  }
  return d;
}

function expandRecurringEvent(
  event: IEvent,
  rangeStart: Date,
  rangeEnd: Date
): Array<{ 
  eventId: string; 
  title: string; 
  type: EventType; 
  start: Date; 
  end: Date | null; 
  description?: string; 
  location?: string;
  locationUrl?: string;
  isRecurring: true 
}> {
  const recurrence = event.recurrence;
  if (!recurrence) return [];

  const result: Array<{ 
    eventId: string; 
    title: string; 
    type: EventType; 
    start: Date; 
    end: Date | null; 
    description?: string; 
    location?: string;
    locationUrl?: string;
    isRecurring: true 
  }> = [];
  const eventStart = new Date(event.start);
  const eventEnd = event.end ? new Date(event.end) : new Date(eventStart.getTime());
  const durationMs = eventEnd.getTime() - eventStart.getTime();
  const frequency = recurrence.frequency as RecurrenceFrequency;
  const interval = recurrence.interval || 1;
  const endDate = recurrence.endDate ? new Date(recurrence.endDate) : null;
  const count = recurrence.count ?? Number.MAX_SAFE_INTEGER;

  let occurrenceIndex = 0;
  let currentStart = new Date(eventStart);
  let currentEnd = new Date(eventEnd);

  while (occurrenceIndex < count) {
    if (endDate && currentStart > endDate) break;
    if (currentStart > rangeEnd) break;

    if (currentEnd >= rangeStart && currentStart <= rangeEnd) {
      result.push({
        eventId: (event._id as mongoose.Types.ObjectId).toString(),
        title: event.title,
        type: event.type,
        start: new Date(currentStart),
        end: event.end ? new Date(currentEnd) : null,
        description: event.description,
        location: event.location,
        locationUrl: event.locationUrl,
        isRecurring: true
      });
    }

    occurrenceIndex++;
    currentStart = addDuration(eventStart, frequency, interval, occurrenceIndex);
    currentEnd = new Date(currentStart.getTime() + durationMs);
  }

  return result;
}

export async function createEvent(
  teamId: string,
  userId: string,
  input: CreateEventInput
): Promise<ReturnType<typeof normalizeEvent>> {
  const start = input.start ? new Date(input.start) : new Date();
  const end = input.end != null && input.end !== undefined ? new Date(input.end) : null;

  if (end != null && start.getTime() >= end.getTime()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'End must be after start');
  }

  if (input.recurrence) {
    const r = input.recurrence;
    if (r.endDate && new Date(r.endDate) <= start) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Recurrence endDate must be after event start');
    }
    if (r.count !== undefined && r.count < 1) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Recurrence count must be at least 1');
    }
  }

  const created = await Event.create({
    teamId: toObjectId(teamId),
    createdBy: toObjectId(userId),
    type: input.type,
    title: input.title.trim(),
    description: input.description?.trim(),
    start,
    end: end ?? null,
    location: input.location?.trim(),
    locationUrl: input.locationUrl?.trim(),
    recurrence: input.recurrence
  });

  return normalizeEvent(created) as ReturnType<typeof normalizeEvent>;
}

export async function getEventById(eventId: string, teamId: string): Promise<IEvent> {
  const event = await Event.findOne({
    _id: toObjectId(eventId),
    teamId: toObjectId(teamId)
  });

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, 'Event not found');
  }
  return event;
}

export async function updateEvent(
  eventId: string,
  teamId: string,
  input: UpdateEventInput
): Promise<ReturnType<typeof normalizeEvent>> {
  const event = await getEventById(eventId, teamId);

  if (input.start != null && input.end != null && new Date(input.start).getTime() >= new Date(input.end).getTime()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'End must be after start');
  }

  const update: Record<string, unknown> = {};
  if (input.type !== undefined) update.type = input.type;
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.description !== undefined) update.description = input.description?.trim() ?? null;
  if (input.start !== undefined) update.start = new Date(input.start);
  if (Object.prototype.hasOwnProperty.call(input, 'end')) {
    update.end = input.end != null ? new Date(input.end) : null;
  }
  if (input.location !== undefined) {
    update.location = input.location?.trim() ?? null;
    if (!update.location) update.locationUrl = null;
  }
  if (input.locationUrl !== undefined) {
    update.locationUrl = input.locationUrl?.trim() ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'recurrence')) {
    update.recurrence = input.recurrence ?? undefined;
  }

  const updated = await Event.findByIdAndUpdate(
    event._id,
    { $set: update },
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw new AppError(httpStatus.NOT_FOUND, 'Event not found');
  }
  return normalizeEvent(updated) as ReturnType<typeof normalizeEvent>;
}

export async function deleteEvent(eventId: string, teamId: string): Promise<void> {
  await getEventById(eventId, teamId);
  await Event.deleteOne({ _id: toObjectId(eventId), teamId: toObjectId(teamId) });
}

export const DEFAULT_EVENT_PAGE = 1;
export const DEFAULT_EVENT_LIMIT = 20;
export const MAX_EVENT_LIMIT = 100;
/** Max instances returned for calendar view (month/week/day) to avoid runaway recurring expansion. */
export const CALENDAR_MAX_INSTANCES = 500;

export interface GetEventsResult {
  events: EventInstance[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function buildDateRangeQuery(rangeStart: Date, rangeEnd: Date) {
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  return {
    $or: [
      {
        recurrence: { $exists: false },
        start: { $lt: end },
        $or: [{ end: null }, { end: { $gt: start } }]
      },
      {
        recurrence: { $exists: true, $ne: null },
        start: { $lte: end },
        $or: [
          { 'recurrence.endDate': { $exists: false } },
          { 'recurrence.endDate': { $gte: start } }
        ]
      }
    ]
  };
}

export async function getEventsByTeamAndDateRange(
  teamId: string,
  options: {
    rangeStart?: Date;
    rangeEnd?: Date;
    page?: number;
    limit?: number;
    calendarView?: boolean;
  } = {}
): Promise<GetEventsResult> {
  const page = Math.max(1, options.page ?? DEFAULT_EVENT_PAGE);
  const limit = Math.min(MAX_EVENT_LIMIT, Math.max(1, options.limit ?? DEFAULT_EVENT_LIMIT));
  const hasRange = options.rangeStart != null && options.rangeEnd != null;
  const calendarView = options.calendarView === true;

  if (hasRange) {
    const start = new Date(options.rangeStart!);
    const end = new Date(options.rangeEnd!);
    if (start > end) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Range start must be before or equal to end');
    }

    const events = await Event.find({
      teamId: toObjectId(teamId),
      ...buildDateRangeQuery(start, end)
    }).sort({ start: 1 });

    const instances: EventInstance[] = [];
    for (const event of events) {
      if (!event.recurrence) {
        instances.push({
          eventId: (event._id as mongoose.Types.ObjectId).toString(),
          title: event.title,
          type: event.type,
          start: event.start,
          end: event.end ?? null,
          description: event.description,
          location: event.location,
          locationUrl: event.locationUrl,
          isRecurring: false
        });
      } else {
        const expanded = expandRecurringEvent(event, start, end);
        instances.push(...expanded);
      }
    }
    instances.sort((a, b) => a.start.getTime() - b.start.getTime());

    const total = instances.length;
    if (calendarView) {
      const capped = instances.slice(0, CALENDAR_MAX_INSTANCES);
      return { events: capped, total: capped.length, page: 1, limit: capped.length, totalPages: 1 };
    }
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const skip = (page - 1) * limit;
    const paginated = instances.slice(skip, skip + limit);
    return { events: paginated, total, page, limit, totalPages };
  }

  const skip = (page - 1) * limit;
  const [events, total] = await Promise.all([
    Event.find({ teamId: toObjectId(teamId) })
      .sort({ start: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Event.countDocuments({ teamId: toObjectId(teamId) })
  ]);

  const instances: EventInstance[] = events.map((e: {
    _id: { toString: () => string };
    title: string;
    type: EventType;
    start: Date;
    end?: Date;
    description?: string;
    location?: string;
    locationUrl?: string;
    recurrence?: unknown;
  }) => ({
    eventId: e._id.toString(),
    title: e.title,
    type: e.type,
    start: e.start,
    end: e.end ?? null,
    description: e.description,
    location: e.location,
    locationUrl: e.locationUrl,
    isRecurring: !!e.recurrence
  }));

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { events: instances, total, page, limit, totalPages };
}

export async function getEventsByTeams(
  teamIds: string[],
  options: {
    rangeStart?: Date;
    rangeEnd?: Date;
    page?: number;
    limit?: number;
    calendarView?: boolean;
  } = {}
): Promise<GetEventsResult> {
  if (teamIds.length === 0) {
    return { 
      events: [], 
      total: 0, 
      page: options.page ?? DEFAULT_EVENT_PAGE, 
      limit: options.limit ?? DEFAULT_EVENT_LIMIT, 
      totalPages: 0 
    };
  }

  const page = Math.max(1, options.page ?? DEFAULT_EVENT_PAGE);
  const limit = Math.min(MAX_EVENT_LIMIT, Math.max(1, options.limit ?? DEFAULT_EVENT_LIMIT));
  const hasRange = options.rangeStart != null && options.rangeEnd != null;
  const calendarView = options.calendarView === true;
  const teamObjectIds = teamIds.map((id) => toObjectId(id));

  if (hasRange) {
    const start = new Date(options.rangeStart!);
    const end = new Date(options.rangeEnd!);
    if (start > end) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Range start must be before or equal to end');
    }

    const events = await Event.find({
      teamId: { $in: teamObjectIds },
      ...buildDateRangeQuery(start, end)
    }).sort({ start: 1 });

    const instances: EventInstance[] = [];
    for (const event of events) {
      const e = event as IEvent;
      if (!e.recurrence) {
        instances.push({
          eventId: (e._id as mongoose.Types.ObjectId).toString(),
          teamId: e.teamId?.toString(),
          title: e.title,
          type: e.type,
          start: e.start,
          end: e.end ?? null,
          description: e.description,
          location: e.location,
          locationUrl: e.locationUrl,
          isRecurring: false
        });
      } else {
        const expanded = expandRecurringEvent(e, start, end);
        instances.push(...expanded.map((x) => ({ ...x, teamId: e.teamId?.toString() })));
      }
    }
    instances.sort((a, b) => a.start.getTime() - b.start.getTime());

    const total = instances.length;
    if (calendarView) {
      const capped = instances.slice(0, CALENDAR_MAX_INSTANCES);
      return { events: capped, total: capped.length, page: 1, limit: capped.length, totalPages: 1 };
    }
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const skip = (page - 1) * limit;
    const paginated = instances.slice(skip, skip + limit);
    return { events: paginated, total, page, limit, totalPages };
  }

  const skip = (page - 1) * limit;
  const [events, total] = await Promise.all([
    Event.find({ teamId: { $in: teamObjectIds } })
      .sort({ start: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Event.countDocuments({ teamId: { $in: teamObjectIds } })
  ]);

  const instances: EventInstance[] = (events as Array<{
    _id: { toString: () => string };
    teamId?: { toString: () => string };
    title: string;
    type: EventType;
    start: Date;
    end?: Date;
    description?: string;
    location?: string;
    locationUrl?: string;
    recurrence?: unknown;
  }>).map((e) => ({
    eventId: e._id.toString(),
    teamId: e.teamId?.toString(),
    title: e.title,
    type: e.type,
    start: e.start,
    end: e.end ?? null,
    description: e.description,
    location: e.location,
    locationUrl: e.locationUrl,
    isRecurring: !!e.recurrence
  }));

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { events: instances, total, page, limit, totalPages };
}
