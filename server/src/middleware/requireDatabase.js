import { ERROR_CODES } from '../config/constants.js';
import { isDbConnected } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

export const databaseUnavailable = () =>
  new ApiError(503, 'Service temporarily unavailable. Please try again shortly.', undefined, {
    code: ERROR_CODES.DATABASE_UNAVAILABLE,
  });

/** 503 for every API route (except /health, mounted before this) while MongoDB is down. */
export function requireDatabase(req, res, next) {
  if (!isDbConnected()) return next(databaseUnavailable());
  return next();
}
