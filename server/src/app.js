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
import { createGlobalLimiter } from './middleware/rateLimiter.js';
import { createApiRouter } from './routes/index.js';

/**
 * @param {object} [options]
 * @param {boolean} [options.selfRegistrationEnabled] override env.SELF_REGISTRATION_ENABLED
 * @param {{ refreshSessionMax?: number, refreshIpMax?: number }} [options.rateLimits] test overrides
 * @param {import('express').Router} [options.testRouter] mounted at /api/test (tests only)
 */
export function createApp(options = {}) {
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

  app.use('/api', createGlobalLimiter(), createApiRouter(options));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
