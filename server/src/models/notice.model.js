import mongoose from 'mongoose';

import { baseSchemaOptions, ref } from './helpers/schemaTypes.js';

export const NOTICE_AUDIENCES = Object.freeze(['all', 'teachers', 'students']);
export const NOTICE_STATUS = Object.freeze({ DRAFT: 'draft', PUBLISHED: 'published' });

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    audience: { type: String, enum: NOTICE_AUDIENCES, default: 'all' },
    isPinned: { type: Boolean, default: false },
    status: {
      type: String,
      enum: Object.values(NOTICE_STATUS),
      default: NOTICE_STATUS.DRAFT,
    },
    createdBy: ref('User', { required: false }),
    publishedBy: ref('User', { required: false }),
    publishedAt: Date,
    expiresAt: Date,
  },
  baseSchemaOptions,
);

noticeSchema.index({ audience: 1, publishedAt: -1 });
noticeSchema.index({ status: 1, audience: 1, publishedAt: -1 });

export const Notice = mongoose.model('Notice', noticeSchema);
