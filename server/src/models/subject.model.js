import mongoose from 'mongoose';

import { baseSchemaOptions } from './helpers/schemaTypes.js';

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 10 },
    description: { type: String, trim: true, maxlength: 300 },
  },
  baseSchemaOptions,
);

subjectSchema.index({ name: 1 }, { unique: true });
subjectSchema.index({ code: 1 }, { unique: true });

export const Subject = mongoose.model('Subject', subjectSchema);
