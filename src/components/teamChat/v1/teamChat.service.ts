import httpStatus from 'http-status';
import mongoose from 'mongoose';
import AppError from '@core/utils/appError';
import { TeamMessage, } from './teamChat.model';
import { ITeamMessage, TeamMessageType } from './teamChat.interface';
import { getTeamChatGateway } from './teamChat.gateway';
import UserModel from '@components/user/v1/user.model';

interface CreateUserMessageInput {
  teamId: string;
  senderId: string;
  text: string;
}

interface CreateSystemMessageInput {
  teamId: string;
  text: string;
  meta?: Record<string, any>;
}

export interface GetMessagesInput {
  teamId: string;
  limit?: number;
  before?: Date;
  after?: Date;
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const normalizeMessage = async (message: ITeamMessage) => {
  const json = message.toJSON() as any;

  // Populate sender information if senderId exists
  let sender = null;
  if (json.senderId) {
    try {
      const user = await UserModel.findById(json.senderId).select('name email');
      if (user) {
        sender = {
          _id: user._id.toString(),
          name: user.name,
          email: user.email
        };
      }
    } catch (error) {
      console.error('Error populating sender:', error);
    }
  }

  return {
    id: json._id,
    teamId: json.teamId,
    senderId: json.senderId ?? null,
    sender: sender,
    type: json.type,
    text: json.text,
    meta: json.meta ?? null,
    createdAt: json.createdAt
  };
};

export const createUserMessage = async (input: CreateUserMessageInput) => {
  const { teamId, senderId, text } = input;

  if (!text || !text.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Message text is required');
  }

  const created = await TeamMessage.create({
    teamId: toObjectId(teamId),
    senderId: toObjectId(senderId),
    type: TeamMessageType.USER,
    text: text.trim()
  });

  const normalized = await normalizeMessage(created);

  // Emit Socket.IO event for real-time updates
  // Only emit if gateway is initialized (handles cases where server might not be fully started)
  try {
    const gateway = getTeamChatGateway();
    if (gateway) {
      gateway.emitNewMessage(teamId, normalized);
    }
  } catch (error) {
    // Log but don't fail the request if Socket.IO emission fails
    console.error('Failed to emit Socket.IO event:', error);
  }

  return normalized;
};

export const createSystemMessage = async (input: CreateSystemMessageInput) => {
  const { teamId, text, meta } = input;

  const created = await TeamMessage.create({
    teamId: toObjectId(teamId),
    senderId: null,
    type: TeamMessageType.SYSTEM,
    text: text.trim(),
    meta: meta ?? undefined
  });

  const normalized = await normalizeMessage(created);

  // Emit Socket.IO event for real-time updates
  try {
    const gateway = getTeamChatGateway();
    if (gateway) {
      gateway.emitNewMessage(teamId, normalized);
    }
  } catch (error) {
    console.error('Failed to emit Socket.IO event:', error);
  }

  return normalized;
};

export const getMessages = async (input: GetMessagesInput) => {
  const { teamId, before, after } = input;
  let { limit } = input;

  if (!limit || limit <= 0) {
    limit = DEFAULT_PAGE_SIZE;
  }
  if (limit > MAX_PAGE_SIZE) {
    limit = MAX_PAGE_SIZE;
  }

  const query: any = {
    teamId: toObjectId(teamId)
  };

  if (before) {
    query.createdAt = { ...(query.createdAt || {}), $lt: before };
  }

  if (after) {
    query.createdAt = { ...(query.createdAt || {}), $gt: after };
  }

  // Default: latest messages first
  let sort: any = { createdAt: -1, _id: -1 };

  // When polling for new messages after a timestamp, return oldest first so
  // the client can append them in order.
  if (after && !before) {
    sort = { createdAt: 1, _id: 1 };
  }

  const docs = await TeamMessage.find(query).sort(sort).limit(limit);
  const messages = await Promise.all(docs.map(normalizeMessage));

  const hasMessages = messages.length > 0;

  const nextCursor = hasMessages ? messages[messages.length - 1].createdAt : null;
  const prevCursor = hasMessages ? messages[0].createdAt : null;

  return {
    messages,
    nextCursor,
    prevCursor
  };
};

