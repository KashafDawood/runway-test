import jwt, { verify, SignOptions } from 'jsonwebtoken';
import config from '@config/config';
import logger from '@core/utils/logger';
import { ITokenDecoded } from '@core/interfaces/jwtToken';
import AppError from '@core/utils/appError';
import httpStatus from 'http-status';
import { parseDurationToSeconds } from '@core/utils/duration';

function getAccessExpiresIn(): string {
  if (config.auth.v2Enabled) {
    return config.jwt.accessExpiresIn;
  }

  return config.jwt.expiresIn;
}

export function getAccessExpiresInSeconds(): number {
  return parseDurationToSeconds(getAccessExpiresIn());
}

export const genAccessToken = (userId: string, additionalPayload?: Record<string, unknown>): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const { secret } = config.jwt;
      const expiresIn = getAccessExpiresIn() as SignOptions['expiresIn'];
      const payload = { _id: userId, ...additionalPayload };
      const token = jwt.sign(payload, secret, { expiresIn });
      resolve(token);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error generating access token`, errorMessage);
      reject(err);
    }
  });
};

export const genAccessTokenFromUser = async (
  userId: string,
  additionalPayload?: Record<string, unknown>,
): Promise<{ accessToken: string; expiresIn: number }> => {
  const accessToken = await genAccessToken(userId, additionalPayload);

  return {
    accessToken,
    expiresIn: getAccessExpiresInSeconds(),
  };
};

export const verifyAccessToken = (token: string): Promise<ITokenDecoded> => {
  return new Promise((resolve, reject) => {
    try {
      const { secret } = config.jwt;
      const decodedToken = verify(token, secret, { algorithms: ['HS256'] });
      resolve(decodedToken as ITokenDecoded);
    } catch (err) {
      reject(new AppError(httpStatus.UNAUTHORIZED, 'Invalid or expired token'));
    }
  });
};
