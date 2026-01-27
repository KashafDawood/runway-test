import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import {
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember
} from '@components/auth/v1/auth.middleware';
import * as teamChatController from './teamChat.controller';
import * as teamChatValidation from './teamChat.validation';

const router = Router();

/**
 * POST /api/v1/teams/:teamId/chat/messages
 * Authenticated team members can post chat messages
 */
router.post(
  '/:teamId/chat/messages',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  validate(teamChatValidation.createMessageSchema),
  teamChatController.postMessage
);

/**
 * GET /api/v1/teams/:teamId/chat/messages
 * Authenticated team members can fetch chat messages
 */
router.get(
  '/:teamId/chat/messages',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  validate(teamChatValidation.getMessagesSchema),
  teamChatController.getMessages
);

export default router;

