import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import morgan from 'morgan';

import { JSON_BODY_LIMIT } from './config/constants.js';
import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  // Behind Vercel rewrite + Render proxy in production; needed for correct req.ip / rate limiting.
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
  // Strips keys starting with `$` or containing `.` from body/query/params (NoSQL injection).
  app.use(mongoSanitize());

  if (env.isDev) app.use(morgan('dev'));
  else if (env.isProd) app.use(morgan('combined'));

  app.use('/api', globalLimiter, apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
