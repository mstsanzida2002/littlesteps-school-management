import mongoose from 'mongoose';

import { WEEKDAYS } from '../config/constants.js';
import { baseSchemaOptions } from './helpers/schemaTypes.js';

export const SETTINGS_KEY = 'global';

/** Standard Bangladesh grading scale (highest band first). */
export const DEFAULT_GRADING_SCALE = Object.freeze([
  { grade: 'A+', minPercent: 80, gpa: 5.0 },
  { grade: 'A', minPercent: 70, gpa: 4.0 },
  { grade: 'A-', minPercent: 60, gpa: 3.5 },
  { grade: 'B', minPercent: 50, gpa: 3.0 },
  { grade: 'C', minPercent: 40, gpa: 2.0 },
  { grade: 'D', minPercent: 33, gpa: 1.0 },
  { grade: 'F', minPercent: 0, gpa: 0 },
]);

const gradeBandSchema = new mongoose.Schema(
  {
    grade: { type: String, required: true, trim: true, maxlength: 5 },
    minPercent: { type: Number, required: true, min: 0, max: 100 },
    gpa: { type: Number, min: 0, max: 5 },
  },
  { _id: false },
);

/**
 * Thresholds, highest first: a band covers [minPercent, previous band's minPercent), the top band
 * up to 100. Strictly descending minPercent ending at 0 ⇒ 0–100 is covered with no gaps or
 * overlaps by construction. (validators/settings.validator.js gives detailed messages; this is
 * the backstop.)
 */
export function isValidScale(bands) {
  if (!bands.length) return false;
  const grades = new Set(bands.map((b) => b.grade.toUpperCase()));
  const descending = bands.every((b, i) => i === 0 || b.minPercent < bands[i - 1].minPercent);
  const gpaNonIncreasing = bands.every(
    (b, i) => i === 0 || b.gpa == null || bands[i - 1].gpa == null || b.gpa <= bands[i - 1].gpa,
  );
  return (
    grades.size === bands.length && descending && gpaNonIncreasing && bands.at(-1).minPercent === 0
  );
}

/** Add the (exclusive) upper bound of each band for display: A = 70 up to (not incl.) 80. */
export const withBandRanges = (bands) =>
  bands.map((band, i) => ({
    grade: band.grade,
    minPercent: band.minPercent,
    maxPercent: i === 0 ? 100 : bands[i - 1].minPercent,
    ...(band.gpa != null && { gpa: band.gpa }),
  }));

// Single document (key = 'global'). Always read it through Settings.get().
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: SETTINGS_KEY, enum: [SETTINGS_KEY], immutable: true },
    gradingScale: {
      type: [gradeBandSchema],
      default: () => DEFAULT_GRADING_SCALE.map((band) => ({ ...band })),
      validate: {
        validator: isValidScale,
        message: 'Grading scale needs unique grades, strictly descending minPercent, ending at 0',
      },
    },
    attendanceThreshold: { type: Number, default: 75, min: 0, max: 100 },
    lateCountsAsPresent: { type: Boolean, default: true },
    weeklyOffDays: {
      type: [{ type: String, enum: WEEKDAYS }],
      default: () => ['friday', 'saturday'],
    },
  },
  baseSchemaOptions,
);

settingsSchema.index({ key: 1 }, { unique: true });

/** Return the settings document, creating it with defaults on first use. */
settingsSchema.statics.get = function getSettings() {
  return this.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $setOnInsert: { key: SETTINGS_KEY } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
};

export const Settings = mongoose.model('Settings', settingsSchema);
