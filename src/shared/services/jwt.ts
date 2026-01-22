import jwt, { verify } from 'jsonwebtoken';
import config from '@config/config';
import logger from '@core/utils/logger';
import { ITokenDecoded } from '@core/interfaces/jwtToken';
import AppError from '@core/utils/appError';
import httpStatus from 'http-status';

export const genAccessToken = (userId: string, additionalPayload?: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const { secret, expiresIn } = config.jwt;
      const payload = { _id: userId, ...additionalPayload };
      const token = jwt.sign(payload, secret, { expiresIn });
      resolve(token);
    } catch (err: any) {
      logger.error(`Error generating access token`, err.message);
      reject(err);
    }
  });
};

export const verifyAccessToken = (token: string): Promise<ITokenDecoded> => {
  return new Promise((resolve, reject) => {
    try {
      const { secret } = config.jwt;
      const decodedToken = verify(token, secret);
      resolve(decodedToken as ITokenDecoded);
    } catch (err) {
      reject(new AppError(httpStatus.UNAUTHORIZED, 'Invalid or expired token'));
    }
  });
};


