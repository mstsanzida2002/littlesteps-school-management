import mongoose from 'mongoose';

import { baseSchemaOptions, optionalEmail, phone, ref, schoolDate } from './helpers/schemaTypes.js';

export const GENDERS = Object.freeze(['male', 'female']);
export const GUARDIAN_RELATIONS = Object.freeze([
  'father',
  'mother',
  'grandfather',
  'grandmother',
  'uncle',
  'aunt',
  'sibling',
  'other',
]);

const guardianSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    relation: { type: String, enum: GUARDIAN_RELATIONS, required: true },
    phone: phone({ required: true }),
    email: optionalEmail(),
    address: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

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
  },
  baseSchemaOptions,
);

studentProfileSchema.index({ userId: 1 }, { unique: true });
studentProfileSchema.index({ classId: 1, sectionId: 1, sessionId: 1, rollNo: 1 }, { unique: true });

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
