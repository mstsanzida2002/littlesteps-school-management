/**
 * Standard success envelope:
 *   { success: true, message, data, meta? }
 * Errors are shaped by middleware/errorHandler.js:
 *   { success: false, message, errors?, stack? }
 */
export function sendSuccess(res, { statusCode = 200, message = 'OK', data = null, meta } = {}) {
  const body = { success: true, message, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendCreated(res, { message = 'Created', data = null, meta } = {}) {
  return sendSuccess(res, { statusCode: 201, message, data, meta });
}

/** Build a pagination meta block for list endpoints. */
export function paginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
