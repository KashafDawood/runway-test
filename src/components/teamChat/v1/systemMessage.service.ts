import { SystemEventKind } from './teamChat.interface';
import { createSystemMessage } from './teamChat.service';

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
    case SystemEventKind.PAYMENT_REQUEST_CREATED:
      return 'Payment request created';
    case SystemEventKind.GAME_NOTES_PUBLISHED:
      return 'Game notes published';
    default:
      return 'System notification';
  }
}

/**
 * Post a system message for a key action. Internal API for backend services.
 * When Event/Payment/GameNote components exist, call this after create/publish.
 *
 * @param teamId - Team chat to post to
 * @param eventKind - One of event_created, payment_request_created, game_notes_published
 * @param payload - Optional payload (eventId, title, paymentRequestId, noteId, etc.)
 */
export async function postSystemMessage(
  teamId: string,
  eventKind: SystemEventKind,
  payload?: Record<string, unknown>
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
