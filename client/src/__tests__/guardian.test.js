import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { countDays, guardianDayStatus, monthDays } from '../features/attendance/guardianDays.js';
import {
  forgetAccount,
  MAX_REMEMBERED,
  rememberAccount,
  rememberedAccounts,
} from '../lib/rememberedAccounts.js';
import { addMonthsToKey, formatMonth, isMonthKey, monthBounds } from '../utils/date.js';
import { buildIcs, icsEscape, icsFileName, icsFold, icsUtc } from '../utils/ics.js';
import { childName, firstNameOf } from '../utils/names.js';

describe('child names', () => {
  it.each([
    ['Ayaan Rahman', 'Ayaan'],
    ['Md. Arham Hossain', 'Arham'],
    ['MD Rafiq Islam', 'Rafiq'],
    ['Mohammad Saad', 'Saad'],
    ['Mst. Sadia Afrin', 'Sadia'],
    ['মোঃ আরহাম হোসেন', 'আরহাম'],
    ['  Nusrat   Jahan ', 'Nusrat'],
    ['Oishi', 'Oishi'],
    ['Md.', 'Md.'],
    ['', ''],
    [undefined, ''],
  ])('firstNameOf(%j) → %j', (name, expected) => {
    expect(firstNameOf(name)).toBe(expected);
  });

  it('prefers the nickname, falling back to the first name', () => {
    expect(childName({ name: 'Tasnim Ara Oishi', nickname: 'Oishi' })).toBe('Oishi');
    expect(childName({ name: 'Tasnim Ara Oishi', nickname: '  ' })).toBe('Tasnim');
    expect(childName({ name: 'Md. Arham Hossain', nickname: null })).toBe('Arham');
    expect(childName(null)).toBe('');
  });
});

describe('months', () => {
  it('moves across years and knows month lengths', () => {
    expect(addMonthsToKey('2026-12', 1)).toBe('2027-01');
    expect(addMonthsToKey('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToKey('2026-09', -21)).toBe('2024-12');
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthBounds('2028-02').to).toBe('2028-02-29');
    expect(monthBounds('2026-09').to).toBe('2026-09-30');
  });

  it('validates and formats month keys', () => {
    expect(isMonthKey('2026-09')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-9')).toBe(false);
    expect(formatMonth('2026-09')).toBe('September 2026');
    expect(formatMonth('2026-09', { short: true })).toBe('Sep');
  });
});

describe('guardian calendar days', () => {
  const r = (status) => ({ status });
  it('combines a day of subject records into one status', () => {
    expect(guardianDayStatus([])).toBeNull();
    expect(guardianDayStatus([r('present'), r('present')])).toBe('present');
    expect(guardianDayStatus([r('present'), r('late')])).toBe('late');
    expect(guardianDayStatus([r('absent'), r('absent')])).toBe('absent');
    expect(guardianDayStatus([r('absent'), r('present')])).toBe('partial');
    expect(guardianDayStatus([r('absent'), r('late')])).toBe('partial');
  });

  it('marks off days, days with no classes, and days not to show', () => {
    // September 2026: the 4th is a Friday, the 5th a Saturday; today is Thu 24 Sep.
    const history = [
      { date: '2026-09-23', subject: 'English', status: 'absent' },
      { date: '2026-09-23', subject: 'Math', status: 'present' },
      { date: '2026-09-22', subject: 'English', status: 'present' },
    ];
    const days = monthDays({
      month: '2026-09',
      history,
      offDays: ['friday', 'saturday'],
      today: '2026-09-24',
      from: '2026-09-02',
      to: '2026-12-31',
    });
    const status = (date) => days.find((d) => d.date === date).status;
    expect(days).toHaveLength(30);
    expect(status('2026-09-01')).toBeNull(); // before admission
    expect(status('2026-09-04')).toBe('off_day');
    expect(status('2026-09-21')).toBe('no_class');
    expect(status('2026-09-22')).toBe('present');
    expect(status('2026-09-23')).toBe('partial');
    expect(status('2026-09-24')).toBe('no_class'); // today, nothing recorded yet
    expect(status('2026-09-27')).toBeNull(); // future
    expect(status('2026-09-25')).toBe('off_day'); // a future off day still shows as off
    expect(days.find((d) => d.date === '2026-09-23').records).toHaveLength(2);
    expect(countDays(days)).toMatchObject({ present: 1, partial: 1 });
  });
});

describe('calendar file (.ics)', () => {
  it('writes the meeting time in UTC, so 4:30 pm in Dhaka is 10:30Z', () => {
    // 2026-09-26 16:30 Asia/Dhaka (UTC+6)
    const start = '2026-09-26T10:30:00.000Z';
    const ics = buildIcs({
      uid: 'm1@littlesteps',
      title: 'Parents, teachers; and you',
      start,
      durationMinutes: 45,
      location: 'KG-2 classroom',
      description: 'Line one\nLine two',
      now: new Date('2026-09-24T00:00:00Z'),
    });
    expect(ics).toContain('DTSTART:20260926T103000Z\r\n');
    expect(ics).toContain('DTEND:20260926T111500Z\r\n');
    expect(ics).toContain('SUMMARY:Parents\\, teachers\\; and you\r\n');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two\r\n');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('\r\n').every((line) => !line.includes('\n'))).toBe(true);
  });

  it('defaults to one hour and marks cancelled meetings', () => {
    const ics = buildIcs({ uid: 'x', title: 'T', start: '2026-09-26T04:00:00Z', cancelled: true });
    expect(ics).toContain('DTEND:20260926T050000Z');
    expect(ics).toContain('STATUS:CANCELLED');
  });

  it('escapes, folds long lines at 75 octets without splitting Bangla letters', () => {
    expect(icsEscape('a\\b')).toBe('a\\\\b');
    expect(icsUtc(new Date('2026-01-02T03:04:05Z'))).toBe('20260102T030405Z');
    const long = `SUMMARY:${'অভিভাবক সভা '.repeat(8)}`;
    const folded = icsFold(long);
    const lines = folded.split('\r\n');
    const encoder = new TextEncoder();
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((line) => line.startsWith(' '))).toBe(true);
    expect(lines.map((line, i) => (i ? line.slice(1) : line)).join('')).toBe(long);
  });

  it('names the file safely', () => {
    expect(icsFileName('KG-2 reading evening!')).toBe('kg-2-reading-evening.ics');
    expect(icsFileName('অভিভাবক সভা')).toBe('meeting.ics');
  });
});

describe('remembered accounts (this device)', () => {
  let store;
  beforeEach(() => {
    store = new Map();
    globalThis.window = {
      localStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      },
    };
  });
  afterEach(() => {
    delete globalThis.window;
  });

  it('keeps usernames and names only, most recent first, at most five', () => {
    rememberAccount({ username: 'pg-a-01', name: 'Ayaan' });
    rememberAccount({ username: 'KG1-A-03', name: 'Nafis' });
    rememberAccount({ username: 'pg-a-01', name: 'Ayaan' });
    expect(rememberedAccounts()).toEqual([
      { username: 'pg-a-01', name: 'Ayaan' },
      { username: 'kg1-a-03', name: 'Nafis' },
    ]);
    for (let i = 1; i <= 6; i += 1) rememberAccount({ username: `u${i}`, name: `C${i}` });
    expect(rememberedAccounts()).toHaveLength(MAX_REMEMBERED);
    const saved = JSON.parse(store.get('littlesteps.accounts'));
    for (const entry of saved) expect(Object.keys(entry).sort()).toEqual(['name', 'username']);
  });

  it('"remove from this device" clears both the name and the username', () => {
    rememberAccount({ username: 'pg-a-01', name: 'Ayaan' });
    forgetAccount('pg-a-01');
    expect(rememberedAccounts()).toEqual([]);
    expect(store.has('littlesteps.accounts')).toBe(false);
  });

  it('survives broken or blocked storage', () => {
    store.set('littlesteps.accounts', '{not json');
    expect(rememberedAccounts()).toEqual([]);
    store.set('littlesteps.accounts', JSON.stringify([{ username: 'ok', name: 'A' }, { x: 1 }]));
    expect(rememberedAccounts()).toEqual([{ username: 'ok', name: 'A' }]);
    globalThis.window.localStorage.setItem = () => {
      throw new Error('blocked');
    };
    expect(() => rememberAccount({ username: 'x', name: 'y' })).not.toThrow();
  });
});
