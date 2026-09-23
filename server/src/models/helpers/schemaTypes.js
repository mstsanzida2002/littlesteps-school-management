/**
 * Reusable schema field definitions and options shared by all models.
 */
import mongoose from 'mongoose';

import { isNormalizedSchoolDate, toSchoolDate } from '../../utils/date.js';

const { ObjectId } = mongoose.Schema.Types;

/** Bangladeshi mobile number: 01[3-9]XXXXXXXX, optional +88 / 88 prefix. */
export const BD_PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TIME_HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Required/optional ObjectId reference. */
export const ref = (model, { required = true, index = false } = {}) => ({
  type: ObjectId,
  ref: model,
  required,
  index,
});

/**
 * Calendar-date field (Asia/Dhaka), stored as UTC midnight.
 * The setter routes every assignment through utils/date.js, so callers can pass a
 * 'YYYY-MM-DD' key or a Date and always get a normalized school date. The validator
 * guards writes that bypass setters.
 */
export const schoolDate = ({ required = true, index = false } = {}) => ({
  type: Date,
  required,
  index,
  set: (value) => (value == null || value === '' ? undefined : toSchoolDate(value)),
  validate: {
    validator: (value) => value == null || isNormalizedSchoolDate(value),
    message: '{PATH} must be a calendar date stored as UTC midnight (use utils/date.js)',
  },
});

export const phone = ({ required = false } = {}) => ({
  type: String,
  trim: true,
  required,
  match: [BD_PHONE_RE, 'Invalid Bangladeshi mobile number'],
});

/** Optional email: '' / null / whitespace become undefined so partial unique indexes ignore them. */
export const optionalEmail = () => ({
  type: String,
  lowercase: true,
  trim: true,
  set: (value) => (value == null || String(value).trim() === '' ? undefined : value),
  match: [EMAIL_RE, 'Invalid email address'],
});

/** Strip internal fields from API output. */
const hideInternal = (_doc, ret) => {
  delete ret.__v;
  return ret;
};

export const baseSchemaOptions = {
  timestamps: true,
  toJSON: { transform: hideInternal },
  toObject: { transform: hideInternal },
};
