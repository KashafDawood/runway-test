import { Router } from 'express';
import validate from '@core/middlewares/validate.middleware';
import {
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamMember,
  requireTeamAdmin
} from '@components/auth/v1/auth.middleware';
import * as eventController from './event.controller';
import * as eventValidation from './event.validation';
import * as rsvpValidation from './rsvp.validation';

const router = Router();

/**
 * GET /api/v1/teams-event/events?teamIds=id1,id2&start=ISO&end=ISO&page=1&limit=20
 * Broad view: list events for one or more teams (teamIds filter). If teamIds omitted, all teams user is in. start/end optional; paginated.
 */
router.get(
  '/events',
  verifyToken,
  validate(eventValidation.getEventsBroadSchema),
  eventController.getEventsBroadView
);

/**
 * GET /api/v1/teams-event/:teamId/events?start=ISO&end=ISO&page=1&limit=20
 * List events for team (team member). start/end optional; if omitted returns all events. Paginated.
 */
router.get(
  '/:teamId/events',
  verifyToken,
  extractTeamContext,
  requireTeamMember,
  validate(eventValidation.getEventsByDateRangeSchema),
  eventController.getEventsByDateRange
);

/**
 * POST /api/v1/teams-event/:teamId/events
 * Create event (admin only). Posts system message to team chat on success.
 */
router.post(
  '/:teamId/events',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  validate(eventValidation.createEventSchema),
  eventController.createEvent
);

/**
 * GET /api/v1/teams-event/:teamId/events/:eventId
 * Get one event by ID (team member).
 */
router.get(
  '/:teamId/events/:eventId',
  verifyToken,
  extractTeamContext,
  requireTeamMember,
  eventController.getEvent
);

/**
 * PUT /api/v1/teams-event/:teamId/events/:eventId
 * Update event (admin only).
 */
router.put(
  '/:teamId/events/:eventId',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  validate(eventValidation.updateEventSchema),
  eventController.updateEvent
);

/**
 * DELETE /api/v1/teams-event/:teamId/events/:eventId
 * Delete event (admin only).
 */
router.delete(
  '/:teamId/events/:eventId',
  verifyToken,
  requireEmailVerified,
  extractTeamContext,
  requireTeamAdmin,
  eventController.deleteEvent
);

/**
 * GET /api/v1/teams-event/:teamId/events/:eventId/rsvp/summary
 * RSVP aggregation for event (coach/assistant only).
 */
router.get(
  '/:teamId/events/:eventId/rsvp/summary',
  verifyToken,
  extractTeamContext,
  requireTeamAdmin,
  eventController.getRsvpSummary
);

/**
 * GET /api/v1/teams-event/:teamId/events/:eventId/rsvp?playerId=...
 * Get RSVP for event. Player: own. Guardian: playerId required. Coach: playerId required.
 */
router.get(
  '/:teamId/events/:eventId/rsvp',
  verifyToken,
  extractTeamContext,
  requireTeamMember,
  validate(rsvpValidation.getRsvpQuerySchema),
  eventController.getRsvp
);

/**
 * PUT /api/v1/teams-event/:teamId/events/:eventId/rsvp
 * Create or update RSVP (player or guardian only). Last action wins.
 */
router.put(
  '/:teamId/events/:eventId/rsvp',
  verifyToken,
  extractTeamContext,
  requireTeamMember,
  validate(rsvpValidation.putRsvpSchema),
  eventController.putRsvp
);

export default router;
