import mongoose from 'mongoose';
import config from './config';
import logger from '@core/utils/logger';
const { mongo_uri } = config.db;
const { isDev } = config.app;

const dbUrl = mongo_uri || 'mongodb://localhost/runway';
const connectionType = mongo_uri ? 'MongoDB URI' : 'MongoDB Memory Server';

mongoose.set('debug', isDev);
mongoose.set('strictQuery', false);
mongoose.connect(dbUrl).catch(logger.error);
const db = mongoose.connection;

export { db, connectionType };
