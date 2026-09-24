import mongoose from 'mongoose';

import { baseSchemaOptions, ref } from './helpers/schemaTypes.js';

export const RESULT_ATTENDANCE = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'absent',
  // Excused: not assessed for a valid reason; like absent, it has no marks or grade.
  EXCUSED: 'excused',
});

const resultSchema = new mongoose.Schema(
  {
    assessmentId: ref('Assessment'),
    studentId: ref('User', { index: true }),
    attendance: {
      type: String,
      enum: Object.values(RESULT_ATTENDANCE),
      default: RESULT_ATTENDANCE.PRESENT,
    },
    // marksObtained <= assessment.totalMarks is enforced in the result service (cross-document).
    marksObtained: { type: Number, min: 0 },
    // marksObtained ÷ totalMarks × 100 (marks mode), stored with the grade.
    percent: { type: Number, min: 0, max: 100 },
    grade: { type: String, trim: true, maxlength: 5 },
    // True when the teacher replaced the auto-calculated grade (FR-TCH-10).
    gradeOverridden: { type: Boolean, default: false },
    remarks: { type: String, trim: true, maxlength: 500 },
    updatedBy: ref('User'),
  },
  baseSchemaOptions,
);

resultSchema.index({ assessmentId: 1, studentId: 1 }, { unique: true });
resultSchema.index({ studentId: 1, updatedAt: -1 });

export const Result = mongoose.model('Result', resultSchema);
