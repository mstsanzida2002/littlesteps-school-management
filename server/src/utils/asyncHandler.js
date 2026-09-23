/**
 * Wrap an async route handler so rejected promises reach the error handler.
 * (Express 4 does not forward async errors on its own.)
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
