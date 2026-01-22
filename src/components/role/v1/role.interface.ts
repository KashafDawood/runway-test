import { Document } from 'mongoose';

export enum RoleName {
  COACH = 'coach',
  ASSISTANT_COACH = 'assistant_coach',
  PLAYER = 'player',
  GUARDIAN = 'guardian',
  MEDIA = 'media'
}

export interface IRole extends Document {
  _id: string;
  name: RoleName;
  displayName: string;
  isAdmin: boolean;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
