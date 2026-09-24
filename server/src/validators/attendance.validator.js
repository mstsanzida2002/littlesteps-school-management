import { z } from 'zod';

import { ATTENDANCE_STATUS } from '../config/constants.js';
import { NOTIFICATION_TYPES } from '../models/notification.model.js';
import { listQuerySchema } from '../utils/listQuery.js';
import { dateKey, objectId } from './common.validator.js';

const status = z.enum(Object.values(ATTENDANCE_STATUS));
const reason = z
  .string({ error: 'A reason is required' })
  .trim()
  .min(3, 'Give a reason (at least 3 characters)')
  .max(500);
const uniqueIds = z
  .array(objectId)
  .min(1)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, 'Each subject may appear only once');

export const markAttendanceSchema = z.strictObject({
  classId: objectId,
  sectionId: objectId,
  date: dateKey,
  // "Mark all present": every student not listed in entries gets this status.
  defaultStatus: status.optional(),
  entries: z
    .array(z.strictObject({ studentId: objectId, status }))
    .max(200)
    .default([]),
  // Explicit subjects instead of the timetable (unscheduled classes, substitutions).
  subjectIds: uniqueIds.optional(),
});

export const editRecordSchema = z.strictObject({ status, reason });
export const editDaySchema = z.strictObject({ status, reason, subjectIds: uniqueIds.optional() });

export const classSectionParams = z.object({ classId: objectId, sectionId: objectId });
export const studentParams = z.object({ studentId: objectId });
export const studentDayParams = z.object({ studentId: objectId, date: dateKey });

const range = {
  from: dateKey.optional(),
  to: dateKey.optional(),
};
const rangeOrdered = (schema) =>
  schema.refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: '"from" must be on or before "to"',
    path: ['to'],
  });

export const summaryQuery = rangeOrdered(z.object(range));
export const classSummaryQuery = rangeOrdered(
  z.object({ ...range, subjectId: objectId.optional() }),
);
export const sheetQuery = z.object({ date: dateKey.optional() });

export const listNotificationsQuery = listQuerySchema({
  sortable: ['createdAt', 'updatedAt'],
  defaultSort: '-updatedAt',
  filters: {
    unread: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    type: z.enum(NOTIFICATION_TYPES).optional(),
  },
});
