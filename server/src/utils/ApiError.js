/**
 * Operational error with an HTTP status. Throw these from services/controllers;
 * the central error handler turns them into the standard JSON error response.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message  human-readable, safe to show to users
   * @param {Array<{field: string, message: string}>} [errors]  per-field problems
   * @param {{ code?: string, details?: object }} [options]  machine-readable code (ERROR_CODES)
   *   and structured context the client can use (e.g. clash list, reference counts)
   */
  constructor(statusCode, message, errors = undefined, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors, options) {
    return new ApiError(400, message, errors, options);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action', options) {
    return new ApiError(403, message, undefined, options);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource already exists', errors, options) {
    return new ApiError(409, message, errors, options);
  }

  static unprocessable(message = 'Validation failed', errors, options) {
    return new ApiError(422, message, errors, options);
  }

  /** 422 for a single field, e.g. ApiError.invalidField('sectionId', 'Section is not in this class') */
  static invalidField(field, message) {
    return new ApiError(422, message, [{ field, message }]);
  }

  static tooMany(message = 'Too many requests, please try again later') {
    return new ApiError(429, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }
}
