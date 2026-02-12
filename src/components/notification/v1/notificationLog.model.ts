import mongoose, { Schema } from 'mongoose';
import { INotificationLogDoc } from './notification.interface';
import { NotificationType } from './notification.interface';

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
    channel: {
      type: String,
      enum: ['push', 'email'],
      required: true,
      index: true,
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
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
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

notificationLogSchema.index({ userId: 1, type: 1, sentAt: -1 });
notificationLogSchema.index({ eventId: 1, userId: 1, type: 1 });

const NotificationLogModel = mongoose.model<INotificationLogDoc>(
  'NotificationLog',
  notificationLogSchema
);

export default NotificationLogModel;
