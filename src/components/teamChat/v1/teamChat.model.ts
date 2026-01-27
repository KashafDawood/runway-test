import mongoose, { Schema } from 'mongoose';
import { ITeamMessage, TeamMessageType } from './teamChat.interface';

const teamMessageSchema = new Schema<ITeamMessage>(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team ID is required'],
      index: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(TeamMessageType),
      required: [true, 'Message type is required'],
      index: true,
      default: TeamMessageType.USER
    },
    text: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true
    },
    meta: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Core index for team chat queries
teamMessageSchema.index({ teamId: 1, createdAt: -1 });

export const TeamMessage = mongoose.model<ITeamMessage>('TeamMessage', teamMessageSchema);

