import { z } from 'zod';

import { NOTICE_AUDIENCES, NOTICE_STATUS } from '../models/notice.model.js';

const expiresAt = z.coerce
  .date()
  .refine((d) => d > new Date(), 'expiresAt must be in the future')
  .nullable()
  .optional();

export const createNoticeSchema = z.strictObject({
  title: z.string().trim().min(3).max(150),
  body: z.string().trim().min(3).max(5000),
  audience: z.enum(NOTICE_AUDIENCES).default('all'),
  isPinned: z.boolean().default(false),
  expiresAt,
  publish: z.boolean().default(false),
});

export const updateNoticeSchema = z
  .strictObject({
    title: z.string().trim().min(3).max(150).optional(),
    body: z.string().trim().min(3).max(5000).optional(),
    audience: z.enum(NOTICE_AUDIENCES).optional(),
    isPinned: z.boolean().optional(),
    expiresAt,
  })
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');

export const listNoticesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(Object.values(NOTICE_STATUS)).optional(),
  audience: z.enum(NOTICE_AUDIENCES).optional(),
  includeExpired: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
