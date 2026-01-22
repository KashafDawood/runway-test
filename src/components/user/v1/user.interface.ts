import { Document } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password: string;
  email_verified: boolean;
  avatar?: string;
  phone?: string;
  
  // For external auth service migration
  authServiceId?: string;
  
  created_at: Date;
  updated_at: Date;
}
