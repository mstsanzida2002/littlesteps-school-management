import rateLimit from 'express-rate-limit';

import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const baseOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next, options) => next(new ApiError(options.statusCode, options.message)),
};

/** Applied to every /api request. */
export const globalLimiter = rateLimit({
  ...baseOptions,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  message: 'Too many requests, please try again later',
  // Platform health checks (Render) poll frequently; never throttle them.
  skip: (req) => req.path === '/health',
});

/** Stricter limiter for credential endpoints (login, refresh, password reset). */
export const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again in 15 minutes',
});
