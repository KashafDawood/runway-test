import { SystemEventKind } from './teamChat.interface';
import { createSystemMessage } from './teamChat.service';
import type { EventSystemMessagePayload } from './systemMessagePayload.util';

export type NormalizedMessage = Awaited<ReturnType<typeof createSystemMessage>>;

/**
 * Build human-readable text for a system event.
 */
function getSystemMessageText(
  eventKind: SystemEventKind,
  payload?: Record<string, unknown>
): string {
  switch (eventKind) {
    case SystemEventKind.EVENT_CREATED:
      return payload?.title
        ? `Event created: ${String(payload.title)}`
        : 'Event created';
    case SystemEventKind.EVENT_UPDATED:
      return payload?.title
        ? `Event updated: ${String(payload.title)}`
        : 'Event updated';
    case SystemEventKind.PAYMENT_REQUEST_CREATED:
      return 'Payment request created';
    case SystemEventKind.GAME_NOTES_PUBLISHED:
      return 'Coach posted game notes';
    default:
      return 'System notification';
  }
}

/**
 * Post a system message for a key action. Internal API for backend services.
 * When Event/Payment/GameNote components exist, call this after create/publish.
 * For GAME_NOTES_PUBLISHED, include teamId and eventId in payload so the chat UI
 * can link the message to the notes screen (e.g. /teams/:teamId/events/:eventId/notes).
 *
 * @param teamId - Team chat to post to
 * @param eventKind - One of event_created, payment_request_created, game_notes_published
 * @param payload - Optional payload (teamId, eventId, title, paymentRequestId, noteId, etc.)
 */
export async function postSystemMessage(
  teamId: string,
  eventKind: SystemEventKind,
  payload?: Record<string, unknown> | EventSystemMessagePayload
): Promise<NormalizedMessage> {
  const text = getSystemMessageText(eventKind, payload);
  const meta = {
    eventKind,
    ...(payload ?? {})
  };
  return createSystemMessage({
    teamId,
    text,
    meta
  });
}
