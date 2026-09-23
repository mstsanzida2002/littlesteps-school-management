import mongoose from 'mongoose';

import { baseSchemaOptions, ref, schoolDate } from './helpers/schemaTypes.js';

export const ASSESSMENT_TYPES = Object.freeze(['class_test', 'mid_term', 'final', 'other']);
export const ASSESSMENT_STATUS = Object.freeze({ DRAFT: 'draft', PUBLISHED: 'published' });

const assessmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, enum: ASSESSMENT_TYPES, required: true },
    subjectId: ref('Subject'),
    classId: ref('Class'),
    sectionId: ref('Section'),
    // Deviation from SRS: assessments are scoped to an academic session.
    sessionId: ref('AcademicSession'),
    createdBy: ref('User'),
    totalMarks: { type: Number, required: true, min: 1, max: 1000 },
    date: schoolDate(),
    status: {
      type: String,
      enum: Object.values(ASSESSMENT_STATUS),
      default: ASSESSMENT_STATUS.DRAFT,
    },
    publishedAt: Date,
  },
  baseSchemaOptions,
);

assessmentSchema.index({ classId: 1, sectionId: 1, subjectId: 1, sessionId: 1 });
assessmentSchema.index({ createdBy: 1, status: 1 });

export const Assessment = mongoose.model('Assessment', assessmentSchema);
