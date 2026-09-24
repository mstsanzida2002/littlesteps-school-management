import mongoose from 'mongoose';
import { ZodError } from 'zod';

import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/** Translate known library errors into ApiError so the response shape stays consistent. */
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    return ApiError.unprocessable('Validation failed', formatZodIssues(err.issues));
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.unprocessable('Validation failed', errors);
  }

  if (err?.code === 11000) {
    const fields = Object.keys(err.keyValue ?? err.keyPattern ?? {});
    return ApiError.conflict(
      `Duplicate value for ${fields.join(', ') || 'a unique field'}`,
      fields.map((field) => ({ field, message: 'Already exists' })),
    );
  }

  // JWT (jose) errors are translated to 401s in services/token.service.js#verifyAccessToken.

  // Malformed JSON body from express.json()
  if (err?.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');
  if (err?.type === 'entity.too.large') return new ApiError(413, 'Request body too large');

  const wrapped = ApiError.internal();
  wrapped.cause = err;
  wrapped.isOperational = false;
  return wrapped;
}

export function formatZodIssues(issues) {
  return issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

// Express recognizes error middleware by its 4-argument signature.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const apiError = normalizeError(err);
  const original = apiError.cause ?? err;

  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} →`, original);
  }

  const body = {
    success: false,
    // Never leak internal messages for unexpected errors in production.
    message: apiError.isOperational || !env.isProd ? apiError.message : 'Internal server error',
  };
  if (apiError.code) body.code = apiError.code;
  if (apiError.errors) body.errors = apiError.errors;
  if (apiError.details) body.details = apiError.details;
  if (!env.isProd && apiError.statusCode >= 500 && original?.stack) body.stack = original.stack;

  res.status(apiError.statusCode).json(body);
}
