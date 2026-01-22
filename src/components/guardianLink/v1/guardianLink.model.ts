import mongoose, { Schema } from 'mongoose';
import { IGuardianLink, GuardianLinkStatus } from './guardianLink.interface';

const guardianLinkSchema = new Schema<IGuardianLink>(
  {
    guardianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'guardianId is required'],
      index: true
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: [true, 'playerId is required'],
      index: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'teamId is required'],
      index: true
    },
    status: {
      type: String,
      required: [true, 'status is required'],
      enum: Object.values(GuardianLinkStatus),
      default: GuardianLinkStatus.PENDING,
      index: true
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'requestedBy is required']
    },
    requestedAt: {
      type: Date,
      required: [true, 'requestedAt is required'],
      default: Date.now
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes - for querying guardian links
guardianLinkSchema.index({ guardianId: 1, teamId: 1, status: 1 });
guardianLinkSchema.index({ playerId: 1, teamId: 1, status: 1 });

// Unique constraint: One guardian-player link per team
guardianLinkSchema.index(
  { guardianId: 1, playerId: 1, teamId: 1 },
  { unique: true }
);

export const GuardianLink = mongoose.model<IGuardianLink>(
  'GuardianLink',
  guardianLinkSchema
);
