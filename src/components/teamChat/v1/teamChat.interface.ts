import { Document, Types } from 'mongoose';

export enum TeamMessageType {
  USER = 'user',
  SYSTEM = 'system'
}

export interface ITeamMessage extends Document {
  _id: string;
  teamId: Types.ObjectId;
  senderId?: Types.ObjectId | null;
  type: TeamMessageType;
  text: string;
  meta?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

