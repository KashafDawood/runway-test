import mongoose, { Schema } from 'mongoose';
import { IAttendance, AttendanceStatus } from './attendance.interface';

const ATTENDANCE_STATUSES = ['present', 'absent'] as const;

const attendanceSchema = new Schema<IAttendance>(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: [true, 'Player ID is required'],
      index: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team ID is required'],
      index: true
    },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      required: [true, 'Status is required']
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'markedBy is required'],
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

attendanceSchema.index({ eventId: 1, playerId: 1 }, { unique: true });
attendanceSchema.index({ eventId: 1 });
attendanceSchema.index({ teamId: 1 });

export const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema);
