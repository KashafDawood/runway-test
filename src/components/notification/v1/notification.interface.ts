import { Document, Types } from 'mongoose';

export type NotificationPlatform = 'android' | 'ios' | 'web';

export enum NotificationType {
  EVENT_CREATED = 'event_created',
  EVENT_REMINDER = 'event_reminder',
  GAME_NOTES_PUBLISHED = 'game_notes_published',
}

export type NotificationChannel = 'push' | 'email';

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
}

export interface INotificationLog {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, string>;
  channel: NotificationChannel;
  sentAt: Date;
  eventId?: Types.ObjectId;
  teamId?: Types.ObjectId;
}

export interface INotificationLogDoc extends INotificationLog, Document {
  _id: Types.ObjectId;
}
