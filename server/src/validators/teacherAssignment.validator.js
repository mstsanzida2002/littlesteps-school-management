import { z } from 'zod';

import { ASSIGNMENT_STATUS, WEEKDAYS } from '../config/constants.js';
import { TIME_HHMM_RE } from '../models/helpers/schemaTypes.js';
import { listQuerySchema } from '../utils/listQuery.js';
import { objectId } from './common.validator.js';

const time = z.string().regex(TIME_HHMM_RE, 'Use 24-hour HH:mm, e.g. 08:30');

const slot = z
  .object({ day: z.enum(WEEKDAYS), startTime: time, endTime: time })
  .refine((s) => s.endTime > s.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

/** Weekly slots; slots of the same assignment must not overlap each other. */
export const scheduleSchema = z
  .array(slot)
  .max(35)
  .superRefine((slots, ctx) => {
    slots.forEach((a, i) => {
      slots.slice(i + 1).forEach((b, offset) => {
        if (a.day === b.day && a.startTime < b.endTime && b.startTime < a.endTime) {
          ctx.addIssue({
            code: 'custom',
            path: [i + 1 + offset],
            message: `Overlaps another slot on ${a.day} (${a.startTime}–${a.endTime})`,
          });
        }
      });
    });
  });

export const createAssignmentSchema = z.strictObject({
  teacherId: objectId,
  classId: objectId,
  sectionId: objectId,
  subjectId: objectId,
  schedule: scheduleSchema.default([]),
});

export const updateAssignmentSchema = z.strictObject({ schedule: scheduleSchema });

export const listAssignmentsQuery = listQuerySchema({
  sortable: ['createdAt'],
  defaultSort: 'createdAt',
  filters: {
    sessionId: objectId.optional(),
    teacherId: objectId.optional(),
    classId: objectId.optional(),
    sectionId: objectId.optional(),
    subjectId: objectId.optional(),
    status: z.enum(Object.values(ASSIGNMENT_STATUS)).optional(),
  },
});
