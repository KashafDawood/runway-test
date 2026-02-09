import mongoose, { Schema } from 'mongoose';
import { IRsvp } from './rsvp.interface';

const RSVP_STATUSES = ['attending', 'not_attending'] as const;

const rsvpSchema = new Schema<IRsvp>(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: [true, 'Player ID is required'],
      index: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team ID is required'],
      index: true
    },
    status: {
      type: String,
      enum: RSVP_STATUSES,
      required: [true, 'Status is required']
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

rsvpSchema.index({ eventId: 1, playerId: 1 }, { unique: true });
rsvpSchema.index({ eventId: 1 });
rsvpSchema.index({ teamId: 1 });

export const Rsvp = mongoose.model<IRsvp>('Rsvp', rsvpSchema);
