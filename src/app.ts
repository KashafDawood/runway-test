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

const allowedOrigins = config.app.allowedOrigins.split(',');

const { isProd } = config.app;
const app: Application = express();

app.use(
  '/api/static',
  express.static('public', {
    setHeaders: function (res, path) {
      const origin = res.req.headers.origin;

      if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
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
