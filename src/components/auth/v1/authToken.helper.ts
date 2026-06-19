import config from '@config/config';
import { genAccessTokenFromUser } from '@shared/services/jwt';
import { createRefreshSession } from './refreshToken.service';
import { RefreshPlatform } from './refreshSession.model';

export interface AuthUserPayload {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  avatar?: string;
  dateOfBirth?: Date | string;
}

export interface AuthTeamPayload {
  id: string;
  name: string;
  role: string;
  sport?: string;
  season?: string;
  needsGuardianLink?: boolean;
}

export interface AuthTokenBundle {
  user: AuthUserPayload;
  team?: AuthTeamPayload;
  token: string;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  verificationCode?: string;
}

interface IssueTokensInput {
  user: AuthUserPayload;
  team?: AuthTeamPayload;
  platform: RefreshPlatform;
  deviceLabel?: string;
  verificationCode?: string;
}

export async function issueAuthTokens(input: IssueTokensInput): Promise<AuthTokenBundle> {
  const { accessToken, expiresIn } = await genAccessTokenFromUser(input.user.id, {
    email: input.user.email,
    email_verified: input.user.email_verified,
  });

  const response: AuthTokenBundle = {
    user: input.user,
    ...(input.team ? { team: input.team } : {}),
    token: accessToken,
    accessToken,
    expiresIn,
    ...(input.verificationCode ? { verificationCode: input.verificationCode } : {}),
  };

  if (!config.auth.v2Enabled) {
    return response;
  }

  const refreshSession = await createRefreshSession(input.user.id, {
    platform: input.platform,
    deviceLabel: input.deviceLabel,
  });

  if (input.platform !== 'web') {
    response.refreshToken = refreshSession.rawToken;
  }

  return {
    ...response,
    _refreshRawToken: refreshSession.rawToken,
  } as AuthTokenBundle & { _refreshRawToken?: string };
}

export function attachRefreshCookieData(
  bundle: AuthTokenBundle & { _refreshRawToken?: string },
): { data: AuthTokenBundle; refreshRawToken?: string } {
  const refreshRawToken = bundle._refreshRawToken;
  const { _refreshRawToken: _removed, ...data } = bundle as AuthTokenBundle & {
    _refreshRawToken?: string;
  };

  return {
    data,
    refreshRawToken,
  };
}
