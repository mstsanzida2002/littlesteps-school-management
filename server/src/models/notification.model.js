import mongoose from 'mongoose';

import { baseSchemaOptions, ref } from './helpers/schemaTypes.js';

export const NOTIFICATION_TYPES = Object.freeze([
  'absence',
  'attendance_corrected',
  'result_published',
  'result_updated',
  'meeting_invite',
  'meeting_updated',
  'meeting_cancelled',
  'low_attendance',
  'notice',
]);

export const RELATED_ENTITY_KINDS = Object.freeze([
  'Attendance',
  'Assessment',
  'Result',
  'Meeting',
  'Notice',
]);

const notificationSchema = new mongoose.Schema(
  {
    recipientId: ref('User'),
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    relatedEntity: {
      kind: { type: String, enum: RELATED_ENTITY_KINDS },
      id: { type: mongoose.Schema.Types.ObjectId, refPath: 'relatedEntity.kind' },
    },
    /**
     * Structured payload for the client, e.g. for 'absence':
     * { date: 'YYYY-MM-DD', subjects: [{ subjectId, subject, teacher, attendanceId }], corrected }
     */
    data: { type: mongoose.Schema.Types.Mixed },
    // Groups updates into one notification, e.g. 'absence:<studentId>:<YYYY-MM-DD>'.
    dedupeKey: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  baseSchemaOptions,
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);

export const Notification = mongoose.model('Notification', notificationSchema);
