/**
 * Rich payload fields stored on system message meta for chat event cards.
 */
export interface EventSystemMessagePayload {
  eventId: string;
  title: string;
  start?: string;
  end?: string | null;
  location?: string;
  eventType?: string;
  actorName?: string;
  attendingCount?: number;
  [key: string]: unknown;
}

type EventLike = {
  id: string;
  title: string;
  start?: Date | string;
  end?: Date | string | null;
  location?: string;
  type?: string;
};

function toIso(value?: Date | string | null): string | undefined {
  if (value == null) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function buildEventSystemMessagePayload(
  event: EventLike,
  extras?: { actorName?: string; attendingCount?: number }
): EventSystemMessagePayload {
  return {
    eventId: event.id,
    title: event.title,
    start: toIso(event.start),
    end: event.end != null ? toIso(event.end) ?? null : null,
    location: event.location?.trim() || undefined,
    eventType: event.type,
    actorName: extras?.actorName?.trim() || undefined,
    attendingCount:
      typeof extras?.attendingCount === 'number' && extras.attendingCount >= 0
        ? extras.attendingCount
        : undefined
  };
}
