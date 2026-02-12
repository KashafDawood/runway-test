import { Types } from 'mongoose';
import config from '@config/config';
import { Event } from '@components/event/v1/event.model';
import { Team } from '@components/team/v1/team.model';
import { UserRole } from '@components/userRole/v1/userRole.model';
import { UserRoleStatus } from '@components/userRole/v1/userRole.interface';
import NotificationLogModel from '@components/notification/v1/notificationLog.model';
import { notifyEventReminder } from '@components/notification/v1/notificationDelivery.service';
import { NotificationType } from '@components/notification/v1/notification.interface';
import logger from '@core/utils/logger';

/**
 * Find events whose start time is within the next N minutes (reminder window).
 * For each event, notify team members who have not yet received a reminder (idempotent).
 */
async function runEventReminderJob(): Promise<void> {
  const now = new Date();
  const minutesBefore = config.eventReminder?.minutesBefore ?? 60;
  const windowEnd = new Date(now.getTime() + minutesBefore * 60 * 1000);

  const events = await Event.find({
    start: { $gt: now, $lte: windowEnd },
  })
    .select('_id teamId title start')
    .lean();

  if (events.length === 0) {
    return;
  }

  for (const event of events) {
    try {
      const teamId = event.teamId.toString();
      const eventId = event._id.toString();
      const memberRoles = await UserRole.find({
        teamId: event.teamId,
        status: UserRoleStatus.ACTIVE,
      })
        .select('userId')
        .lean();
      const allUserIds = memberRoles.map((r) => r.userId.toString());

      const alreadySent = await NotificationLogModel.find(
        {
          type: NotificationType.EVENT_REMINDER,
          eventId: new Types.ObjectId(eventId),
          userId: { $in: allUserIds.map((id) => new Types.ObjectId(id)) },
        },
        { userId: 1 }
      )
        .lean();
      const sentUserIds = new Set(alreadySent.map((l) => l.userId.toString()));
      const userIdsToNotify = allUserIds.filter((id) => !sentUserIds.has(id));

      if (userIdsToNotify.length === 0) {
        continue;
      }

      const team = await Team.findById(teamId).select('name').lean();
      const teamName = team?.name ?? 'Your team';

      await notifyEventReminder({
        userIds: userIdsToNotify,
        eventId,
        teamId,
        title: event.title,
        eventStart: event.start,
        teamName,
      });
      logger.debug(`Event reminder sent for event ${eventId} to ${userIdsToNotify.length} user(s)`);
    } catch (err) {
      logger.error('Event reminder job failed for event', { eventId: event._id, err });
    }
  }
}

let scheduledTask: { stop: () => void } | null = null;

/**
 * Start the event reminder cron job. Call after DB is connected.
 * No-ops if node-cron is not installed (app still runs without reminder job).
 */
export function startEventReminderScheduler(): void {
  let cron: { schedule: (expr: string, fn: () => void) => { stop: () => void }; validate: (expr: string) => boolean };
  try {
    cron = require('node-cron');
  } catch {
    logger.warn('node-cron not installed; event reminder scheduler disabled. Run: yarn add node-cron');
    return;
  }
  const cronSchedule = config.eventReminder?.cronSchedule ?? '*/15 * * * *';
  const valid = cron.validate(cronSchedule);
  if (!valid) {
    logger.warn('Invalid EVENT_REMINDER_CRON; event reminder job disabled');
    return;
  }
  scheduledTask = cron.schedule(cronSchedule, () => {
    runEventReminderJob().catch((err) => {
      logger.error('Event reminder scheduler error', err);
    });
  });
  logger.info(`Event reminder scheduler started (cron: ${cronSchedule})`);
}

/**
 * Stop the event reminder cron job (e.g. on shutdown).
 */
export function stopEventReminderScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('Event reminder scheduler stopped');
  }
}
