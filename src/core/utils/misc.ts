import { CorsOptions } from 'cors';
import config from '@config/config';

const originRegex = config.app.originRegex ? new RegExp(config.app.originRegex) : null;
const allowedOrigins = config.app.allowedOrigins.split(',');

export const corsOption: CorsOptions = {
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  origin: function (origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.indexOf(origin) !== -1 || (originRegex && originRegex.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};
