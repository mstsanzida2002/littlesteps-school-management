import { z } from 'zod';

import { listQuerySchema } from '../utils/listQuery.js';
import { dateKey, objectId } from './common.validator.js';

export const listAuditLogsQuery = listQuerySchema({
  sortable: ['createdAt'],
  defaultSort: '-createdAt',
  filters: {
    action: z.string().trim().max(60).optional(),
    actorId: objectId.optional(),
    entityType: z.string().trim().max(60).optional(),
    entityId: objectId.optional(),
    // Asia/Dhaka calendar days, inclusive.
    from: dateKey.optional(),
    to: dateKey.optional(),
  },
}).refine((q) => !q.from || !q.to || q.from <= q.to, {
  message: '"from" must be on or before "to"',
  path: ['to'],
});
