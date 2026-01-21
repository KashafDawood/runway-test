import { Request, Response, NextFunction } from 'express';

import httpStatus from 'http-status';
import AppError from '@core/utils/appError';
import errorHandler from '@core/utils/errorHandler';

// catch all unhandled errors
const errorHandling = (
  error: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line
  next: NextFunction,
) => {
  errorHandler.handleError(error);
  const isTrusted = errorHandler.isTrustedError(error);
  const httpStatusCode = isTrusted ? (error as AppError).httpCode : httpStatus.INTERNAL_SERVER_ERROR;
  const responseError = isTrusted ? error.message : 'Internal server error';
  res.status(httpStatusCode).json({
    ok: false,
    message: responseError,
  });
};

export default errorHandling;
