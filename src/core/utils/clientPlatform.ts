import { Request } from 'express';
import { RefreshPlatform } from '@components/auth/v1/refreshSession.model';

export function getClientPlatform(req: Request): RefreshPlatform {
  const header = (req.headers['x-client-platform'] as string | undefined)?.toLowerCase();

  if (header === 'ios' || header === 'android' || header === 'web') {
    return header;
  }

  return 'web';
}

export function isNativePlatform(platform: RefreshPlatform): boolean {
  return platform === 'ios' || platform === 'android';
}

export function getDeviceLabel(req: Request): string | undefined {
  const userAgent = req.headers['user-agent'];
  if (!userAgent || typeof userAgent !== 'string') {
    return undefined;
  }

  return userAgent.slice(0, 200);
}
