import { randomUUID } from 'crypto';
import config from '@config/config';
import { getStorageBucket } from '@shared/services/firebase';
import { buildImageObjectKey } from './objectKey';
import type { StoreImageParams, UploadedImage } from './types';

const buildPublicUrl = (bucketName: string, objectKey: string, downloadToken: string): string => {
  const encodedPath = encodeURIComponent(objectKey);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;
};

/**
 * Persist an image to Firebase Cloud Storage.
 * Returns a public HTTPS URL suitable for storing on models.
 */
export async function storeImage(file: UploadedImage, params: StoreImageParams): Promise<string> {
  const bucket = getStorageBucket();
  const bucketName = config.firebase.storageBucket;

  if (!bucket || !bucketName) {
    throw new Error('Firebase Storage is not configured (missing bucket or credentials)');
  }

  const { objectKey } = buildImageObjectKey(file, params);
  const gcsFile = bucket.file(objectKey);
  const downloadToken = randomUUID();

  await gcsFile.save(file.buffer, {
    contentType: file.mimetype,
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  return buildPublicUrl(bucketName, objectKey, downloadToken);
}
