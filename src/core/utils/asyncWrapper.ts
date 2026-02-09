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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(errorMessage);
      next(error);
    }
  };
}

export default asyncWrapper;
