import * as admin from 'firebase-admin';
import path from 'path';
import config from '@config/config';
import logger from '@core/utils/logger';

let app: admin.app.App | null = null;

const getStorageBucketName = (): string | undefined => config.firebase.storageBucket;

/**
 * Initialize Firebase Admin SDK.
 * Uses FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_* env vars.
 * Safe to call multiple times; initializes only once.
 * Returns null if credentials are not configured (push will be no-op).
 */
export function getFirebaseApp(): admin.app.App | null {
  if (app) {
    return app;
  }

  const { firebase: fb } = config;
  const hasEnvCreds = fb.projectId && fb.clientEmail && fb.privateKey;
  const serviceAccountPath = fb.serviceAccountPath
    ? path.isAbsolute(fb.serviceAccountPath)
      ? fb.serviceAccountPath
      : path.resolve(process.cwd(), fb.serviceAccountPath)
    : null;

  const initOptions: admin.AppOptions = {};
  if (getStorageBucketName()) {
    initOptions.storageBucket = getStorageBucketName();
  }

  if (serviceAccountPath) {
    try {
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        ...initOptions,
      });
      logger.info('Firebase Admin initialized from service account file');
      return app;
    } catch (err) {
      logger.warn('Firebase init failed (service account file):', err);
      return null;
    }
  }

  if (hasEnvCreds) {
    try {
      const privateKey = (fb.privateKey || '').replace(/\\n/g, '\n');
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: fb.projectId,
          clientEmail: fb.clientEmail,
          privateKey,
        }),
        ...initOptions,
      });
      logger.info('Firebase Admin initialized from environment');
      return app;
    } catch (err) {
      logger.warn('Firebase init failed (env credentials):', err);
      return null;
    }
  }

  logger.debug('Firebase not configured; push notifications disabled');
  return null;
}

export function getMessaging(): admin.messaging.Messaging | null {
  const firebaseApp = getFirebaseApp();
  return firebaseApp ? firebaseApp.messaging() : null;
}

export function getStorageBucket(): ReturnType<admin.storage.Storage['bucket']> | null {
  const firebaseApp = getFirebaseApp();
  const bucketName = getStorageBucketName();
  if (!firebaseApp || !bucketName) {
    return null;
  }
  return firebaseApp.storage().bucket(bucketName);
}
