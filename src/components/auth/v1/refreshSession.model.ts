import mongoose, { Schema, Document } from 'mongoose';

export type RefreshPlatform = 'web' | 'ios' | 'android';

export interface IRefreshSession extends Document {
  _id: string;
  user: mongoose.Types.ObjectId;
  tokenHash: string;
  familyId: string;
  platform: RefreshPlatform;
  deviceLabel?: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedBy?: mongoose.Types.ObjectId;
  lastUsedAt: Date;
  created_at: Date;
}

const refreshSessionSchema = new Schema<IRefreshSession>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['web', 'ios', 'android'] as RefreshPlatform[],
      required: true,
    },
    deviceLabel: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RefreshSession',
      default: null,
    },
    lastUsedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: false,
    },
  },
);

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSessionSchema.index({ user: 1, revokedAt: 1 });

const RefreshSessionModel = mongoose.model<IRefreshSession>('RefreshSession', refreshSessionSchema);

export default RefreshSessionModel;
