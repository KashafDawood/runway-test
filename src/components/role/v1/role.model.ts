import mongoose, { Schema } from 'mongoose';
import { IRole, RoleName } from './role.interface';

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: Object.values(RoleName),
      index: true
    },
    displayName: {
      type: String,
      required: true
    },
    isAdmin: {
      type: Boolean,
      required: true,
      default: false
    },
    description: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes
roleSchema.index({ name: 1 }, { unique: true });

export const Role = mongoose.model<IRole>('Role', roleSchema);
