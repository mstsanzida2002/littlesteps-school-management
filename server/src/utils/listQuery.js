/**
 * Shared list conventions for every paginated endpoint:
 *   ?page=1&limit=20&search=text&sort=-createdAt&<filters>
 * Response: { success, message, data: [...items], meta: { page, limit, total, totalPages } }
 */
import { z } from 'zod';

import { paginationMeta } from './apiResponse.js';

export const MAX_LIMIT = 100;

/**
 * Zod schema for list query strings.
 * @param {{ sortable: string[], defaultSort: string, filters?: Record<string, z.ZodType> }} opts
 */
export function listQuerySchema({ sortable, defaultSort, filters = {} }) {
  const allowed = new Set(sortable);
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(20),
    search: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((value) => value || undefined),
    sort: z
      .string()
      .default(defaultSort)
      .refine((value) => allowed.has(value.replace(/^-/, '')), {
        message: `Sort by one of: ${sortable.join(', ')} (prefix - for descending)`,
      }),
    ...filters,
  });
}

/** 'name' → { name: 1, _id: 1 }; '-createdAt' → { createdAt: -1, _id: -1 } (stable paging). */
export function toMongoSort(sort) {
  const direction = sort.startsWith('-') ? -1 : 1;
  return { [sort.replace(/^-/, '')]: direction, _id: direction };
}

/** Case-insensitive "contains" regex with user input escaped. */
export const searchRegex = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/** `{ $or: [{ field: /text/i }, ...] }` or {} when there is no search text. */
export const searchFilter = (text, fields) =>
  text ? { $or: fields.map((field) => ({ [field]: searchRegex(text) })) } : {};

/** Run a paginated find. Returns { items, meta }. Items are lean objects. */
export async function paginate(Model, filter, { page, limit, sort, select, populate }) {
  let query = Model.find(filter)
    .sort(toMongoSort(sort))
    .skip((page - 1) * limit)
    .limit(limit);
  if (select) query = query.select(select);
  if (populate) query = query.populate(populate);

  const [items, total] = await Promise.all([query.lean(), Model.countDocuments(filter)]);
  return { items, meta: paginationMeta({ page, limit, total }) };
}
