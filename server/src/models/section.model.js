import mongoose from 'mongoose';

import { baseSchemaOptions, ref } from './helpers/schemaTypes.js';

const sectionSchema = new mongoose.Schema(
  {
    classId: ref('Class'),
    name: { type: String, required: true, trim: true, uppercase: true, maxlength: 10 },
    capacity: { type: Number, min: 1 },
  },
  baseSchemaOptions,
);

sectionSchema.index({ classId: 1, name: 1 }, { unique: true });

export const Section = mongoose.model('Section', sectionSchema);
