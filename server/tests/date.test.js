import { describe, expect, it } from 'vitest';

import {
  addDays,
  atSchoolTime,
  daysBetween,
  formatSchoolDateLong,
  isValidDateKey,
  monthRange,
  schoolDateKeyOf,
  toDateKey,
  toSchoolDate,
  todaySchoolDate,
  weekdayOf,
} from '../src/utils/date.js';

describe('date utility (Asia/Dhaka, stored as UTC midnight)', () => {
  it('keeps a YYYY-MM-DD key as the same calendar date', () => {
    expect(toSchoolDate('2026-09-23').toISOString()).toBe('2026-09-23T00:00:00.000Z');
  });

  it('maps an instant to its Dhaka calendar date, not its UTC date', () => {
    // 20:30 UTC on the 22nd is 02:30 on the 23rd in Dhaka (UTC+6).
    const instant = new Date('2026-09-22T20:30:00.000Z');
    expect(schoolDateKeyOf(instant)).toBe('2026-09-23');
    expect(todaySchoolDate(instant).toISOString()).toBe('2026-09-23T00:00:00.000Z');
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-9-3')).toBe(false);
    expect(() => toSchoolDate('2026-02-30')).toThrow(RangeError);
  });

  it('round-trips, adds days and builds month ranges', () => {
    const d = toSchoolDate('2026-12-31');
    expect(toDateKey(d)).toBe('2026-12-31');
    expect(toDateKey(addDays(d, 1))).toBe('2027-01-01');

    const { start, end } = monthRange(2026, 2);
    expect(start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('converts a Dhaka wall-clock time on a school date to the real instant', () => {
    const day = toSchoolDate('2026-09-23');
    expect(atSchoolTime(day, '08:00').toISOString()).toBe('2026-09-23T02:00:00.000Z');
    expect(atSchoolTime(day, '05:30').toISOString()).toBe('2026-09-22T23:30:00.000Z');
    expect(() => atSchoolTime(day, '8am')).toThrow(RangeError);
  });

  it('counts days between school dates and formats them for messages', () => {
    const thu = toSchoolDate('2026-09-24');
    expect(daysBetween(toSchoolDate('2026-09-17'), thu)).toBe(7);
    expect(daysBetween(thu, toSchoolDate('2026-09-17'))).toBe(-7);
    expect(formatSchoolDateLong(thu)).toBe('Thu, 24 Sep 2026');
  });

  it('returns the weekday of a school date', () => {
    expect(weekdayOf(toSchoolDate('2026-09-25'))).toBe('friday');
    expect(weekdayOf(toSchoolDate('2026-09-27'))).toBe('sunday');
  });

  it('refuses non-normalized dates', () => {
    expect(() => toDateKey(new Date('2026-09-23T05:00:00.000Z'))).toThrow(RangeError);
  });
});
