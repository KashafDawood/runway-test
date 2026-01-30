import { Document, Types } from 'mongoose';

export type AttendanceStatus = 'present' | 'absent';

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  playerId: Types.ObjectId;
  teamId: Types.ObjectId;
  status: AttendanceStatus;
  markedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
