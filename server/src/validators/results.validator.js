import { z } from 'zod';

import {
  ASSESSMENT_MODES,
  ASSESSMENT_STATUS,
  ASSESSMENT_TYPES,
} from '../models/assessment.model.js';
import { RESULT_ATTENDANCE } from '../models/result.model.js';
import { listQuerySchema } from '../utils/listQuery.js';
import { dateKey, objectId } from './common.validator.js';

const marks = z
  .number()
  .min(0)
  .max(1000)
  .refine((n) => Math.round(n * 100) === n * 100, 'Use at most 2 decimals');
const grade = z.string().trim().min(1).max(5);
const remarks = z.string().trim().max(500);
const attendance = z.enum(Object.values(RESULT_ATTENDANCE));

export const createAssessmentSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(100),
    type: z.enum(ASSESSMENT_TYPES),
    mode: z.enum(Object.values(ASSESSMENT_MODES)).default(ASSESSMENT_MODES.MARKS),
    classId: objectId,
    sectionId: objectId,
    subjectId: objectId,
    totalMarks: z.number().int().min(1).max(1000).optional(),
    date: dateKey,
  })
  .refine((a) => a.mode !== ASSESSMENT_MODES.MARKS || a.totalMarks, {
    message: 'totalMarks is required for marks-based assessments',
    path: ['totalMarks'],
  });

export const updateAssessmentSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(100).optional(),
    type: z.enum(ASSESSMENT_TYPES).optional(),
    mode: z.enum(Object.values(ASSESSMENT_MODES)).optional(),
    totalMarks: z.number().int().min(1).max(1000).optional(),
    date: dateKey.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');

export const listAssessmentsQuery = listQuerySchema({
  sortable: ['date', 'createdAt', 'name'],
  defaultSort: '-date',
  filters: {
    classId: objectId.optional(),
    sectionId: objectId.optional(),
    subjectId: objectId.optional(),
    status: z.enum(Object.values(ASSESSMENT_STATUS)).optional(),
  },
});

const entry = z.strictObject({
  studentId: objectId,
  attendance: attendance.default(RESULT_ATTENDANCE.PRESENT),
  marksObtained: marks.nullable().optional(),
  grade: grade.nullable().optional(),
  remarks: remarks.optional(),
});

export const saveResultsSchema = z.strictObject({
  entries: z.array(entry).min(1).max(200),
});

export const editResultSchema = z
  .strictObject({
    attendance: attendance.optional(),
    marksObtained: marks.nullable().optional(),
    grade: grade.nullable().optional(),
    remarks: remarks.optional(),
    reason: z
      .string({ error: 'A reason is required' })
      .trim()
      .min(3, 'Give a reason (at least 3 characters)')
      .max(500),
  })
  .refine((b) => Object.keys(b).some((k) => k !== 'reason'), 'Change at least one field');

export const assessmentIdParams = z.object({ assessmentId: objectId });
export const studentResultsQuery = z.object({
  subjectId: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
