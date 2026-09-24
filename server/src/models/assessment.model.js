import mongoose from 'mongoose';

import { baseSchemaOptions, ref, schoolDate } from './helpers/schemaTypes.js';

export const ASSESSMENT_TYPES = Object.freeze(['class_test', 'mid_term', 'final', 'other']);
export const ASSESSMENT_STATUS = Object.freeze({ DRAFT: 'draft', PUBLISHED: 'published' });
/**
 * marks   — totalMarks; grade calculated from the scale (overridable, gradeOverridden)
 * grade   — the teacher picks a grade from the scale directly
 * remarks — written feedback only
 */
export const ASSESSMENT_MODES = Object.freeze({
  MARKS: 'marks',
  GRADE: 'grade',
  REMARKS: 'remarks',
});

// Copy of Settings.gradingScale taken at publish; published grades use it forever.
const scaleBandSchema = new mongoose.Schema(
  { grade: String, minPercent: Number, gpa: Number },
  { _id: false },
);

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
    mode: {
      type: String,
      enum: Object.values(ASSESSMENT_MODES),
      default: ASSESSMENT_MODES.MARKS,
    },
    // Required only in marks mode (validated below).
    totalMarks: { type: Number, min: 1, max: 1000 },
    date: schoolDate(),
    status: {
      type: String,
      enum: Object.values(ASSESSMENT_STATUS),
      default: ASSESSMENT_STATUS.DRAFT,
    },
    publishedAt: Date,
    publishedBy: ref('User', { required: false }),
    gradingScale: { type: [scaleBandSchema], default: undefined },
  },
  baseSchemaOptions,
);

assessmentSchema.pre('validate', function requireTotalMarks() {
  if (this.mode === ASSESSMENT_MODES.MARKS && !this.totalMarks) {
    this.invalidate('totalMarks', 'totalMarks is required for marks-based assessments');
  }
});

assessmentSchema.index({ classId: 1, sectionId: 1, subjectId: 1, sessionId: 1 });
assessmentSchema.index({ createdBy: 1, status: 1 });
assessmentSchema.index({
  classId: 1,
  sectionId: 1,
  subjectId: 1,
  sessionId: 1,
  status: 1,
  date: -1,
});

export const Assessment = mongoose.model('Assessment', assessmentSchema);
