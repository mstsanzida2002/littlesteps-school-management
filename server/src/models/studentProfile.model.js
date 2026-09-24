import mongoose from 'mongoose';

import { GENDERS } from '../config/constants.js';
import { guardianSchema } from './helpers/guardian.js';
import { baseSchemaOptions, ref, schoolDate } from './helpers/schemaTypes.js';

export { GUARDIAN_RELATIONS } from './helpers/guardian.js';
export { GENDERS } from '../config/constants.js';

const studentProfileSchema = new mongoose.Schema(
  {
    userId: ref('User'),
    rollNo: { type: Number, required: true, min: 1, validate: Number.isInteger },
    classId: ref('Class'),
    sectionId: ref('Section'),
    // Deviation from SRS: roll numbers are unique per session.
    sessionId: ref('AcademicSession'),
    dateOfBirth: schoolDate(),
    gender: { type: String, enum: GENDERS },
    guardian: { type: guardianSchema, required: true },
    admissionDate: schoolDate(),
    // Low-attendance crossing state (FR-STU-04): the warning fires only when this flips to true.
    attendanceAlert: {
      belowThreshold: { type: Boolean, default: false },
      since: Date,
      lastPercent: Number,
    },
  },
  baseSchemaOptions,
);

studentProfileSchema.index({ userId: 1 }, { unique: true });
studentProfileSchema.index({ classId: 1, sectionId: 1, sessionId: 1, rollNo: 1 }, { unique: true });

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
