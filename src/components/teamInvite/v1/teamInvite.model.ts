import mongoose, { Schema } from 'mongoose';
import { ITeamInvite, InviteStatus } from './teamInvite.interface';
import { RoleName } from '@components/role/v1/role.interface';

const teamInviteSchema = new Schema<ITeamInvite>(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team ID is required'],
      index: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Inviter is required'],
      index: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      index: true
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: Object.values(InviteStatus),
      default: InviteStatus.PENDING,
      index: true
    },
    token: {
      type: String,
      required: [true, 'Token is required'],
      unique: true,
      index: true
    },
    inviteCode: {
      type: String,
      required: [true, 'Invite code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 8,
      maxlength: 8,
      index: true
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acceptedRole: {
      type: String,
      enum: Object.values(RoleName)
    },
    acceptedAt: {
      type: Date
    },
    minorPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: undefined,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// CRITICAL INDEXES for performance
teamInviteSchema.index({ teamId: 1, status: 1 });
teamInviteSchema.index({ email: 1, status: 1 });
teamInviteSchema.index({ token: 1, status: 1 });
teamInviteSchema.index({ inviteCode: 1, status: 1 });
teamInviteSchema.index({ expiresAt: 1 }); // For cleanup jobs

// Compound unique index: One pending invite per email per team
teamInviteSchema.index(
  { teamId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: InviteStatus.PENDING }
  }
);

export const TeamInvite = mongoose.model<ITeamInvite>('TeamInvite', teamInviteSchema);