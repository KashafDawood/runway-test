import mongoose, { Schema } from 'mongoose';
import { INotificationLogDoc, NotificationType } from './notification.interface';

const channelResultSchema = new Schema(
  {
    attempted: { type: Boolean, default: false },
    success: { type: Boolean, default: false },
  },
  { _id: false }
);

const notificationLogSchema = new Schema<INotificationLogDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      trim: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    channels: {
      push: { type: channelResultSchema, default: () => ({ attempted: false, success: false }) },
      email: { type: channelResultSchema, default: () => ({ attempted: false, success: false }) },
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
    inviteId: {
      type: Schema.Types.ObjectId,
      ref: 'TeamInvite',
      default: null,
    },
    guardianLinkId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

notificationLogSchema.index({ userId: 1, sentAt: -1 });
notificationLogSchema.index({ userId: 1, readAt: 1, sentAt: -1 });
notificationLogSchema.index({ userId: 1, type: 1, sentAt: -1 });
notificationLogSchema.index({ eventId: 1, userId: 1, type: 1 });

const NotificationLogModel = mongoose.model<INotificationLogDoc>(
  'NotificationLog',
  notificationLogSchema
);

export default NotificationLogModel;
