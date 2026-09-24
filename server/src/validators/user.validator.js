import { z } from 'zod';

import { ACCOUNT_STATUS, GENDERS, ROLES } from '../config/constants.js';
import { listQuerySchema } from '../utils/listQuery.js';
import {
  bdPhone,
  guardianInput,
  optionalEmail,
  passwordPolicy,
  usernameField,
} from './auth.validator.js';
import { dateKey, objectId } from './common.validator.js';

const name = z.string().trim().min(2).max(100);
const rollNo = z.number().int().min(1).max(999);

const baseAccount = {
  name,
  username: usernameField,
  email: optionalEmail,
  phone: bdPhone.optional(),
  // Initial password set by the admin; the user must change it at first sign-in.
  password: passwordPolicy,
};

export const createUserSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal(ROLES.STUDENT),
    ...baseAccount,
    profile: z.object({
      classId: objectId,
      sectionId: objectId,
      // Omit to use the suggested next free roll number.
      rollNo: rollNo.optional(),
      dateOfBirth: dateKey,
      gender: z.enum(GENDERS).optional(),
      admissionDate: dateKey.optional(),
      guardian: guardianInput,
    }),
  }),
  z.object({
    role: z.literal(ROLES.TEACHER),
    ...baseAccount,
    profile: z.object({
      employeeId: z.string().trim().min(1).max(20),
      qualification: z.string().trim().max(200).optional(),
      joiningDate: dateKey.optional(),
    }),
  }),
  z.object({ role: z.literal(ROLES.ADMIN), ...baseAccount }),
]);

// Profile keys are validated per role in the service (student vs teacher fields).
export const updateUserSchema = z
  .strictObject({
    name: name.optional(),
    username: usernameField.optional(),
    // '' or null removes the email/phone.
    email: z.union([z.literal(''), z.null(), z.email('Invalid email address').max(254)]).optional(),
    phone: z.union([z.literal(''), z.null(), bdPhone]).optional(),
    // Accepted only to give a clear "role cannot be changed" error.
    role: z.string().optional(),
    profile: z
      .strictObject({
        classId: objectId.optional(),
        sectionId: objectId.optional(),
        rollNo: rollNo.optional(),
        dateOfBirth: dateKey.optional(),
        gender: z.enum(GENDERS).optional(),
        admissionDate: dateKey.optional(),
        guardian: guardianInput.optional(),
        employeeId: z.string().trim().min(1).max(20).optional(),
        qualification: z.string().trim().max(200).optional(),
        joiningDate: dateKey.optional(),
      })
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const listUsersQuery = listQuerySchema({
  sortable: ['name', 'username', 'createdAt', 'lastLoginAt', 'status', 'role'],
  defaultSort: 'name',
  filters: {
    role: z.enum(Object.values(ROLES)).optional(),
    status: z.enum(Object.values(ACCOUNT_STATUS)).optional(),
    classId: objectId.optional(),
    sectionId: objectId.optional(),
    sessionId: objectId.optional(),
  },
});

export const nextRollQuery = z.object({
  classId: objectId,
  sectionId: objectId,
  sessionId: objectId.optional(),
});

export const suspendSchema = z.object({ reason: z.string().trim().max(500).optional() });

export const approveSchema = z.object({
  classId: objectId,
  sectionId: objectId,
  rollNo: rollNo.optional(),
  // Required if the registration did not include it.
  dateOfBirth: dateKey.optional(),
  admissionDate: dateKey.optional(),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, 'Give a short reason').max(500),
});
