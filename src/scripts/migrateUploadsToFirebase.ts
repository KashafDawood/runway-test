/**
 * One-off migration: copy local `public/uploads/**` files to Firebase Storage
 * and update MongoDB paths from `/uploads/...` to public Firebase URLs.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/migrateUploadsToFirebase.ts
 */
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import config from '@config/config';
import logger from '@core/utils/logger';
import { getStorageBucket } from '@shared/services/firebase';
import UserModel from '@components/user/v1/user.model';
import { Team as TeamModel } from '@components/team/v1/team.model';
import { UPLOAD_ROOT_DIR } from '@shared/services/imageStorage/disk.storage';

const buildPublicUrl = (bucketName: string, objectKey: string, downloadToken?: string): string => {
  const encodedPath = encodeURIComponent(objectKey);
  const base = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`;
  return downloadToken ? `${base}&token=${downloadToken}` : base;
};

const walkFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
};

const migrateUploadsToFirebase = async () => {
  const bucket = getStorageBucket();
  const bucketName = config.firebase.storageBucket;

  if (!bucket || !bucketName) {
    throw new Error('Firebase Storage is not configured');
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(config.db.mongo_uri);
    logger.info('Database connected');
  }

  const pathMap = new Map<string, string>();
  let uploaded = 0;

  try {
    await fs.access(UPLOAD_ROOT_DIR);
  } catch {
    logger.info('No local uploads directory found; skipping file upload step');
  }

  try {
    const localFiles = await walkFiles(UPLOAD_ROOT_DIR);

    for (const absolutePath of localFiles) {
      const relativeFromUploads = path
        .relative(UPLOAD_ROOT_DIR, absolutePath)
        .split(path.sep)
        .join('/');
      const objectKey = `uploads/${relativeFromUploads}`;
      const relativePath = `/${objectKey}`;
      const gcsFile = bucket.file(objectKey);
      const buffer = await fs.readFile(absolutePath);

      const [exists] = await gcsFile.exists();
      let downloadToken: string | undefined;

      if (!exists) {
        downloadToken = randomUUID();
        await gcsFile.save(buffer, {
          resumable: false,
          metadata: {
            metadata: {
              firebaseStorageDownloadTokens: downloadToken,
            },
          },
        });
        uploaded += 1;
      }

      if (!downloadToken) {
        const [metadata] = await gcsFile.getMetadata();
        const rawToken = metadata?.metadata?.firebaseStorageDownloadTokens;
        downloadToken = typeof rawToken === 'string' ? rawToken.split(',')[0] : undefined;
      }

      pathMap.set(relativePath, buildPublicUrl(bucketName, objectKey, downloadToken));
    }

    logger.info(`Uploaded ${uploaded} new file(s) to Firebase Storage`);

    let usersUpdated = 0;
    const users = await UserModel.find({
      avatar: { $regex: '^/uploads/', $options: 'i' },
    }).select('_id avatar');

    for (const user of users) {
      const avatar = user.avatar?.trim();
      if (!avatar) continue;
      const publicUrl = pathMap.get(avatar) ?? pathMap.get(avatar.replace(/\\/g, '/'));
      if (!publicUrl) {
        logger.warn(`No uploaded file for user avatar: ${avatar}`);
        continue;
      }
      await UserModel.updateOne({ _id: user._id }, { $set: { avatar: publicUrl } });
      usersUpdated += 1;
    }

    let teamsUpdated = 0;
    const teams = await TeamModel.find({
      $or: [
        { logoPath: { $regex: '^/uploads/', $options: 'i' } },
        { coverImagePath: { $regex: '^/uploads/', $options: 'i' } },
      ],
    }).select('_id logoPath coverImagePath');

    for (const team of teams) {
      const update: { logoPath?: string; coverImagePath?: string } = {};

      if (team.logoPath?.startsWith('/uploads/')) {
        const publicUrl = pathMap.get(team.logoPath);
        if (publicUrl) update.logoPath = publicUrl;
        else logger.warn(`No uploaded file for team logo: ${team.logoPath}`);
      }

      if (team.coverImagePath?.startsWith('/uploads/')) {
        const publicUrl = pathMap.get(team.coverImagePath);
        if (publicUrl) update.coverImagePath = publicUrl;
        else logger.warn(`No uploaded file for team cover: ${team.coverImagePath}`);
      }

      if (Object.keys(update).length > 0) {
        await TeamModel.updateOne({ _id: team._id }, { $set: update });
        teamsUpdated += 1;
      }
    }

    logger.info(`Updated ${usersUpdated} user avatar(s) and ${teamsUpdated} team record(s)`);
  } finally {
    if (require.main === module) {
      await mongoose.disconnect();
    }
  }
};

if (require.main === module) {
  migrateUploadsToFirebase()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed:', err);
      process.exit(1);
    });
}

export default migrateUploadsToFirebase;
