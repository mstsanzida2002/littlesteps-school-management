import { z } from 'zod';

import { TIME_HHMM_RE } from '../models/helpers/schemaTypes.js';
import {
  INVITE_TARGETS,
  MEETING_RESPONSES,
  MEETING_STATUS,
  MEETING_TYPES,
} from '../models/meeting.model.js';
import { dateKey, objectId } from './common.validator.js';

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      return new URL(v).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Online links must be https:// URLs');

const ids = z.array(objectId).max(1000).optional();
const invite = z
  .strictObject({
    target: z.enum(INVITE_TARGETS),
    studentIds: ids,
    sectionIds: ids,
    classIds: ids,
    teacherIds: ids,
  })
  .superRefine((inv, ctx) => {
    const need = { students: 'studentIds', sections: 'sectionIds', classes: 'classIds' }[
      inv.target
    ];
    if (need && !inv[need]?.length) {
      ctx.addIssue({
        code: 'custom',
        path: [need],
        message: `Select at least one for "${inv.target}"`,
      });
    }
    if (inv.target === 'none' && !inv.teacherIds?.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['teacherIds'],
        message: 'Invite at least one teacher',
      });
    }
  });

const fields = {
  title: z.string().trim().min(3).max(150),
  agenda: z.string().trim().max(2000).optional(),
  type: z.enum(MEETING_TYPES),
  // Dhaka local date + time; stored as a real instant.
  date: dateKey,
  time: z.string().regex(TIME_HHMM_RE, 'Use 24-hour HH:mm'),
  durationMinutes: z.number().int().min(5).max(600).optional(),
  venue: z.string().trim().min(2).max(200).optional(),
  onlineLink: httpsUrl.optional(),
  invite,
};

export const createMeetingSchema = z.strictObject(fields).refine((m) => m.venue || m.onlineLink, {
  message: 'Provide a venue or an online link',
  path: ['venue'],
});

export const updateMeetingSchema = z
  .strictObject(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])))
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');

export const cancelMeetingSchema = z.strictObject({
  reason: z.string().trim().min(3).max(500),
});

export const respondSchema = z.strictObject({
  response: z.enum(MEETING_RESPONSES),
  note: z.string().trim().max(300).optional(),
});

export const listMeetingsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  when: z.enum(['upcoming', 'past']).optional(),
  status: z.enum(Object.values(MEETING_STATUS)).optional(),
});
