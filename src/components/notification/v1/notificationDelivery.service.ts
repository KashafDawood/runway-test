import { Types } from 'mongoose';
import config from '@config/config';
import UserModel from '@components/user/v1/user.model';
import { UserRole } from '@components/userRole/v1/userRole.model';
import { UserRoleStatus } from '@components/userRole/v1/userRole.interface';
import * as notificationService from './notification.service';
import { sendEmail } from '@shared/services/mail';
import NotificationLogModel from './notificationLog.model';
import {
  NotificationType,
  NotificationChannel,
  type INotificationPayload,
} from './notification.interface';
import logger from '@core/utils/logger';

const frontEndUrl = config.app.frontEndUrl || 'http://localhost:3000';

/**
 * Get active team member user IDs (for event created / game notes).
 */
export async function getActiveTeamMemberUserIds(teamId: string): Promise<string[]> {
  const roles = await UserRole.find({
    teamId: new Types.ObjectId(teamId),
    status: UserRoleStatus.ACTIVE,
  })
    .select('userId')
    .lean();
  return roles.map((r) => r.userId.toString());
}

/**
 * Deliver to a single user: check preferences, try push, then email fallback, log.
 */
async function deliverToUser(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, string>;
  eventId?: string;
  teamId?: string;
  emailTemplate?: string;
  emailLocals?: Record<string, unknown>;
}): Promise<void> {
  const { userId, type, title, body, data, eventId, teamId, emailTemplate, emailLocals } = params;
  const user = await UserModel.findById(userId).select('email notificationsEnabled').lean();
  if (!user) return;
  if (user.notificationsEnabled === false) {
    logger.debug(`User ${userId} has notifications disabled; skipping delivery`);
    return;
  }

  const payload: INotificationPayload = { title, body, data };
  const pushResult = await notificationService.sendToUser(userId, payload);
  const hadPushSuccess = pushResult.success > 0;

  if (hadPushSuccess) {
    await NotificationLogModel.create({
      userId: new Types.ObjectId(userId),
      type,
      title,
      body,
      data,
      channel: 'push' as NotificationChannel,
      sentAt: new Date(),
      eventId: eventId ? new Types.ObjectId(eventId) : undefined,
      teamId: teamId ? new Types.ObjectId(teamId) : undefined,
    });
  }

  // Email fallback: send when no push tokens or when we explicitly want email (e.g. reminder)
  const sendEmailFallback = !hadPushSuccess && emailTemplate && user.email;
  if (sendEmailFallback && emailLocals) {
    try {
      await sendEmail(emailTemplate, user.email, { ...emailLocals, subject: title });
      await NotificationLogModel.create({
        userId: new Types.ObjectId(userId),
        type,
        title,
        body,
        data,
        channel: 'email' as NotificationChannel,
        sentAt: new Date(),
        eventId: eventId ? new Types.ObjectId(eventId) : undefined,
        teamId: teamId ? new Types.ObjectId(teamId) : undefined,
      });
    } catch (err) {
      logger.error('Notification email fallback failed', { userId, type, err });
    }
  }
}

/**
 * Notify team members when an event is created. Excludes creator.
 */
export async function notifyEventCreated(params: {
  teamId: string;
  eventId: string;
  title: string;
  eventStart: Date;
  teamName: string;
  excludeUserId?: string;
}): Promise<void> {
  const { teamId, eventId, title, eventStart, teamName, excludeUserId } = params;
  const userIds = await getActiveTeamMemberUserIds(teamId);
  const recipients = excludeUserId ? userIds.filter((id) => id !== excludeUserId) : userIds;
  const eventUrl = `${frontEndUrl}/teams/${teamId}/events/${eventId}`;
  const eventStartFormatted = new Date(eventStart).toLocaleString();

  for (const uid of recipients) {
    try {
      await deliverToUser({
        userId: uid,
        type: NotificationType.EVENT_CREATED,
        title: `New event: ${title}`,
        body: `${title} on ${eventStartFormatted}`,
        data: { type: 'event_created', eventId, teamId },
        eventId,
        teamId,
        emailTemplate: 'eventCreated',
        emailLocals: {
          eventTitle: title,
          eventStart: eventStartFormatted,
          teamName,
          eventUrl,
        },
      });
    } catch (err) {
      logger.error('notifyEventCreated delivery failed', { userId: uid, err });
    }
  }
}

/**
 * Notify users of an event reminder (called by scheduler).
 */
export async function notifyEventReminder(params: {
  userIds: string[];
  eventId: string;
  teamId: string;
  title: string;
  eventStart: Date;
  teamName: string;
}): Promise<void> {
  const { userIds, eventId, teamId, title, eventStart, teamName } = params;
  const eventUrl = `${frontEndUrl}/teams/${teamId}/events/${eventId}`;
  const eventStartFormatted = new Date(eventStart).toLocaleString();

  for (const uid of userIds) {
    try {
      await deliverToUser({
        userId: uid,
        type: NotificationType.EVENT_REMINDER,
        title: `Reminder: ${title}`,
        body: `Upcoming at ${eventStartFormatted}`,
        data: { type: 'event_reminder', eventId, teamId },
        eventId,
        teamId,
        emailTemplate: 'eventReminder',
        emailLocals: {
          eventTitle: title,
          eventStart: eventStartFormatted,
          teamName,
          eventUrl,
        },
      });
    } catch (err) {
      logger.error('notifyEventReminder delivery failed', { userId: uid, err });
    }
  }
}

/**
 * Notify team members when game notes are published. Excludes author.
 */
export async function notifyGameNotesPublished(params: {
  teamId: string;
  eventId: string;
  authorUserId: string;
  authorName: string;
  teamName: string;
  eventTitle: string;
}): Promise<void> {
  const { teamId, eventId, authorUserId, authorName, teamName, eventTitle } = params;
  const userIds = await getActiveTeamMemberUserIds(teamId);
  const recipients = userIds.filter((id) => id !== authorUserId);
  const notesUrl = `${frontEndUrl}/teams/${teamId}/events/${eventId}/notes`;

  for (const uid of recipients) {
    try {
      await deliverToUser({
        userId: uid,
        type: NotificationType.GAME_NOTES_PUBLISHED,
        title: `Game notes: ${eventTitle}`,
        body: `${authorName} published notes for ${eventTitle}`,
        data: { type: 'game_notes_published', eventId, teamId },
        eventId,
        teamId,
        emailTemplate: 'gameNotesPublished',
        emailLocals: {
          authorName,
          teamName,
          eventTitle,
          notesUrl,
        },
      });
    } catch (err) {
      logger.error('notifyGameNotesPublished delivery failed', { userId: uid, err });
    }
  }
}
