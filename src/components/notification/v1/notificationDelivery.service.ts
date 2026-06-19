import { Types } from 'mongoose';
import UserModel from '@components/user/v1/user.model';
import { UserRole } from '@components/userRole/v1/userRole.model';
import { UserRoleStatus } from '@components/userRole/v1/userRole.interface';
import { RoleName } from '@components/role/v1/role.interface';
import { GuardianLink } from '@components/guardianLink/v1/guardianLink.model';
import { GuardianLinkStatus } from '@components/guardianLink/v1/guardianLink.interface';
import { Player } from '@components/player/v1/player.model';
import * as notificationService from './notification.service';
import { sendEmail } from '@shared/services/mail';
import NotificationLogModel from './notificationLog.model';
import { NotificationType, type INotificationPayload } from './notification.interface';
import { notificationUrl } from './notificationUrl';
import logger from '@core/utils/logger';

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
 * Active coach and assistant coach user IDs for a team.
 */
export async function getActiveTeamManagerUserIds(teamId: string): Promise<string[]> {
  const roles = await UserRole.find({
    teamId: new Types.ObjectId(teamId),
    status: UserRoleStatus.ACTIVE,
    roleName: { $in: [RoleName.COACH, RoleName.ASSISTANT_COACH] },
  })
    .select('userId')
    .lean();
  return roles.map((r) => r.userId.toString());
}

/**
 * Active team members eligible for chat notifications.
 * Excludes unlinked guardians and minor players without an approved guardian link.
 */
export async function getChatNotificationRecipientUserIds(teamId: string): Promise<string[]> {
  const teamObjectId = new Types.ObjectId(teamId);

  const [roles, approvedLinks, minorPlayers] = await Promise.all([
    UserRole.find({
      teamId: teamObjectId,
      status: UserRoleStatus.ACTIVE,
    })
      .select('userId roleName')
      .lean(),
    GuardianLink.find({
      teamId: teamObjectId,
      status: GuardianLinkStatus.APPROVED,
    })
      .select('guardianId playerId')
      .lean(),
    Player.find({
      teamId: teamObjectId,
      isMinor: true,
    })
      .select('userId')
      .lean(),
  ]);

  const approvedGuardianUserIds = new Set(
    approvedLinks.map((link) => link.guardianId.toString())
  );
  const approvedMinorPlayerIds = new Set(
    approvedLinks.map((link) => link.playerId.toString())
  );
  const minorPlayerIdByUserId = new Map(
    minorPlayers.map((player) => [player.userId.toString(), player._id.toString()])
  );

  return roles
    .filter((role) => {
      const userId = role.userId.toString();

      if (role.roleName === RoleName.GUARDIAN) {
        return approvedGuardianUserIds.has(userId);
      }

      if (role.roleName === RoleName.PLAYER) {
        const minorPlayerId = minorPlayerIdByUserId.get(userId);
        if (!minorPlayerId) {
          return true;
        }
        return approvedMinorPlayerIds.has(minorPlayerId);
      }

      return true;
    })
    .map((role) => role.userId.toString());
}

/**
 * Deliver to a single user: always attempts push AND email, writes one inbox row.
 */
async function deliverToUser(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, string>;
  url: string;
  eventId?: string;
  teamId?: string;
  inviteId?: string;
  guardianLinkId?: string;
  emailTemplate?: string;
  emailLocals?: Record<string, unknown>;
}): Promise<void> {
  const {
    userId,
    type,
    title,
    body,
    data,
    url,
    eventId,
    teamId,
    inviteId,
    guardianLinkId,
    emailTemplate,
    emailLocals,
  } = params;

  const user = await UserModel.findById(userId).select('email notificationsEnabled').lean();
  if (!user) return;
  if (user.notificationsEnabled === false) {
    logger.debug(`User ${userId} has notifications disabled; skipping delivery`);
    return;
  }

  const payload: INotificationPayload = { title, body, data, clickUrl: url };

  // Persist inbox row before push so API/FCM clients never see a missing notification.
  let logId: Types.ObjectId | null = null;
  try {
    const created = await NotificationLogModel.create({
      userId: new Types.ObjectId(userId),
      type,
      title,
      body,
      data,
      url,
      channels: {
        push: { attempted: true, success: false },
        email: { attempted: !!emailTemplate, success: false },
      },
      sentAt: new Date(),
      readAt: null,
      eventId: eventId ? new Types.ObjectId(eventId) : undefined,
      teamId: teamId ? new Types.ObjectId(teamId) : undefined,
      inviteId: inviteId ? new Types.ObjectId(inviteId) : undefined,
      guardianLinkId: guardianLinkId ? new Types.ObjectId(guardianLinkId) : undefined,
    });
    logId = created._id as Types.ObjectId;
  } catch (err) {
    logger.error('Failed to write notification log', { userId, type, err });
    return;
  }

  const pushResult = await notificationService.sendToUser(userId, payload);
  const pushSuccess = pushResult.success > 0;

  let emailSuccess = false;
  if (emailTemplate && user.email && emailLocals) {
    try {
      await sendEmail(emailTemplate, user.email, { ...emailLocals, subject: title });
      emailSuccess = true;
    } catch (err) {
      logger.error('Notification email send failed', { userId, type, err });
    }
  }

  try {
    await NotificationLogModel.updateOne(
      { _id: logId },
      {
        $set: {
          'channels.push.success': pushSuccess,
          'channels.email.success': emailSuccess,
        },
      }
    );
  } catch (err) {
    logger.error('Failed to update notification log channels', { userId, type, err });
  }
}

// ---------------------------------------------------------------------------
// Existing helpers (updated to use notificationUrl + both_always policy)
// ---------------------------------------------------------------------------

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
  const eventDetailUrl = notificationUrl.event.detail(eventId);
  const eventStartFormatted = new Date(eventStart).toLocaleString();

  for (const uid of recipients) {
    try {
      await deliverToUser({
        userId: uid,
        type: NotificationType.EVENT_CREATED,
        title: `New event: ${title}`,
        body: `${title} on ${eventStartFormatted}`,
        data: { type: 'event_created', eventId, teamId },
        url: eventDetailUrl,
        eventId,
        teamId,
        emailTemplate: 'eventCreated',
        emailLocals: {
          eventTitle: title,
          eventStart: eventStartFormatted,
          teamName,
          eventUrl: eventDetailUrl,
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
  const eventDetailUrl = notificationUrl.event.detail(eventId);
  const eventStartFormatted = new Date(eventStart).toLocaleString();

  for (const uid of userIds) {
    try {
      await deliverToUser({
        userId: uid,
        type: NotificationType.EVENT_REMINDER,
        title: `Reminder: ${title}`,
        body: `Upcoming at ${eventStartFormatted}`,
        data: { type: 'event_reminder', eventId, teamId },
        url: eventDetailUrl,
        eventId,
        teamId,
        emailTemplate: 'eventReminder',
        emailLocals: {
          eventTitle: title,
          eventStart: eventStartFormatted,
          teamName,
          eventUrl: eventDetailUrl,
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
  const eventDetailUrl = notificationUrl.event.detail(eventId);

  for (const uid of recipients) {
    try {
      await deliverToUser({
        userId: uid,
        type: NotificationType.GAME_NOTES_PUBLISHED,
        title: `Game notes: ${eventTitle}`,
        body: `${authorName} published notes for ${eventTitle}`,
        data: { type: 'game_notes_published', eventId, teamId },
        url: eventDetailUrl,
        eventId,
        teamId,
        emailTemplate: 'gameNotesPublished',
        emailLocals: {
          authorName,
          teamName,
          eventTitle,
          notesUrl: eventDetailUrl,
        },
      });
    } catch (err) {
      logger.error('notifyGameNotesPublished delivery failed', { userId: uid, err });
    }
  }
}

// ---------------------------------------------------------------------------
// New helpers
// ---------------------------------------------------------------------------

/**
 * Notify an existing user when they are invited to a team.
 * Non-user invitees (email-only) get the email through the invite flow itself.
 */
export async function notifyInviteReceived(params: {
  invitedUserId: string;
  teamId: string;
  teamName: string;
  inviteId: string;
  inviteToken: string;
}): Promise<void> {
  const { invitedUserId, teamId, teamName, inviteId, inviteToken } = params;
  try {
    await deliverToUser({
      userId: invitedUserId,
      type: NotificationType.INVITE_RECEIVED,
      title: `You've been invited to ${teamName}`,
      body: `Tap to accept your invitation to join ${teamName}.`,
      data: { type: 'invite_received', teamId, inviteId },
      url: notificationUrl.invite.accept(inviteToken),
      teamId,
      inviteId,
    });
  } catch (err) {
    logger.error('notifyInviteReceived delivery failed', { userId: invitedUserId, err });
  }
}

/**
 * Notify a user that their join request was approved or rejected.
 */
export async function notifyInviteApprovedOrRejected(params: {
  requesterUserId: string;
  teamId: string;
  teamName: string;
  inviteId: string;
  approved: boolean;
}): Promise<void> {
  const { requesterUserId, teamId, teamName, inviteId, approved } = params;
  const type = approved ? NotificationType.INVITE_APPROVED : NotificationType.INVITE_REJECTED;
  const title = approved
    ? `Welcome to ${teamName}!`
    : `Your request to join ${teamName} was not approved`;
  const body = approved
    ? `Your request to join ${teamName} has been approved. You can now access the team.`
    : `Your request to join ${teamName} was declined by the coach.`;
  const url = approved ? notificationUrl.team.manage(teamId) : notificationUrl.home();

  try {
    await deliverToUser({
      userId: requesterUserId,
      type,
      title,
      body,
      data: { type: type, teamId, inviteId },
      url,
      teamId,
      inviteId,
    });
  } catch (err) {
    logger.error('notifyInviteApprovedOrRejected delivery failed', { userId: requesterUserId, err });
  }
}

/**
 * Notify team members when an event is updated. Excludes the person who made the change.
 */
export async function notifyEventUpdated(params: {
  teamId: string;
  eventId: string;
  title: string;
  teamName: string;
  excludeUserId?: string;
}): Promise<void> {
  const { teamId, eventId, title, excludeUserId } = params;
  const userIds = await getActiveTeamMemberUserIds(teamId);
  const recipients = excludeUserId ? userIds.filter((id) => id !== excludeUserId) : userIds;
  const eventDetailUrl = notificationUrl.event.detail(eventId);

  for (const uid of recipients) {
    try {
      await deliverToUser({
        userId: uid,
        type: NotificationType.EVENT_UPDATED,
        title: `Event updated: ${title}`,
        body: `Details for "${title}" have been changed.`,
        data: { type: 'event_updated', eventId, teamId },
        url: eventDetailUrl,
        eventId,
        teamId,
      });
    } catch (err) {
      logger.error('notifyEventUpdated delivery failed', { userId: uid, err });
    }
  }
}

/**
 * Notify team members when an event is deleted. Excludes the person who deleted it.
 */
export async function notifyEventDeleted(params: {
  teamId: string;
  eventTitle: string;
  teamName: string;
  excludeUserId?: string;
}): Promise<void> {
  const { teamId, eventTitle, teamName, excludeUserId } = params;
  const userIds = await getActiveTeamMemberUserIds(teamId);
  const recipients = excludeUserId ? userIds.filter((id) => id !== excludeUserId) : userIds;

  for (const uid of recipients) {
    try {
      await deliverToUser({
        userId: uid,
        type: NotificationType.EVENT_DELETED,
        title: `Event cancelled: ${eventTitle}`,
        body: `The event "${eventTitle}" has been removed from ${teamName}.`,
        data: { type: 'event_deleted', teamId },
        url: notificationUrl.event.calendar(),
        teamId,
      });
    } catch (err) {
      logger.error('notifyEventDeleted delivery failed', { userId: uid, err });
    }
  }
}

/**
 * Notify a user when their role in a team is changed.
 */
export async function notifyRoleChanged(params: {
  userId: string;
  teamId: string;
  teamName: string;
  newRole: string;
}): Promise<void> {
  const { userId, teamId, teamName, newRole } = params;
  try {
    await deliverToUser({
      userId,
      type: NotificationType.ROLE_CHANGED,
      title: `Your role in ${teamName} has been updated`,
      body: `You have been assigned the role of ${newRole} in ${teamName}.`,
      data: { type: 'role_changed', teamId, newRole },
      url: notificationUrl.team.manage(teamId),
      teamId,
    });
  } catch (err) {
    logger.error('notifyRoleChanged delivery failed', { userId, err });
  }
}

/**
 * Notify the other party about a guardian-link request, approval, or rejection.
 */
export async function notifyGuardianLink(params: {
  recipientUserId: string;
  teamId: string;
  linkId: string;
  status: 'requested' | 'approved' | 'rejected';
}): Promise<void> {
  const { recipientUserId, teamId, linkId, status } = params;

  const typeMap: Record<string, NotificationType> = {
    requested: NotificationType.GUARDIAN_LINK_REQUEST,
    approved: NotificationType.GUARDIAN_LINK_APPROVED,
    rejected: NotificationType.GUARDIAN_LINK_REJECTED,
  };
  const titleMap: Record<string, string> = {
    requested: 'Guardian link request received',
    approved: 'Guardian link approved',
    rejected: 'Guardian link request declined',
  };
  const bodyMap: Record<string, string> = {
    requested: 'A guardian-player link request is waiting for your approval.',
    approved: 'Your guardian-player link has been approved.',
    rejected: 'Your guardian-player link request was declined.',
  };

  try {
    await deliverToUser({
      userId: recipientUserId,
      type: typeMap[status],
      title: titleMap[status],
      body: bodyMap[status],
      data: { type: typeMap[status], teamId, linkId },
      url: notificationUrl.team.manage(teamId),
      teamId,
      guardianLinkId: linkId,
    });
  } catch (err) {
    logger.error('notifyGuardianLink delivery failed', { userId: recipientUserId, status, err });
  }
}

/**
 * Notify coaches and assistant coaches when a user accepts an invite and approval is needed.
 */
export async function notifyJoinRequestPending(params: {
  teamId: string;
  teamName: string;
  inviteId: string;
  memberName: string;
  memberRole: string;
  excludeUserId?: string;
}): Promise<void> {
  const { teamId, teamName, inviteId, memberName, memberRole, excludeUserId } = params;
  const managerIds = await getActiveTeamManagerUserIds(teamId);
  const recipients = excludeUserId
    ? managerIds.filter((id) => id !== excludeUserId)
    : managerIds;
  const manageUrl = notificationUrl.team.manage(teamId);

  for (const uid of recipients) {
    try {
      await deliverToUser({
        userId: uid,
        type: NotificationType.JOIN_REQUEST_PENDING,
        title: `Join request: ${memberName}`,
        body: `${memberName} accepted your invite as ${memberRole} and is waiting for your approval.`,
        data: { type: 'join_request_pending', teamId, inviteId },
        url: manageUrl,
        teamId,
        inviteId,
      });
    } catch (err) {
      logger.error('notifyJoinRequestPending delivery failed', { userId: uid, err });
    }
  }
}

/**
 * Notify coaches and assistant coaches when an approved minor player still needs a guardian link.
 */
export async function notifyMinorNeedsGuardianLink(params: {
  teamId: string;
  teamName: string;
  playerName: string;
  playerUserId: string;
}): Promise<void> {
  const { teamId, teamName, playerName, playerUserId } = params;
  const managerIds = await getActiveTeamManagerUserIds(teamId);
  const manageUrl = notificationUrl.team.manage(teamId);

  for (const uid of managerIds) {
    try {
      await deliverToUser({
        userId: uid,
        type: NotificationType.MINOR_NEEDS_GUARDIAN_LINK,
        title: `Guardian link needed: ${playerName}`,
        body: `${playerName} is a minor on ${teamName} and needs a guardian linked.`,
        data: { type: 'minor_needs_guardian_link', teamId, playerUserId },
        url: manageUrl,
        teamId,
      });
    } catch (err) {
      logger.error('notifyMinorNeedsGuardianLink delivery failed', { userId: uid, err });
    }
  }
}

/**
 * Notify team members (except sender) when a new chat message is posted.
 * Does NOT send notifications for system messages.
 */
export async function notifyChatMessage(params: {
  teamId: string;
  messageId: string;
  senderName: string;
  messageText: string;
  senderUserId: string;
}): Promise<void> {
  const { teamId, messageId, senderName, messageText, senderUserId } = params;
  const userIds = await getChatNotificationRecipientUserIds(teamId);
  const recipients = userIds.filter((id) => id !== senderUserId);

  if (recipients.length === 0) {
    return;
  }

  const chatDetailUrl = notificationUrl.chat.team(teamId);
  // Truncate message text if too long for notification
  const truncatedText = messageText.length > 100 ? messageText.substring(0, 97) + '...' : messageText;

  for (const uid of recipients) {
    try {
      await deliverToUser({
        userId: uid,
        type: NotificationType.CHAT_MESSAGE,
        title: `New message from ${senderName}`,
        body: truncatedText,
        data: { type: 'chat_message', teamId, messageId },
        url: chatDetailUrl,
        teamId,
      });
    } catch (err) {
      logger.error('notifyChatMessage delivery failed', { userId: uid, err });
    }
  }
}
