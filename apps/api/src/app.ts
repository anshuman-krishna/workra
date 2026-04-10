import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';

import { env, isProd } from './config/env.js';
import routes from './routes/index.js';
import { globalLimiter } from './middlewares/rate-limit.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

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
  if (!isProd) app.use(morgan('dev'));
  app.use(globalLimiter);

  app.use('/', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
