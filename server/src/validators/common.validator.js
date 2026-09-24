import { z } from 'zod';

import { isValidDateKey } from '../utils/date.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/** 'YYYY-MM-DD' calendar date (Asia/Dhaka); models normalize it via utils/date.js. */
export const dateKey = z.string().refine(isValidDateKey, 'Use a valid date (YYYY-MM-DD)');

export const idParams = z.object({ id: objectId });

/** A child's nickname: 1–30 letters (any script), spaces, dots, apostrophes or hyphens. */
export const nicknameField = z
  .string()
  .trim()
  .min(1, 'Enter a nickname or leave it empty')
  .max(30, 'Keep the nickname to 30 characters')
  .regex(/^\p{L}[\p{L}\p{M} .'-]*$/u, 'Use letters only (spaces, dots and hyphens are fine)');

/** Optional nickname on create: '' means none. */
export const optionalNickname = z
  .union([z.literal(''), nicknameField])
  .optional()
  .transform((v) => v || undefined);
