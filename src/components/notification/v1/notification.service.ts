import { Types } from 'mongoose';
import DeviceTokenModel from './deviceToken.model';
import NotificationLogModel from './notificationLog.model';
import { getMessaging } from '@shared/services/firebase';
import { NotificationPlatform } from './notification.interface';
import type { INotificationPayload, INotificationLogDoc } from './notification.interface';
import logger from '@core/utils/logger';

/**
 * Register or update a device FCM token for the user.
 * If the token already exists for another user, it is reassigned to this user.
 */
export async function registerToken(
  userId: string,
  token: string,
  options?: { platform?: NotificationPlatform; label?: string }
): Promise<void> {
  await DeviceTokenModel.findOneAndUpdate(
    { token },
    {
      userId,
      platform: options?.platform || 'web',
      label: options?.label,
    },
    { upsert: true, new: true }
  );
}

/**
 * Remove a device token (e.g. on logout).
 */
export async function unregisterToken(token: string): Promise<void> {
  await DeviceTokenModel.deleteOne({ token });
}

/**
 * Get all FCM tokens for a user.
 */
export async function getTokensForUser(userId: string): Promise<string[]> {
  const docs = await DeviceTokenModel.find({ userId }).select('token').lean();
  return docs.map((d) => d.token);
}

/**
 * Send a notification to all devices of a single user.
 */
export async function sendToUser(
  userId: string,
  payload: INotificationPayload
): Promise<{ success: number; failure: number }> {
  const tokens = await getTokensForUser(userId);
  if (tokens.length === 0) {
    logger.debug(`No device tokens for user ${userId}`);
    return { success: 0, failure: 0 };
  }
  return sendToTokens(tokens, payload, userId);
}

/**
 * Send a notification to all devices of multiple users.
 */
export async function sendToUsers(
  userIds: string[],
  payload: INotificationPayload
): Promise<{ success: number; failure: number }> {
  const docs = await DeviceTokenModel.find({ userId: { $in: userIds } }).select('token').lean();
  const tokens = docs.map((d) => d.token);
  if (tokens.length === 0) {
    return { success: 0, failure: 0 };
  }
  return sendToTokens(tokens, payload);
}

/**
 * Send a notification to an FCM topic (e.g. team_123).
 * Clients must subscribe to the topic on their side.
 */
export async function sendToTopic(
  topic: string,
  payload: INotificationPayload
): Promise<boolean> {
  const messaging = getMessaging();
  if (!messaging) {
    logger.warn('Firebase not initialized; cannot send to topic');
    return false;
  }

  const topicData: Record<string, string> = payload.data ? stringifyData(payload.data) : {};
  if (payload.clickUrl) topicData.url = payload.clickUrl;

  const message: import('firebase-admin/messaging').Message = {
    topic,
    notification: {
      title: payload.title,
      body: payload.body || '',
      imageUrl: payload.imageUrl,
    },
    data: Object.keys(topicData).length > 0 ? topicData : undefined,
    webpush: payload.clickUrl
      ? { fcmOptions: { link: payload.clickUrl } }
      : undefined,
  };

  try {
    await messaging.send(message);
    return true;
  } catch (err) {
    logger.error('FCM sendToTopic error', { topic, err });
    return false;
  }
}

/**
 * Send to a list of tokens. Invalid/expired tokens are removed from DB when FCM returns error.
 */
async function sendToTokens(
  tokens: string[],
  payload: INotificationPayload,
  userId?: string
): Promise<{ success: number; failure: number }> {
  const messaging = getMessaging();
  if (!messaging) {
    logger.warn('Firebase not initialized; push not sent');
    return { success: 0, failure: tokens.length };
  }

  const data: Record<string, string> = payload.data ? stringifyData(payload.data) : {};
  if (payload.clickUrl) {
    data.url = payload.clickUrl;
  }

  const message: import('firebase-admin/messaging').MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body || '',
      imageUrl: payload.imageUrl,
    },
    data: Object.keys(data).length > 0 ? data : undefined,
    webpush: payload.clickUrl
      ? { fcmOptions: { link: payload.clickUrl } }
      : undefined,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    const success = response.successCount;
    const failure = response.failureCount;

    if (response.failureCount > 0 && response.responses) {
      const tokensToRemove: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === 'messaging/invalid-registration-token') {
          tokensToRemove.push(tokens[idx]);
        }
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          tokensToRemove.push(tokens[idx]);
        }
      });
      if (tokensToRemove.length > 0) {
        await DeviceTokenModel.deleteMany({ token: { $in: tokensToRemove } });
        logger.debug(`Removed ${tokensToRemove.length} invalid FCM token(s)`);
      }
    }

    return { success, failure };
  } catch (err) {
    logger.error('FCM sendToTokens error', { tokenCount: tokens.length, userId, err });
    return { success: 0, failure: tokens.length };
  }
}

function stringifyData(data: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Inbox service methods
// ---------------------------------------------------------------------------

export interface ListNotificationsOptions {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
}

export interface NotificationListResult {
  items: INotificationLogDoc[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export async function listNotifications(
  userId: string,
  options: ListNotificationsOptions = {}
): Promise<NotificationListResult> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (options.unreadOnly) filter.readAt = null;
  if (options.type) filter.type = options.type;

  const [items, total, unreadCount] = await Promise.all([
    NotificationLogModel.find(filter).sort({ sentAt: -1 }).skip(skip).limit(limit).lean(),
    NotificationLogModel.countDocuments(filter),
    NotificationLogModel.countDocuments({ userId: new Types.ObjectId(userId), readAt: null }),
  ]);

  return { items: items as unknown as INotificationLogDoc[], total, unreadCount, page, limit };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return NotificationLogModel.countDocuments({
    userId: new Types.ObjectId(userId),
    readAt: null,
  });
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await NotificationLogModel.updateOne(
    { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
    { $set: { readAt: new Date() } }
  );
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await NotificationLogModel.updateMany(
    { userId: new Types.ObjectId(userId), readAt: null },
    { $set: { readAt: new Date() } }
  );
}

export async function deleteNotification(notificationId: string, userId: string): Promise<void> {
  await NotificationLogModel.deleteOne({
    _id: new Types.ObjectId(notificationId),
    userId: new Types.ObjectId(userId),
  });
}
