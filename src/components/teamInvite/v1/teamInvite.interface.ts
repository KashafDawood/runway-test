import { Document, Types } from 'mongoose';
import { RoleName } from '@components/role/v1/role.interface';

export enum InviteStatus {
  PENDING = 'pending',
  PENDING_APPROVAL = 'pending_approval',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface ITeamInvite extends Document {
  _id: string;
  teamId: Types.ObjectId;
  invitedBy: Types.ObjectId; // Coach who sent invite
  acceptedBy?: Types.ObjectId; // User who accepted (if any)
  email: string; // Email of invitee
  status: InviteStatus;
  token: string; // Unique secure token
  expiresAt: Date; // When invite expires
  acceptedRole?: RoleName; // Role chosen by user when accepting
  acceptedAt?: Date; // When accepted
  /** When inviting a guardian to link to an existing minor player after they join */
  minorPlayerId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}