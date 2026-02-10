import mongoose, { Schema } from 'mongoose';
import { IGameNote } from './gameNote.interface';

const gameNoteSchema = new Schema<IGameNote>(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'teamId is required'],
      index: true
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'eventId is required'],
      index: true
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
      index: true
    },
    text: {
      type: String,
      required: [true, 'text is required'],
      trim: true,
      maxlength: [4000, 'Note text cannot exceed 4000 characters']
    },
    tags: {
      type: [String],
      default: [],
      trim: true,
      validate: {
        validator: (v: string[]) => v.length <= 20,
        message: 'Cannot have more than 20 tags'
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy is required']
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

// Exactly one note per team+event+player (player can be null for team-level note)
gameNoteSchema.index(
  { teamId: 1, eventId: 1, playerId: 1 },
  { unique: true }
);

gameNoteSchema.index({ teamId: 1, eventId: 1 });

export const GameNote = mongoose.model<IGameNote>('GameNote', gameNoteSchema);

