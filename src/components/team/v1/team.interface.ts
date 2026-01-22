import { Document, Types } from 'mongoose';

export interface ITeam extends Document {
  _id: string;
  name: string;
  season?: string;
  color?: string;
  sport?: string;
  createdBy: Types.ObjectId;
  settings: {
    allowPlayerInvites: boolean;
    requireGuardianApproval: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
