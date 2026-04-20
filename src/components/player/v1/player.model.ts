import mongoose, { Schema } from 'mongoose';
import { IPlayer } from './player.interface';
import { isMinorFromDateOfBirth } from '@shared/utils/age.util';

const playerSchema = new Schema<IPlayer>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'teamId is required'],
      index: true
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    dateOfBirth: {
      type: Date
    },
    jerseyNumber: {
      type: String,
      trim: true,
      maxlength: [10, 'Jersey number cannot exceed 10 characters']
    },
    position: {
      type: String,
      trim: true,
      maxlength: [50, 'Position cannot exceed 50 characters']
    },
    isMinor: {
      type: Boolean,
      default: false
    },
    hasEmail: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy is required']
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes
playerSchema.index({ userId: 1, teamId: 1 });
playerSchema.index({ teamId: 1, lastName: 1, firstName: 1 });

// Pre-save hook to compute isMinor
playerSchema.pre<IPlayer>('save', function (next) {
  if (this.dateOfBirth) {
    this.isMinor = isMinorFromDateOfBirth(new Date(this.dateOfBirth));
  }
  next();
});

export const Player = mongoose.model<IPlayer>('Player', playerSchema);
