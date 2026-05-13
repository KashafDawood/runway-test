import { Document, Types } from 'mongoose';

export type NotificationPlatform = 'android' | 'ios' | 'web';

export enum NotificationType {
  EVENT_CREATED = 'event_created',
  EVENT_REMINDER = 'event_reminder',
  GAME_NOTES_PUBLISHED = 'game_notes_published',
  INVITE_RECEIVED = 'invite_received',
  INVITE_APPROVED = 'invite_approved',
  INVITE_REJECTED = 'invite_rejected',
  EVENT_UPDATED = 'event_updated',
  EVENT_DELETED = 'event_deleted',
  ROLE_CHANGED = 'role_changed',
  GUARDIAN_LINK_REQUEST = 'guardian_link_request',
  GUARDIAN_LINK_APPROVED = 'guardian_link_approved',
  GUARDIAN_LINK_REJECTED = 'guardian_link_rejected',
  CHAT_MESSAGE = 'chat_message',
}

export type NotificationChannel = 'push' | 'email';

export interface IChannelResult {
  attempted: boolean;
  success: boolean;
}

export interface INotificationChannels {
  push: IChannelResult;
  email: IChannelResult;
}

export interface IDeviceToken {
  userId: string;
  token: string;
  platform?: NotificationPlatform;
  label?: string;
}

export interface IDeviceTokenDoc extends Omit<IDeviceToken, 'userId'>, Document {
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationPayload {
  title: string;
  body?: string;
  data?: Record<string, string>;
  imageUrl?: string;
  /** Frontend URL to open when the notification is clicked. Included in FCM data and webpush link. */
  clickUrl?: string;
}

export interface INotificationLog {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, string>;
  url: string;
  channels: INotificationChannels;
  sentAt: Date;
  readAt: Date | null;
  eventId?: Types.ObjectId;
  teamId?: Types.ObjectId;
  inviteId?: Types.ObjectId;
  guardianLinkId?: Types.ObjectId;
}

export interface INotificationLogDoc extends INotificationLog, Document {
  _id: Types.ObjectId;
}
