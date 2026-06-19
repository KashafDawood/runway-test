import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import httpStatus from 'http-status';
import config from '@config/config';
import AppError from '@core/utils/appError';
import { parseDurationToMs } from '@core/utils/duration';
import RefreshSessionModel, { RefreshPlatform } from './refreshSession.model';

/** Grace period for multi-tab / in-flight refresh races before treating reuse as theft. */
const ROTATION_GRACE_MS = 30_000;

export const REFRESH_TOKEN_ALREADY_ROTATED = 'Refresh token already rotated';

export interface CreateRefreshSessionInput {
  platform: RefreshPlatform;
  deviceLabel?: string;
}

export interface CreateRefreshSessionResult {
  rawToken: string;
  sessionId: string;
}

export interface RotateRefreshSessionResult {
  rawToken: string;
  sessionId: string;
  userId: string;
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createRefreshSession(
  userId: string,
  input: CreateRefreshSessionInput,
): Promise<CreateRefreshSessionResult> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const familyId = uuidv4();
  const expiresAt = new Date(Date.now() + parseDurationToMs(config.auth.refreshExpiresIn));
  const now = new Date();

  const session = await RefreshSessionModel.create({
    user: userId,
    tokenHash,
    familyId,
    platform: input.platform,
    deviceLabel: input.deviceLabel,
    expiresAt,
    lastUsedAt: now,
  });

  return {
    rawToken,
    sessionId: session._id.toString(),
  };
}

async function revokeFamily(familyId: string): Promise<void> {
  await RefreshSessionModel.updateMany(
    { familyId, revokedAt: null },
    { revokedAt: new Date() },
  );
}

function isWithinRotationGrace(revokedAt: Date, now: Date): boolean {
  return now.getTime() - revokedAt.getTime() <= ROTATION_GRACE_MS;
}

async function handleFailedRotationClaim(tokenHash: string): Promise<never> {
  const existing = await RefreshSessionModel.findOne({ tokenHash });
  const now = new Date();

  if (!existing) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid refresh token');
  }

  if (existing.revokedAt) {
    if (isWithinRotationGrace(existing.revokedAt, now)) {
      throw new AppError(httpStatus.UNAUTHORIZED, REFRESH_TOKEN_ALREADY_ROTATED);
    }

    await revokeFamily(existing.familyId);
    throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token has been revoked');
  }

  if (existing.expiresAt.getTime() <= now.getTime()) {
    await RefreshSessionModel.findByIdAndUpdate(existing._id, { revokedAt: now });
    throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token has expired');
  }

  throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid refresh token');
}

export async function rotateRefreshSession(rawToken: string): Promise<RotateRefreshSessionResult> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const session = await RefreshSessionModel.findOneAndUpdate(
    {
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: { revokedAt: now, lastUsedAt: now },
    },
    { new: false },
  );

  if (!session) {
    return handleFailedRotationClaim(tokenHash);
  }

  const newRawToken = generateRawToken();
  const newTokenHash = hashToken(newRawToken);
  const expiresAt = new Date(Date.now() + parseDurationToMs(config.auth.refreshExpiresIn));

  const newSession = await RefreshSessionModel.create({
    user: session.user,
    tokenHash: newTokenHash,
    familyId: session.familyId,
    platform: session.platform,
    deviceLabel: session.deviceLabel,
    expiresAt,
    lastUsedAt: now,
  });

  await RefreshSessionModel.findByIdAndUpdate(session._id, {
    replacedBy: newSession._id,
  });

  return {
    rawToken: newRawToken,
    sessionId: newSession._id.toString(),
    userId: session.user.toString(),
  };
}

export async function revokeSessionByToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const session = await RefreshSessionModel.findOne({ tokenHash });

  if (!session || session.revokedAt) {
    return;
  }

  await RefreshSessionModel.findByIdAndUpdate(session._id, { revokedAt: new Date() });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await RefreshSessionModel.updateMany(
    { user: userId, revokedAt: null },
    { revokedAt: new Date() },
  );
}

export async function listActiveSessionsForUser(userId: string) {
  const now = new Date();
  const sessions = await RefreshSessionModel.find({
    user: userId,
    revokedAt: null,
    expiresAt: { $gt: now },
  })
    .sort({ lastUsedAt: -1 })
    .select('platform deviceLabel lastUsedAt created_at expiresAt');

  return sessions.map((session) => ({
    id: session._id,
    platform: session.platform,
    deviceLabel: session.deviceLabel,
    lastUsedAt: session.lastUsedAt,
    createdAt: session.created_at,
    expiresAt: session.expiresAt,
  }));
}
