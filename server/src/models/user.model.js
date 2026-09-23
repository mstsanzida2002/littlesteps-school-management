import mongoose from 'mongoose';

import { ACCOUNT_STATUS, ROLES } from '../config/constants.js';
import { baseSchemaOptions, optionalEmail, phone, ref } from './helpers/schemaTypes.js';

export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Login identifier for everyone (FR-AUTH-01). Siblings may share a guardian email,
    // so username — not email — is the required unique key.
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [USERNAME_RE, 'Username must be 3–32 chars: a-z, 0-9, dot, underscore, hyphen'],
    },
    email: optionalEmail(),
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true },
    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.PENDING,
    },
    phone: phone(),
    profilePhoto: { type: String, trim: true },
    createdBy: ref('User', { required: false }),
    lastLoginAt: Date,
    passwordChangedAt: Date,
  },
  {
    ...baseSchemaOptions,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.index({ username: 1 }, { unique: true });
// Partial: only real strings are indexed, so users without an email never collide.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
userSchema.index({ role: 1, status: 1 });

export const User = mongoose.model('User', userSchema);
