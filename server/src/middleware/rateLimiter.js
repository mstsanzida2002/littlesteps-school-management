import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// Limiters are created per app (factories) so each createApp() — and each test — gets its own
// counters. In-memory store: fine for a single Render instance; use a shared store if scaled out.
// req.ip honours the TRUST_PROXY setting (app.set('trust proxy')).

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const baseOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next, options) => next(new ApiError(options.statusCode, options.message)),
};

/** Applied to every /api request. */
export const createGlobalLimiter = () =>
  rateLimit({
    ...baseOptions,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    message: 'Too many requests, please try again later',
    // Platform health checks (Render) poll frequently; never throttle them.
    skip: (req) => req.path === '/health',
  });

export function createAuthLimiters() {
  return {
    /** 5 failed logins per 15 min per IP + identifier (successful logins don't count). */
    login: rateLimit({
      ...baseOptions,
      windowMs: FIFTEEN_MINUTES,
      limit: 5,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => {
        const identifier = String(req.body?.identifier ?? '')
          .trim()
          .toLowerCase();
        return `${ipKeyGenerator(req.ip)}|${identifier}`;
      },
      message: 'Too many failed login attempts. Please try again in 15 minutes.',
    }),

    /** Looser per-IP cap: slows one IP trying many different usernames. */
    loginPerIp: rateLimit({
      ...baseOptions,
      windowMs: FIFTEEN_MINUTES,
      limit: 30,
      skipSuccessfulRequests: true,
      message: 'Too many failed login attempts from this network. Please try again later.',
    }),

    register: rateLimit({
      ...baseOptions,
      windowMs: 60 * 60 * 1000,
      limit: 5,
      message: 'Too many registration attempts. Please try again later.',
    }),

    refresh: rateLimit({
      ...baseOptions,
      windowMs: FIFTEEN_MINUTES,
      limit: 60,
      message: 'Too many requests, please try again later',
    }),
  };
}
