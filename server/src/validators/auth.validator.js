import { z } from 'zod';

import { GENDERS } from '../config/constants.js';
import { GUARDIAN_RELATIONS } from '../models/helpers/guardian.js';
import { BD_PHONE_RE } from '../models/helpers/schemaTypes.js';
import { USERNAME_RE } from '../models/user.model.js';
import { PASSWORD_MAX_BYTES } from '../utils/password.js';
import { dateKey, objectId } from './common.validator.js';

const utf8Bytes = (value) => Buffer.byteLength(value, 'utf8');

/**
 * Password policy (FR-AUTH-05/06): 8+ characters with a letter and a number, and at most
 * 72 bytes of UTF-8 because bcrypt ignores the rest (a Bangla letter is 3 bytes).
 * Letters and digits from any script count (\p{L}, \p{Nd}), so Bangla passwords work.
 */
export const passwordPolicy = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    (value) => utf8Bytes(value) <= PASSWORD_MAX_BYTES,
    `Password is too long (max ${PASSWORD_MAX_BYTES} bytes; Bangla letters count as 3)`,
  )
  .refine((value) => /\p{L}/u.test(value), 'Password must contain a letter')
  .refine((value) => /\p{Nd}/u.test(value), 'Password must contain a number');

// Login only checks presence: its errors must never reveal the policy or account details.
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your username or email').max(254),
  password: z.string().min(1, 'Enter your password').max(1024),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(1024),
  newPassword: passwordPolicy,
});

export const adminResetPasswordSchema = z.object({
  newPassword: passwordPolicy,
});

const optionalEmail = z
  .union([z.literal(''), z.email('Invalid email address').max(254)])
  .optional()
  .transform((value) => value || undefined);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_RE, 'Username must be 3–32 characters: a-z, 0-9, dot, underscore, hyphen'),
  email: optionalEmail,
  password: passwordPolicy,
  guardian: z.object({
    name: z.string().trim().min(2).max(100),
    relation: z.enum(GUARDIAN_RELATIONS),
    phone: z.string().trim().regex(BD_PHONE_RE, 'Enter a Bangladeshi mobile number (01XXXXXXXXX)'),
    email: optionalEmail,
    address: z.string().trim().max(300).optional(),
  }),
  dateOfBirth: dateKey.optional(),
  gender: z.enum(GENDERS).optional(),
  requestedClassId: objectId.optional(),
  note: z.string().trim().max(500).optional(),
});
