import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password: string;
  email_verified: boolean;
  avatar?: string;
  phone?: string;
  
  // active team id
  activeTeamId?: Types.ObjectId | null | undefined;
  
  // For external auth service migration
  authServiceId?: string;

  // Notification preferences (Phase 1: global on/off)
  notificationsEnabled?: boolean;

  /** Account-level DOB; synced to Player roster rows for age/minor logic */
  dateOfBirth?: Date;

  created_at: Date;
  updated_at: Date;
}
