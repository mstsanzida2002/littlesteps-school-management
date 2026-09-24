/**
 * Client-side checks mirroring server/src/validators/auth.validator.js, so people see problems
 * before submitting. The server stays the authority: its 422 errors land on the same fields.
 *
 * Client schemas use `zod/mini` (tree-shakeable), which keeps the login page's JavaScript small
 * on slow mobile data; the full `zod` API is for the server.
 */
import * as z from 'zod/mini';

const PASSWORD_MAX_BYTES = 72;
const utf8Bytes = (value) => new TextEncoder().encode(value).length;

export const passwordPolicy = z.string().check(
  z.minLength(8, 'Password must be at least 8 characters'),
  z.refine(
    (value) => utf8Bytes(value) <= PASSWORD_MAX_BYTES,
    `Password is too long (max ${PASSWORD_MAX_BYTES} bytes; Bangla letters count as 3)`,
  ),
  z.refine((value) => /\p{L}/u.test(value), 'Password must contain a letter'),
  z.refine((value) => /\p{Nd}/u.test(value), 'Password must contain a number'),
);

// Presence only, like the server: login errors never reveal the policy.
export const loginSchema = z.object({
  identifier: z.string().check(z.trim(), z.minLength(1, 'Enter your username or email')),
  password: z.string().check(z.minLength(1, 'Enter your password')),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().check(z.minLength(1, 'Enter your current password')),
    newPassword: passwordPolicy,
    confirmPassword: z.string().check(z.minLength(1, 'Repeat the new password')),
  })
  .check(
    z.refine((values) => values.confirmPassword === values.newPassword, {
      path: ['confirmPassword'],
      message: 'The passwords do not match',
    }),
    z.refine((values) => values.newPassword !== values.currentPassword, {
      path: ['newPassword'],
      message: 'Choose a password different from the current one',
    }),
  );
