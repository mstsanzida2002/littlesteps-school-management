import { z } from 'zod';

import { isValidDateKey } from '../utils/date.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/** 'YYYY-MM-DD' calendar date (Asia/Dhaka); models normalize it via utils/date.js. */
export const dateKey = z.string().refine(isValidDateKey, 'Use a valid date (YYYY-MM-DD)');

export const idParams = z.object({ id: objectId });
