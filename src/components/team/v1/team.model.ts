import mongoose, { Schema } from 'mongoose';
import { ITeam } from './team.interface';

const teamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      maxlength: [100, 'Team name cannot exceed 100 characters']
    },
    season: {
      type: String,
      trim: true,
      maxlength: [50, 'Season cannot exceed 50 characters']
    },
    color: {
      type: String,
      trim: true,
      maxlength: [20, 'Color cannot exceed 20 characters']
    },
    sport: {
      type: String,
      trim: true,
      maxlength: [50, 'Sport cannot exceed 50 characters']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy is required'],
      index: true
    },
    settings: {
      allowPlayerInvites: {
        type: Boolean,
        default: false
      },
      requireGuardianApproval: {
        type: Boolean,
        default: true
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes
teamSchema.index({ createdBy: 1, createdAt: -1 });
teamSchema.index({ name: 1 });

export const Team = mongoose.model<ITeam>('Team', teamSchema);
