import mongoose from 'mongoose';

import { baseSchemaOptions, ref } from './helpers/schemaTypes.js';

const resultSchema = new mongoose.Schema(
  {
    assessmentId: ref('Assessment'),
    studentId: ref('User', { index: true }),
    // marksObtained <= assessment.totalMarks is enforced in the result service (cross-document).
    marksObtained: { type: Number, min: 0 },
    grade: { type: String, trim: true, maxlength: 5 },
    // True when the teacher replaced the auto-calculated grade (FR-TCH-10).
    gradeOverridden: { type: Boolean, default: false },
    remarks: { type: String, trim: true, maxlength: 500 },
    updatedBy: ref('User'),
  },
  baseSchemaOptions,
);

resultSchema.index({ assessmentId: 1, studentId: 1 }, { unique: true });

export const Result = mongoose.model('Result', resultSchema);
