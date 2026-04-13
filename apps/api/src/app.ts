import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'node:http';

// pino-http ships a default export that is a function, but typescript sees the
// namespace wrapper. this alias extracts the callable.
const httpLogger = pinoHttp as unknown as typeof pinoHttp.default;
import mongoSanitize from 'express-mongo-sanitize';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { logger } from './utils/logger.js';
import { globalLimiter } from './middlewares/rate-limit.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { increment } from './utils/metrics.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    httpLogger({
      logger,
      customLogLevel: (_req: IncomingMessage, res: ServerResponse, err: Error | undefined) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'debug';
      },
      serializers: {
        req: (req: IncomingMessage) => ({ method: req.method, url: req.url }),
        res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(globalLimiter);

  app.use((_req, _res, next) => {
    increment('requests_total');
    next();
  });

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
