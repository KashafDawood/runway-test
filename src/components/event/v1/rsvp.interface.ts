import { Document, Types } from 'mongoose';

export type RsvpStatus = 'attending' | 'not_attending';

export interface IRsvp extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  playerId: Types.ObjectId;
  teamId: Types.ObjectId;
  status: RsvpStatus;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
