import { Request, Response } from 'express';
import httpStatus from 'http-status';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import * as teamChatService from './teamChat.service';
import { postSystemMessage as postSystemMessageService } from './systemMessage.service';
import { SystemEventKind } from './teamChat.interface';

/**
 * When adding PATCH or DELETE message endpoints: load the message and reject with
 * 403 "System messages cannot be modified" if message.type === 'system'.
 */
/**
 * POST /api/v1/teams/:teamId/chat/messages
 * Create a new user message in team chat
 */
export const postMessage = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { teamId } = req.params;
  const { text } = req.body;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  if (!teamId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
  }

  const message = await teamChatService.createUserMessage({
    teamId,
    senderId: String(userId),
    text
  });

  res.status(httpStatus.CREATED).json({
    success: true,
    data: message
  });
});

/**
 * GET /api/v1/teams/:teamId/chat/messages
 * Fetch paginated messages for a team
 */
export const getMessages = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { teamId } = req.params;
  const { limit, before, after } = req.query as {
    limit?: string;
    before?: string;
    after?: string;
  };

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  if (!teamId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
  }

  const parsedLimit = limit ? parseInt(limit, 10) : undefined;
  const beforeDate = before ? new Date(before) : undefined;
  const afterDate = after ? new Date(after) : undefined;

  const result = await teamChatService.getMessages({
    teamId,
    limit: parsedLimit,
    before: beforeDate,
    after: afterDate
  });

  res.status(httpStatus.OK).json({
    success: true,
    data: result
  });
});

/**
 * POST /api/v1/teams/:teamId/chat/system-messages
 * Stub: create a system message (admin only). For testing until Event/Payment/GameNote features exist.
 */
export const postSystemMessage = asyncWrapper(async (req: Request, res: Response) => {
  const { teamId } = req.params;
  const { eventKind, payload } = req.body as {
    eventKind: SystemEventKind;
    payload?: Record<string, unknown>;
  };

  if (!teamId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team ID is required');
  }

  const message = await postSystemMessageService(teamId, eventKind, payload);

  res.status(httpStatus.CREATED).json({
    success: true,
    data: message
  });
});

