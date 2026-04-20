import mongoose, { Schema } from 'mongoose';
import { IUser } from './user.interface';

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
        },
        message: (props: { value: string }) => `${props.value} is not a valid email address!`,
      },
    },
    password: {
      type: String,
      select: false,
      minlength: 6,
    },
    email_verified: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
    },
    authServiceId: {
      type: String,
      default: null,
      index: true,
    },
    activeTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
    dateOfBirth: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ authServiceId: 1 });

const UserModel = mongoose.model<IUser>('User', userSchema);

export default UserModel;
