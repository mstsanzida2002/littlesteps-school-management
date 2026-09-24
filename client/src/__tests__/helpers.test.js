import { describe, expect, it } from 'vitest';

import {
  summarizeCalendar,
  summarizeComparison,
  summarizeTrend,
} from '../components/charts/summaries.js';
import { activeNavItem } from '../components/layout/navMatch.js';
import { NAV_ITEMS, ROLES } from '../config/constants.js';
import { changePasswordSchema, loginSchema } from '../features/auth/schemas.js';
import { formatPercent } from '../utils/format.js';
import { initialsOf } from '../utils/initials.js';
import { pageRange, pageWindow } from '../utils/pagination.js';

describe('chart summaries', () => {
  it('summarises a trend, skipping days without records', () => {
    const text = summarizeTrend(
      [
        { date: '2026-09-21', value: 90 },
        { date: '2026-09-22', value: null },
        { date: '2026-09-23', value: 70 },
        { date: '2026-09-24', value: 95 },
      ],
      { threshold: 75 },
    );
    expect(text).toBe(
      'Average 85% over 3 school days. Lowest 70% on 23 Sep, latest 95% on 24 Sep. 1 day below 75%.',
    );
    expect(summarizeTrend([])).toBe('No records yet.');
  });

  it('summarises a comparison and names the groups below the threshold', () => {
    const items = [
      { label: 'KG-1', value: 96 },
      { label: 'Nursery', value: 70 },
      { label: 'Playgroup', value: null },
    ];
    expect(summarizeComparison(items, { threshold: 75 })).toBe(
      'Highest KG-1 (96%), lowest Nursery (70%). Below 75%: Nursery.',
    );
  });

  it('summarises a calendar', () => {
    const days = [
      { date: '2026-09-21', status: 'present' },
      { date: '2026-09-22', status: 'absent' },
      { date: '2026-09-23', status: 'late' },
      { date: '2026-09-24' },
    ];
    expect(summarizeCalendar(days)).toBe(
      '3 school days recorded: 1 present, 1 absent, 1 late. Last absence: 22 Sep.',
    );
  });
});

describe('small helpers', () => {
  it('formats percentages', () => {
    expect(formatPercent(95.5)).toBe('95.5%');
    expect(formatPercent(100)).toBe('100%');
    expect(formatPercent(66.666)).toBe('66.7%');
    expect(formatPercent(null)).toBe('—');
  });

  it('makes initials for English and Bangla names', () => {
    expect(initialsOf('Ayaan Rahman')).toBe('AR');
    expect(initialsOf('Farhana Akter Mim')).toBe('FM');
    expect(initialsOf('আয়ান রহমান')).toBe('আর');
    expect(initialsOf('')).toBe('?');
  });

  it('windows page numbers', () => {
    expect(pageWindow(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageRange({ page: 2, limit: 20, total: 33 })).toEqual({ from: 21, to: 33, total: 33 });
  });

  it('finds the active nav item (longest match, exact for dashboards)', () => {
    const items = NAV_ITEMS[ROLES.ADMIN];
    expect(activeNavItem(items, '/admin').label).toBe('Dashboard');
    expect(activeNavItem(items, '/admin/users/42').label).toBe('Users');
    expect(activeNavItem(items, '/admin/usersx')).toBeUndefined();
  });

  it('keeps at most four primary items per role for the bottom bar', () => {
    for (const items of Object.values(NAV_ITEMS)) {
      expect(items.filter((item) => item.primary).length).toBeLessThanOrEqual(4);
    }
  });
});

describe('auth schemas (mirror the server)', () => {
  const change = (newPassword) =>
    changePasswordSchema.safeParse({
      currentPassword: 'Old12345',
      newPassword,
      confirmPassword: newPassword,
    });

  it('login only checks presence', () => {
    expect(loginSchema.safeParse({ identifier: ' kg1-a-03 ', password: 'x' }).data).toEqual({
      identifier: 'kg1-a-03',
      password: 'x',
    });
    expect(loginSchema.safeParse({ identifier: '  ', password: '' }).success).toBe(false);
  });

  it('applies the password policy, including Bangla and the 72-byte limit', () => {
    expect(change('newpass12').success).toBe(true);
    expect(change('নতুনপাসওয়ার্ড১').success).toBe(true); // Bengali digit counts as a number
    expect(change('abcdefgh').success).toBe(false);
    expect(change(`${'অ'.repeat(24)}1`).success).toBe(false); // 73 bytes
    expect(change('Old12345').error.issues[0].path).toEqual(['newPassword']);
  });

  it('reports a mismatched confirmation on the confirmation field', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'Old12345',
      newPassword: 'newpass12',
      confirmPassword: 'newpass13',
    });
    expect(result.error.issues.map((i) => i.path.join('.'))).toEqual(['confirmPassword']);
  });
});
