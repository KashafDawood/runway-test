import mongoose, { Schema, Document } from 'mongoose';

export type TokenType = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'INVITATION';

export interface IToken extends Document {
  _id: string;
  user: mongoose.Types.ObjectId;
  token: string;
  type: TokenType;
  expires_at: Date;
  metadata?: any;
  created_at: Date;
}

const tokenSchema = new Schema<IToken>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET', 'INVITATION'] as TokenType[],
      required: true,
    },
    expires_at: {
      type: Date,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: false,
    },
  }
);

// TTL index - MongoDB will automatically delete expired tokens
tokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
tokenSchema.index({ token: 1, type: 1 });

const TokenModel = mongoose.model<IToken>('Token', tokenSchema);

export default TokenModel;
