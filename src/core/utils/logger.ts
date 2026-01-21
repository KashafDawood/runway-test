import winston from 'winston';
import httpContext from 'express-http-context';
import fs from 'fs';
import path from 'path';

import config from '@config/config';
const { isDev } = config.app;

const errorStackFormat = winston.format((info: winston.Logform.TransformableInfo) => {
  if (info instanceof Error) {
    return {
      ...info,
      stack: info.stack,
      message: info.message,
    };
  }
  return info;
});
type ErrorTemplateInfo = winston.Logform.TransformableInfo & { stack?: string; timestamp?: string };

const errorTemplate = ({ timestamp, level, message, stack }: ErrorTemplateInfo): string => {
  const reqId = httpContext.get('ReqId');
  let tmpl = `${timestamp}`;
  if (reqId) tmpl += ` ${reqId}`;
  tmpl += ` ${level} ${message}`;
  if (stack) tmpl += ` \n ${stack}`;
  return tmpl;
};

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logDir = path.join(__dirname, '../../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger: winston.Logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  levels,
  format: winston.format.combine(
    errorStackFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.uncolorize(),
    winston.format.splat(),
    winston.format.printf(errorTemplate),
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),

    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
  ],
});

export default logger;
