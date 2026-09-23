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
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  baseSchemaOptions,
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
