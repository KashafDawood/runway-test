import { Request, Response, NextFunction } from 'express';
import logger from '@core/utils/logger';
import { IUser } from '@components/user/v1/user.interface';

declare module 'express-serve-static-core' {
  interface Request {
    user?: IUser;
  }
}

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncWrapper(handler: AsyncRequestHandler): AsyncRequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error: any) {
      logger.error(error.message || error);
      next(error);
    }
  };
}

export default asyncWrapper;
