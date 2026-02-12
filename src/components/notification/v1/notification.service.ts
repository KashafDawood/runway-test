import DeviceTokenModel from './deviceToken.model';
import { getMessaging } from '@shared/services/firebase';
import { NotificationPlatform } from './notification.interface';
import type { INotificationPayload } from './notification.interface';
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

  const message: import('firebase-admin/messaging').Message = {
    topic,
    notification: {
      title: payload.title,
      body: payload.body || '',
      imageUrl: payload.imageUrl,
    },
    data: payload.data ? stringifyData(payload.data) : undefined,
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

  const message: import('firebase-admin/messaging').MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body || '',
      imageUrl: payload.imageUrl,
    },
    data: payload.data ? stringifyData(payload.data) : undefined,
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
