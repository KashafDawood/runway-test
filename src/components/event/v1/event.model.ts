import mongoose, { Schema } from 'mongoose';
import { IEvent, EventType } from './event.interface';

const RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

const recurrenceRuleSchema = new Schema(
  {
    frequency: {
      type: String,
      enum: RECURRENCE_FREQUENCIES,
      required: true
    },
    interval: {
      type: Number,
      required: true,
      min: 1
    },
    endDate: { type: Date },
    count: { type: Number, min: 1 }
  },
  { _id: false }
);

const eventSchema = new Schema<IEvent>(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team ID is required'],
      index: true
    },
    type: {
      type: String,
      enum: Object.values(EventType),
      required: [true, 'Event type is required'],
      default: EventType.CUSTOM
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    start: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true
    },
    end: {
      type: Date,
      default: null,
      index: true
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters']
    },
    locationUrl: {
      type: String,
      trim: true,
      maxlength: [2048, 'Location URL cannot exceed 2048 characters']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy is required'],
      index: true
    },
    recurrence: recurrenceRuleSchema
  },
  {
    timestamps: true,
    versionKey: false
  }
);

eventSchema.index({ teamId: 1, start: 1 });
eventSchema.index({ teamId: 1, end: 1 });

export const Event = mongoose.model<IEvent>('Event', eventSchema);
