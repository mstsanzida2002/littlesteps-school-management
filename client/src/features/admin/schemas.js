/**
 * Admin form checks, mirroring the server validators (user.validator.js, auth.validator.js,
 * common.validator.js) so mistakes show before submitting. The server stays the authority: its
 * 422 errors land on the same dotted field names (profile.guardian.phone, …).
 */
import * as z from 'zod/mini';

import { passwordPolicy } from '../auth/schemas.js';

export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
export const BD_PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;
const NICKNAME_RE = /^\p{L}[\p{L}\p{M} .'-]*$/u;

const required = (message) => z.string().check(z.trim(), z.minLength(1, message));
const name = z
  .string()
  .check(z.trim(), z.minLength(2, 'At least 2 characters'), z.maxLength(100, 'Too long'));
const username = z
  .string()
  .check(
    z.trim(),
    z.toLowerCase(),
    z.regex(USERNAME_RE, '3–32 characters: a-z, 0-9, dot, underscore or hyphen'),
  );
const optionalEmail = z.string().check(
  z.trim(),
  z.refine((v) => v === '' || /^\S+@\S+\.\S+$/.test(v), 'Enter a valid email or leave it empty'),
);
const phone = z
  .string()
  .check(z.trim(), z.regex(BD_PHONE_RE, 'Enter a Bangladeshi mobile number (01XXXXXXXXX)'));
const optionalPhone = z.string().check(
  z.trim(),
  z.refine((v) => v === '' || BD_PHONE_RE.test(v), 'Enter 01XXXXXXXXX or leave it empty'),
);
const nickname = z.string().check(
  z.trim(),
  z.maxLength(30, 'Keep the nickname to 30 characters'),
  z.refine((v) => v === '' || NICKNAME_RE.test(v), 'Letters only (spaces, dots, hyphens fine)'),
);
const rollNo = z
  .string()
  .check(z.refine((v) => /^\d{1,3}$/.test(v) && Number(v) >= 1, 'A roll number from 1 to 999'));

export const guardianSchema = z.object({
  name,
  relation: required('Choose the relation'),
  phone,
  email: optionalEmail,
  address: z.string().check(z.trim(), z.maxLength(300, 'Keep it under 300 characters')),
});

/** The four steps of "New student", as one schema; fields per step drive "Next". */
export const studentSchema = z.object({
  name,
  username,
  email: optionalEmail,
  password: passwordPolicy,
  profile: z.object({
    nickname,
    dateOfBirth: required('Choose the date of birth'),
    gender: z.string(),
    classId: required('Choose a class'),
    sectionId: required('Choose a section'),
    rollNo,
    admissionDate: z.string(),
    guardian: guardianSchema,
  }),
});

export const STUDENT_STEPS = [
  {
    id: 'child',
    title: 'The child',
    fields: ['name', 'profile.nickname', 'profile.dateOfBirth', 'profile.gender'],
  },
  {
    id: 'placement',
    title: 'Class and roll',
    fields: ['profile.classId', 'profile.sectionId', 'profile.rollNo', 'profile.admissionDate'],
  },
  {
    id: 'guardian',
    title: 'Guardian',
    fields: [
      'profile.guardian.name',
      'profile.guardian.relation',
      'profile.guardian.phone',
      'profile.guardian.email',
      'profile.guardian.address',
    ],
  },
  { id: 'login', title: 'Login', fields: ['username', 'email', 'password'] },
];

/** Which step a (server) error field belongs to, so the form can jump back to it. */
export const stepOfField = (field) =>
  Math.max(
    0,
    STUDENT_STEPS.findIndex((step) =>
      step.fields.some((f) => field === f || field.startsWith(`${f}.`)),
    ),
  );

export const teacherSchema = z.object({
  name,
  username,
  email: optionalEmail,
  phone: optionalPhone,
  password: passwordPolicy,
  profile: z.object({
    employeeId: z
      .string()
      .check(z.trim(), z.minLength(1, 'Enter the employee ID'), z.maxLength(20, 'Too long')),
    qualification: z.string().check(z.trim(), z.maxLength(200, 'Too long')),
    joiningDate: z.string(),
  }),
});

export const adminSchema = z.object({
  name,
  username,
  email: optionalEmail,
  phone: optionalPhone,
  password: passwordPolicy,
});

export const resetPasswordSchema = z.object({ newPassword: passwordPolicy });

// Seeded class codes; other classes use their name (e.g. "Class One" → "classone").
const CLASS_CODES = { Playgroup: 'pg', Nursery: 'nur', 'KG-1': 'kg1', 'KG-2': 'kg2' };

/** "kg2-b-06": the pattern the school uses for children's usernames. */
export function suggestStudentUsername(className, sectionName, rollNo) {
  if (!className || !sectionName || !rollNo) return '';
  const code =
    CLASS_CODES[className] ??
    className
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 10);
  const section = sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${code}-${section}-${String(rollNo).padStart(2, '0')}`;
}

/** Editing an account: the same fields without the password (reset is separate). */
export const editSchemas = {
  student: z.omit(studentSchema, { password: true }),
  teacher: z.omit(teacherSchema, { password: true }),
  admin: z.omit(adminSchema, { password: true }),
};
