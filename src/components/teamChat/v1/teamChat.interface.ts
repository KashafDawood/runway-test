import { Document, Types } from 'mongoose';

export enum TeamMessageType {
  USER = 'user',
  SYSTEM = 'system'
}

/**
 * System event kinds for automatic system messages.
 * Used in meta.eventKind for typed system messages.
 */
export enum SystemEventKind {
  EVENT_CREATED = 'event_created',
  EVENT_UPDATED = 'event_updated',
  PAYMENT_REQUEST_CREATED = 'payment_request_created',
  GAME_NOTES_PUBLISHED = 'game_notes_published'
}

/**
 * Standard meta for system messages (type === SYSTEM).
 * - eventKind: required for typed system messages
 * - Optional payload: teamId, eventId, paymentRequestId, noteId, title, etc.
 * - For GAME_NOTES_PUBLISHED: teamId + eventId allow building link to notes screen (e.g. /teams/:teamId/events/:eventId/notes).
 * - System messages are read-only; clients must not allow edit/delete for type === SYSTEM.
 */
export interface SystemMessageMeta {
  eventKind: SystemEventKind;
  teamId?: string;
  eventId?: string;
  paymentRequestId?: string;
  noteId?: string;
  title?: string;
  [key: string]: unknown;
}

export interface ITeamMessage extends Document {
  _id: string;
  teamId: Types.ObjectId;
  senderId?: Types.ObjectId | null;
  type: TeamMessageType;
  text: string;
  /** For system messages: { eventKind, ...payload }. For user messages: undefined. */
  meta?: Record<string, unknown> | SystemMessageMeta;
  createdAt: Date;
  updatedAt: Date;
}

