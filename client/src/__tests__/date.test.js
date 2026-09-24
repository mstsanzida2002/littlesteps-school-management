import { describe, expect, it } from 'vitest';

import {
  addDaysToKey,
  eachDateKey,
  formatDateTime,
  formatSchoolDate,
  isDateKey,
  todayDateKey,
  weekdayOfKey,
} from '../utils/date.js';

describe('client date utils', () => {
  it('uses the Dhaka day for "today" (UTC+6)', () => {
    expect(todayDateKey(new Date('2026-09-23T17:59:59Z'))).toBe('2026-09-23');
    expect(todayDateKey(new Date('2026-09-23T18:00:00Z'))).toBe('2026-09-24');
  });

  it('formats school dates without shifting the day, with "Sep" (not "Sept")', () => {
    expect(formatSchoolDate('2026-09-24')).toBe('24 Sep 2026');
    expect(formatSchoolDate('2026-09-24T00:00:00.000Z', { weekday: true })).toBe(
      'Thu, 24 Sep 2026',
    );
    expect(formatSchoolDate('2026-09-24', { year: false })).toBe('24 Sep');
    expect(formatSchoolDate(null)).toBe('');
  });

  it('formats instants in Dhaka time', () => {
    expect(formatDateTime('2026-10-01T04:00:00Z')).toBe('1 Oct 2026, 10:00 am');
    expect(formatDateTime('2026-10-01T12:30:00Z', { weekday: true })).toBe(
      'Thu, 1 Oct 2026, 6:30 pm',
    );
  });

  it('does date-key arithmetic across months and years', () => {
    expect(addDaysToKey('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysToKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(eachDateKey('2026-09-29', '2026-10-02')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(weekdayOfKey('2026-09-24')).toBe(4);
  });

  it('validates date keys', () => {
    expect(isDateKey('2026-02-28')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('24/09/2026')).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });
});
