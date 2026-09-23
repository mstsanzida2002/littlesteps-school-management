import mongoose from 'mongoose';

import { baseSchemaOptions, ref } from './helpers/schemaTypes.js';

export const NOTICE_AUDIENCES = Object.freeze(['all', 'teachers', 'students']);

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    audience: { type: String, enum: NOTICE_AUDIENCES, default: 'all' },
    isPinned: { type: Boolean, default: false },
    publishedBy: ref('User'),
    publishedAt: { type: Date, default: Date.now },
    expiresAt: Date,
  },
  baseSchemaOptions,
);

noticeSchema.index({ audience: 1, publishedAt: -1 });

export const Notice = mongoose.model('Notice', noticeSchema);
