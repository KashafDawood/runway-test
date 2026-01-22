import { Document, Types } from 'mongoose';

export interface IPlayer extends Document {
  _id: string;
  userId?: Types.ObjectId;
  teamId: Types.ObjectId;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  jerseyNumber?: string;
  position?: string;
  isMinor: boolean; // Computed from dateOfBirth
  hasEmail: boolean; // Whether player has own account
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
