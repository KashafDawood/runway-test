import { Document, Types } from 'mongoose';

export enum EventType {
  PRACTICE = 'practice',
  GAME = 'game',
  CUSTOM = 'custom'
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: Date;
  count?: number;
}

export interface IEvent extends Document {
  _id: Types.ObjectId;
  teamId: Types.ObjectId;
  type: EventType;
  title: string;
  description?: string;
  start: Date;
  end?: Date | null;
  location?: string;
  createdBy: Types.ObjectId;
  recurrence?: RecurrenceRule;
  createdAt: Date;
  updatedAt: Date;
}
