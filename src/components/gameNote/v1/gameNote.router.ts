import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import {
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  requireTeamAdmin
} from '@components/auth/v1/auth.middleware';
import * as gameNoteController from './gameNote.controller';
import * as gameNoteValidation from './gameNote.validation';

const router = Router();

/**
 * POST /api/v1/teams-event/:teamId/events/:eventId/notes/team
 * Create or update team-level game note (coach/assistant only).
 */
router.post(
  '/:teamId/events/:eventId/notes/team',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  validate(gameNoteValidation.upsertTeamNoteSchema),
  gameNoteController.upsertTeamNote
);

/**
 * POST /api/v1/teams-event/:teamId/events/:eventId/notes/player
 * Create or update player-specific game note (coach/assistant only).
 */
router.post(
  '/:teamId/events/:eventId/notes/player',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  validate(gameNoteValidation.upsertPlayerNoteSchema),
  gameNoteController.upsertPlayerNote
);

/**
 * GET /api/v1/teams-event/:teamId/events/:eventId/notes
 * Get game notes for an event visible to the current user.
 */
router.get(
  '/:teamId/events/:eventId/notes',
  verifyToken,
  extractTeamContext,
  requireTeamMember,
  gameNoteController.getEventNotes
);

export default router;

