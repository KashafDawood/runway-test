import { Document, Types } from 'mongoose';

export enum GuardianLinkStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REMOVED = 'removed'
}

export interface IGuardianLink extends Document {
  _id: string;
  guardianId: Types.ObjectId;
  playerId: Types.ObjectId;
  teamId: Types.ObjectId;
  status: GuardianLinkStatus;
  requestedBy: Types.ObjectId;
  requestedAt: Date;
  respondedBy?: Types.ObjectId;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
