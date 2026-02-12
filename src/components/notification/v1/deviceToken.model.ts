import mongoose, { Schema } from 'mongoose';
import { IDeviceTokenDoc } from './notification.interface';

const deviceTokenSchema = new Schema<IDeviceTokenDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      default: 'web',
    },
    label: {
      type: String,
      trim: true,
      maxlength: 100,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

deviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

const DeviceTokenModel = mongoose.model<IDeviceTokenDoc>('DeviceToken', deviceTokenSchema);

export default DeviceTokenModel;
