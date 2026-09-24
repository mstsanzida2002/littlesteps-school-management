import { ACCOUNT_STATUS, ROLES } from '../config/constants.js';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { recordAudit } from './audit.service.js';
import {
  invalidateUserSessions,
  issueSession,
  revokeRefreshToken,
  rotateRefreshToken,
} from './token.service.js';

export const INVALID_CREDENTIALS = 'Invalid username/email or password';

const STATUS_MESSAGES = {
  [ACCOUNT_STATUS.PENDING]: 'Your account is awaiting admin approval.',
  [ACCOUNT_STATUS.SUSPENDED]: 'Your account has been suspended. Please contact the school office.',
  [ACCOUNT_STATUS.REJECTED]:
    'Your registration was not approved. Please contact the school office for details.',
};

// Hash compared against when the identifier matches no user, so a missing account takes as
// long to reject as a wrong password (no timing oracle for valid usernames).
let dummyHashPromise;
const getDummyHash = () => (dummyHashPromise ??= hashPassword('littlesteps-timing-equalizer'));

/** POST /auth/login */
export async function login({ identifier, password }, meta) {
  const key = identifier.trim().toLowerCase();
  const user = await User.findOne({ $or: [{ username: key }, { email: key }] }).select(
    '+passwordHash',
  );

  const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !passwordOk) throw ApiError.unauthorized(INVALID_CREDENTIALS);

  // Only reveal account status once the password is proven correct.
  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw ApiError.forbidden(STATUS_MESSAGES[user.status] ?? 'Your account is not active.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const session = await issueSession(user, meta);
  return { user: user.toJSON(), ...session };
}

/** POST /auth/refresh */
export async function refresh(refreshToken, meta) {
  if (!refreshToken) {
    const error = ApiError.unauthorized('No active session');
    error.clearCookie = false;
    throw error;
  }
  const { user, ...session } = await rotateRefreshToken(refreshToken, meta);
  return { user: user.toJSON(), ...session };
}

/** POST /auth/logout */
export function logout(refreshToken) {
  return revokeRefreshToken(refreshToken, 'logout');
}

/** GET /auth/me */
export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  return user.toJSON();
}

/**
 * PATCH /auth/password: verify the current password, set the new one, end every session,
 * then start a fresh session for this device so the user stays signed in here.
 */
export async function changePassword(userId, { currentPassword, newPassword }, meta) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Account no longer exists');

  // 400, not 401: a wrong current password must not look like an expired session to the client.
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect', [
      { field: 'currentPassword', message: 'Current password is incorrect' },
    ]);
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw ApiError.badRequest('New password must be different from the current password', [
      { field: 'newPassword', message: 'Must be different from the current password' },
    ]);
  }

  const wasRequired = user.mustChangePassword;
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = false;
  await user.save();

  user.tokenVersion = await invalidateUserSessions(user._id, 'password_changed');
  await recordAudit({
    actorId: user._id,
    action: 'user.password_change',
    entityType: 'User',
    entityId: user._id,
    before: { mustChangePassword: wasRequired },
    after: { mustChangePassword: false, sessionsRevoked: true },
    meta,
  });
  const session = await issueSession(user, meta);
  return { user: user.toJSON(), ...session };
}

/** PATCH /users/:id/password (admin): the user must choose a new password at next sign-in. */
export async function adminResetPassword(adminId, targetUserId, newPassword, meta) {
  const passwordHash = await hashPassword(newPassword);
  const passwordChangedAt = new Date();
  const target = await User.findByIdAndUpdate(
    targetUserId,
    { $set: { passwordHash, passwordChangedAt, mustChangePassword: true } },
    { returnDocument: 'after' },
  );
  if (!target) throw ApiError.notFound('User not found');

  await invalidateUserSessions(target._id, 'admin_reset');
  // Never log the password or its hash (recordAudit strips them anyway).
  await recordAudit({
    actorId: adminId,
    action: 'user.password_reset',
    entityType: 'User',
    entityId: target._id,
    after: { passwordChangedAt, mustChangePassword: true, sessionsRevoked: true },
    meta,
  });
  return target.toJSON();
}

/** POST /auth/register: creates a Pending student account awaiting admin approval. */
export async function register(data, meta) {
  const { name, username, email, password, guardian, dateOfBirth, gender, requestedClassId, note } =
    data;

  const user = await User.create({
    name,
    username,
    email,
    phone: guardian.phone,
    passwordHash: await hashPassword(password),
    role: ROLES.STUDENT,
    status: ACCOUNT_STATUS.PENDING,
    registration: { guardian, dateOfBirth, gender, requestedClassId, note },
  });

  await recordAudit({
    actorId: user._id,
    action: 'user.register',
    entityType: 'User',
    entityId: user._id,
    after: { username: user.username, role: user.role, status: user.status },
    meta,
  });

  return { id: user._id, username: user.username, status: user.status };
}
