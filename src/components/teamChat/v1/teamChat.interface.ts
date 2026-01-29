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
  PAYMENT_REQUEST_CREATED = 'payment_request_created',
  GAME_NOTES_PUBLISHED = 'game_notes_published'
}

/**
 * Standard meta for system messages (type === SYSTEM).
 * - eventKind: required for typed system messages
 * - Optional payload: eventId, paymentRequestId, noteId, title, etc.
 */
export interface SystemMessageMeta {
  eventKind: SystemEventKind;
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
  meta?: Record<string, any> | SystemMessageMeta;
  createdAt: Date;
  updatedAt: Date;
}

