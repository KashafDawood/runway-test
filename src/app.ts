import express, { Application } from 'express';
import httpContext from 'express-http-context';
import helmet from 'helmet';
import cors from 'cors';

import consts from '@config/consts';
import api from '@routes/api';
import httpLogger from '@core/utils/httpLogger';
import errorHandling from '@core/middlewares/errorHandling.middleware';
import http404 from '@components/404/404.router';
import config from '@config/config';
import { corsOption } from '@core/utils/misc';
import uniqueReqId from '@core/middlewares/uniqueReqId.middleware';

const normalizeOrigin = (value?: string | null): string => (value || '').trim().replace(/\/$/, '');
const allowedOrigins = config.app.allowedOrigins
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);
const localhostSchemeRegex = /^(https?|capacitor|ionic):\/\/localhost(?::\d+)?$/i;

const { isProd } = config.app;
const app: Application = express();

app.use(
  '/api/static',
  express.static('public', {
    setHeaders: function (res) {
      const origin = res.req.headers.origin;

      const normalizedOrigin = normalizeOrigin(origin);
      const isAllowedOrigin = allowedOrigins.includes(normalizedOrigin) || localhostSchemeRegex.test(normalizedOrigin);
      if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', normalizedOrigin);
      }
    },
  }),
);
if (isProd) {
  app.use(helmet());
}
app.use(httpContext.middleware);
app.use(httpLogger.successHandler);
app.use(httpLogger.errorHandler);
app.use(uniqueReqId);
app.use(cors(corsOption));
app.use(express.json());

app.use(consts.API_ROOT_PATH, api);
app.use(http404);

app.use(errorHandling);

export default app;
