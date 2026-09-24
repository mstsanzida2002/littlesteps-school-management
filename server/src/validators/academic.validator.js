import { z } from 'zod';

import { listQuerySchema } from '../utils/listQuery.js';
import { dateKey, objectId } from './common.validator.js';

const atLeastOne = (schema) =>
  schema.refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

// --- Classes ---
const classFields = {
  name: z.string().trim().min(1).max(50),
  order: z.number().int().min(0).max(99),
  description: z.string().trim().max(300).optional(),
};
export const createClassSchema = z.strictObject(classFields);
export const updateClassSchema = atLeastOne(z.strictObject(classFields).partial());
export const listClassesQuery = listQuerySchema({
  sortable: ['order', 'name', 'createdAt'],
  defaultSort: 'order',
});

// --- Sections ---
const sectionName = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9 -]{0,9}$/, 'Use up to 10 letters/digits, e.g. "A"');
const capacity = z.number().int().min(1).max(200);
export const createSectionSchema = z.strictObject({
  classId: objectId,
  name: sectionName,
  capacity: capacity.optional(),
});
export const updateSectionSchema = atLeastOne(
  z.strictObject({
    name: sectionName.optional(),
    capacity: capacity.optional(),
    // Accepted only to return a clear "cannot move sections between classes" error.
    classId: objectId.optional(),
  }),
);
export const listSectionsQuery = listQuerySchema({
  sortable: ['name', 'createdAt'],
  defaultSort: 'name',
  filters: { classId: objectId.optional() },
});

// --- Subjects ---
const subjectFields = {
  name: z.string().trim().min(1).max(50),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, 'Use 2–10 letters/digits, e.g. "ENG"'),
  description: z.string().trim().max(300).optional(),
};
export const createSubjectSchema = z.strictObject(subjectFields);
export const updateSubjectSchema = atLeastOne(z.strictObject(subjectFields).partial());
export const listSubjectsQuery = listQuerySchema({
  sortable: ['name', 'code', 'createdAt'],
  defaultSort: 'name',
});

// --- Academic sessions ---
const sessionFields = {
  name: z.string().trim().min(1).max(20),
  startDate: dateKey,
  endDate: dateKey,
};
// 'YYYY-MM-DD' keys compare correctly as strings.
export const createSessionSchema = z
  .strictObject(sessionFields)
  .refine((s) => s.endDate > s.startDate, {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  });
export const updateSessionSchema = atLeastOne(z.strictObject(sessionFields).partial());
export const activateSessionSchema = z.object({ confirm: z.boolean().optional() });
export const listSessionsQuery = listQuerySchema({
  sortable: ['startDate', 'name', 'createdAt'],
  defaultSort: '-startDate',
});
