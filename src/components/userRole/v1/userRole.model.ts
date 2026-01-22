import mongoose, { Schema } from 'mongoose';
import { IUserRole, UserRoleStatus } from './userRole.interface';
import { RoleName } from '../../role/v1/role.interface';

const userRoleSchema = new Schema<IUserRole>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'teamId is required'],
      index: true
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: [true, 'roleId is required'],
      index: true
    },
    roleName: {
      type: String,
      required: [true, 'roleName is required'],
      enum: Object.values(RoleName),
      index: true
    },
    status: {
      type: String,
      required: [true, 'status is required'],
      enum: Object.values(UserRoleStatus),
      default: UserRoleStatus.ACTIVE,
      index: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    invitedAt: {
      type: Date
    },
    joinedAt: {
      type: Date
    },
    removedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes - CRITICAL for performance
userRoleSchema.index({ userId: 1, teamId: 1 });
userRoleSchema.index({ teamId: 1, status: 1 });
userRoleSchema.index({ userId: 1, status: 1 });
userRoleSchema.index({ teamId: 1, roleName: 1, status: 1 });

// Unique constraint: One user can have ONE active role per team
userRoleSchema.index(
  { userId: 1, teamId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: UserRoleStatus.ACTIVE }
  }
);

export const UserRole = mongoose.model<IUserRole>('UserRole', userRoleSchema);
