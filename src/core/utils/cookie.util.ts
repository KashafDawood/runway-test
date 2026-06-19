import { Request, Response } from 'express';
import config from '@config/config';
import { parseDurationToMs } from './duration';

export function getCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    if (key === name) {
      return decodeURIComponent(trimmed.slice(separatorIndex + 1));
    }
  }

  return undefined;
}

export function setRefreshCookie(res: Response, rawToken: string): void {
  const { refreshCookie } = config.auth;
  const maxAge = parseDurationToMs(config.auth.refreshExpiresIn);

  res.cookie(refreshCookie.name, rawToken, {
    httpOnly: true,
    secure: refreshCookie.secure,
    sameSite: refreshCookie.sameSite,
    path: refreshCookie.path,
    maxAge,
  });
}

export function clearRefreshCookie(res: Response): void {
  const { refreshCookie } = config.auth;

  res.clearCookie(refreshCookie.name, {
    httpOnly: true,
    secure: refreshCookie.secure,
    sameSite: refreshCookie.sameSite,
    path: refreshCookie.path,
  });
}
