import { Document, Types } from 'mongoose';

export interface IGameNote extends Document {
  _id: Types.ObjectId;
  teamId: Types.ObjectId;
  eventId: Types.ObjectId;
  /**
   * When null, this is a team-level note.
   * When set, this is a player-specific note.
   */
  playerId?: Types.ObjectId | null;
  text: string;
  /** Optional tags (e.g. "defense", "highlights") set at creation/update. */
  tags?: string[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

