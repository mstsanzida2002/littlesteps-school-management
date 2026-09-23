/**
 * Access tokens (JWT, jose, HS256) and refresh-token sessions (opaque, hashed, rotated).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';

import { ACCOUNT_STATUS } from '../config/constants.js';
import { env } from '../config/env.js';
import { RefreshToken, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

const ACCESS_KEY = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const JWT_ALG = 'HS256';
const JWT_TYP = 'at+jwt';
const JWT_ISSUER = 'littlesteps-api';
const JWT_AUDIENCE = 'littlesteps-client';

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * A token rotated less than this long ago is treated as a benign race (two tabs refreshing
 * together), not theft: the request fails but the family survives, and the client retries
 * with the newer cookie the browser now holds.
 */
export const ROTATION_GRACE_MS = 10_000;

// ---------------------------------------------------------------------------
// Access tokens

export function signAccessToken(user) {
  return new SignJWT({ role: user.role, tv: user.tokenVersion ?? 0 })
    .setProtectedHeader({ alg: JWT_ALG, typ: JWT_TYP })
    .setSubject(String(user._id))
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(ACCESS_KEY);
}

/** Verify an access token; throws ApiError(401) with a client-friendly message. */
export async function verifyAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, ACCESS_KEY, {
      algorithms: [JWT_ALG],
      typ: JWT_TYP,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) throw ApiError.unauthorized('Session expired');
    if (err instanceof joseErrors.JOSEError) throw ApiError.unauthorized('Invalid access token');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Refresh tokens

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/** Create a refresh token for a user. Omit `family` to start a new session (login). */
export async function issueRefreshToken(user, { family = randomUUID(), ip, userAgent } = {}) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(token),
    family,
    tokenVersion: user.tokenVersion ?? 0,
    expiresAt,
    ip,
    userAgent: userAgent?.slice(0, 300),
  });
  return { token, expiresAt };
}

/** Access + refresh tokens for a user (a new session unless `family` is given). */
export async function issueSession(user, meta = {}) {
  const [accessToken, refresh] = await Promise.all([
    signAccessToken(user),
    issueRefreshToken(user, meta),
  ]);
  return { accessToken, refreshToken: refresh.token, refreshExpiresAt: refresh.expiresAt };
}

/** 401 that also tells the controller whether the refresh cookie is definitely dead. */
function refreshError(message, { clearCookie }) {
  const error = ApiError.unauthorized(message);
  error.clearCookie = clearCookie;
  return error;
}

function revokeFamily(family, reason) {
  return RefreshToken.updateMany(
    { family, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

/**
 * Rotate a refresh token: atomically revoke it and issue the next one in the same family.
 * Returns { user, accessToken, refreshToken, refreshExpiresAt }.
 */
export async function rotateRefreshToken(token, meta = {}) {
  const tokenHash = hashToken(token);
  const now = new Date();

  // Atomic claim: only one request can rotate a given token.
  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, revokedReason: 'rotated' } },
    { returnDocument: 'before' },
  );

  if (!claimed) {
    const existing = await RefreshToken.findOne({ tokenHash });
    if (!existing) throw refreshError('Invalid session', { clearCookie: true });
    if (!existing.revokedAt) throw refreshError('Session expired', { clearCookie: true });

    const recentlyRotated =
      existing.revokedReason === 'rotated' &&
      now.getTime() - existing.revokedAt.getTime() < ROTATION_GRACE_MS;
    if (recentlyRotated) {
      // Another tab rotated this token a moment ago. Don't touch the cookie: the browser
      // may already hold that tab's newer token.
      throw refreshError('Session was refreshed in another tab', { clearCookie: false });
    }

    // A revoked token was presented again: assume theft and end the whole session chain.
    await revokeFamily(existing.family, 'reuse_detected');
    throw refreshError('Session is no longer valid. Please sign in again.', { clearCookie: true });
  }

  const user = await User.findById(claimed.userId);
  if (
    !user ||
    user.status !== ACCOUNT_STATUS.ACTIVE ||
    user.tokenVersion !== claimed.tokenVersion
  ) {
    await revokeFamily(claimed.family, 'session_invalid');
    throw refreshError('Session is no longer valid. Please sign in again.', { clearCookie: true });
  }

  const session = await issueSession(user, { ...meta, family: claimed.family });
  return { user, ...session };
}

/** Revoke one refresh token (logout). Unknown/already-revoked tokens are ignored. */
export async function revokeRefreshToken(token, reason = 'logout') {
  if (!token) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(token), revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

/**
 * End every session of a user immediately: bump tokenVersion (kills access tokens on their
 * next request) and revoke all refresh tokens. Use for password change/reset, suspension.
 * Returns the new tokenVersion.
 */
export async function invalidateUserSessions(userId, reason) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { tokenVersion: 1 } },
    { returnDocument: 'after', projection: { tokenVersion: 1 } },
  );
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
  return user?.tokenVersion;
}
