import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import {
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  requireTeamAdmin
} from '@components/auth/v1/auth.middleware';
import * as teamChatController from './teamChat.controller';
import * as teamChatValidation from './teamChat.validation';

const router = Router();

/**
 * POST /api/v1/teams/:teamId/chat/messages
 * Authenticated team members can post chat messages
 */
router.post(
  '/:teamId/messages',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  validate(teamChatValidation.createMessageSchema),
  teamChatController.postMessage
);

/**
 * GET /api/v1/teams/:teamId/messages
 * Authenticated team members can fetch chat messages
 */
router.get(
  '/:teamId/messages',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  validate(teamChatValidation.getMessagesSchema),
  teamChatController.getMessages
);

/**
 * POST /api/v1/teams/:teamId/system-messages
 * Stub: create a system message (admin only). Body: { eventKind, payload? }
 * Future PATCH/DELETE message routes must reject messages where type === 'system'.
 */
router.post(
  '/:teamId/system-messages',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  validate(teamChatValidation.postSystemMessageSchema),
  teamChatController.postSystemMessage
);

export default router;

