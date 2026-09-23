import { ApiError } from '../utils/ApiError.js';
import { formatZodIssues } from './errorHandler.js';

/**
 * Validate request parts against Zod schemas and replace them with the parsed output.
 *
 *   router.post('/', validate({ body: createClassSchema }), controller.create);
 *
 * Parsed values land on req.validated.{body,query,params} (req.query is a getter in some
 * setups, so we never reassign it). req.body is also replaced with the parsed body.
 */
export const validate = (schemas) => async (req, res, next) => {
  const validated = {};
  const errors = [];

  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;
    const result = await schema.safeParseAsync(req[part]);
    if (result.success) {
      validated[part] = result.data;
    } else {
      errors.push(...formatZodIssues(result.error.issues).map((e) => ({ ...e, location: part })));
    }
  }

  if (errors.length) return next(ApiError.unprocessable('Validation failed', errors));

  req.validated = validated;
  if (validated.body) req.body = validated.body;
  return next();
};
