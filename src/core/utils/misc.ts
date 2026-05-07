import { CorsOptions } from 'cors';
import config from '@config/config';

const originRegex = config.app.originRegex ? new RegExp(config.app.originRegex) : null;
const normalizeOrigin = (value?: string | null): string => (value || '').trim().replace(/\/$/, '');
const allowedOrigins = config.app.allowedOrigins
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

export const corsOption: CorsOptions = {
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  origin: function (origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedOrigin) || (originRegex && originRegex.test(normalizedOrigin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};
