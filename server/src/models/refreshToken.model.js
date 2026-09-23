import mongoose from 'mongoose';

import { ref } from './helpers/schemaTypes.js';

export const REVOKE_REASONS = Object.freeze([
  'rotated',
  'logout',
  'reuse_detected',
  'password_changed',
  'admin_reset',
  'suspended',
  'session_invalid',
]);

// Opaque refresh tokens: only a SHA-256 hash is stored, never the token itself.
// A "family" is one login; every rotation stays in the same family so reuse of an old
// token can revoke the whole chain.
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: ref('User', { index: true }),
    tokenHash: { type: String, required: true },
    family: { type: String, required: true, index: true },
    // User.tokenVersion at issue time; a mismatch means the sessions were invalidated.
    tokenVersion: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    revokedReason: { type: String, enum: REVOKE_REASONS },
    ip: String,
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
// TTL: MongoDB deletes each document once expiresAt passes. Revoked tokens stay until then,
// which is what lets reuse detection recognise them.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
