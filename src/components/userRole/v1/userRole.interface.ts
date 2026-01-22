import { Document, Types } from 'mongoose';
import { RoleName } from '../../role/v1/role.interface';

export enum UserRoleStatus {
  ACTIVE = 'active',
  INVITED = 'invited',
  REMOVED = 'removed'
}

export interface IUserRole extends Document {
  _id: string;
  userId: Types.ObjectId;
  teamId: Types.ObjectId;
  roleId: Types.ObjectId;
  roleName: RoleName; // Denormalized for performance
  status: UserRoleStatus;
  invitedBy?: Types.ObjectId;
  invitedAt?: Date;
  joinedAt?: Date;
  removedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
