import http from 'http';
import app from '@app';
import config from '@config/config';
import logger from '@core/utils/logger';
import errorHandler from '@core/utils/errorHandler';
import { db, connectionType } from '@config/db';
import runAllSeeders from '@seeders/index';

const { port } = config.app;

db.on('error', logger.error.bind(logger, 'MongoDB connection error:'));
db.on('close', () => {
  logger.info('DB connection is closed');
});
db.once('open', async () => {
  if (connectionType === 'MongoDB URI') {
    logger.info(`Connected to ${connectionType}`);
  } else {
    logger.warn(`Connected to ${connectionType}`);
  }

  // Run database seeders
  try {
    await runAllSeeders();
  } catch (error) {
    logger.error('Failed to run seeders:', error);
  }
});

export const server = http.createServer(app);

server.listen(port, (): void => {
  logger.info(`Application listens on PORT: ${port}`);
});

const exitHandler = (): void => {
  if (app) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: Error): void => {
  errorHandler.handleError(error);
  if (!errorHandler.isTrustedError(error)) {
    exitHandler();
  }
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled rejection !!!!!!');
  throw reason;
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
