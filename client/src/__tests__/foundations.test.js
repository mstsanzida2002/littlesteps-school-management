import { describe, expect, it } from 'vitest';

// The server's list of codes: the client must have a message for every one of them.
import { ERROR_CODES } from '../../../server/src/config/constants.js';
import { notificationLink, teacherPaths } from '../config/paths.js';
import { errorMessage, friendlyError, KNOWN_ERROR_CODES } from '../lib/errorMessages.js';
import { keysForDataChange, keysForNotification } from '../lib/realtimeInvalidation.js';
import { dayChipLabel, isOffDay, markableSchoolDays } from '../utils/schoolDays.js';

describe('error messages', () => {
  it('has a friendly message for every server error code', () => {
    expect([...KNOWN_ERROR_CODES].sort()).toEqual(Object.values(ERROR_CODES).sort());
  });

  it('prefers the code, then the status, and keeps specific server messages', () => {
    expect(friendlyError({ status: 409, code: 'ALREADY_MARKED', message: 'x' }).title).toBe(
      'Already taken',
    );
    expect(errorMessage({ status: 0, message: 'Network Error' })).toMatch(/internet connection/);
    expect(errorMessage({ status: 403, message: 'You are not assigned to Playgroup-A.' })).toBe(
      'You are not assigned to Playgroup-A.',
    );
    expect(
      errorMessage({
        status: 409,
        code: 'ROLL_NUMBER_TAKEN',
        message: 'Roll 6 is taken. Next: 7.',
      }),
    ).toBe('Roll 6 is taken. Next: 7.');
    expect(errorMessage({ status: 422, message: 'Validation failed' })).toBe(
      'Something went wrong. Please try again.',
    );
    expect(errorMessage({ status: 502 })).toMatch(/on our side/);
    // A failed login is a 401 too: keep "Invalid username/email or password".
    expect(errorMessage({ status: 401, message: 'Invalid username/email or password' })).toBe(
      'Invalid username/email or password',
    );
  });

  it('says an admin can change attendance beyond the backdate limit', () => {
    const message = errorMessage({
      status: 422,
      code: 'BACKDATE_LIMIT',
      details: { limitDays: 7 },
    });
    expect(message).toBe(
      'Teachers can change attendance for the last 7 days only. An administrator can make this change for you.',
    );
  });
});

describe('live updates', () => {
  it('refreshes the data a notification is about, and always the dashboards', () => {
    expect(keysForNotification({ type: 'absence' })).toEqual([['attendance'], ['dashboard']]);
    expect(keysForNotification({ type: 'result_published' })).toEqual([['results'], ['dashboard']]);
    expect(keysForNotification({ type: 'meeting_cancelled' })).toEqual([
      ['meetings'],
      ['dashboard'],
    ]);
    expect(keysForNotification({ type: 'something_new' })).toEqual([['dashboard']]);
  });

  it('refreshes the scope of a "data:changed" signal (and every dashboard)', () => {
    expect(keysForDataChange({ scope: 'attendance', classId: 'c', sectionId: 's' })).toEqual([
      ['attendance'],
      ['dashboard'],
    ]);
    expect(keysForDataChange({ scope: 'settings' })).toEqual([
      ['settings'],
      ['school'],
      ['dashboard'],
    ]);
    // Every server scope is known (server/src/realtime/dataChanged.js DATA_SCOPES).
    for (const scope of [
      'attendance',
      'results',
      'users',
      'registrations',
      'structure',
      'assignments',
      'settings',
      'meetings',
      'notices',
    ]) {
      expect(keysForDataChange({ scope }).length).toBeGreaterThan(1);
    }
    expect(keysForDataChange({ scope: 'unknown' })).toEqual([['dashboard']]);
  });
});

describe('notification links', () => {
  const meeting = { type: 'meeting_invite', data: { meetingId: 'm1' } };
  it('opens the related screen for the role', () => {
    expect(notificationLink(meeting, 'teacher')).toBe('/teacher/meetings/m1');
    expect(notificationLink(meeting, 'student')).toBe('/student/meetings/m1');
    expect(
      notificationLink({ type: 'notice', relatedEntity: { kind: 'Notice', id: 'n' } }, 'teacher'),
    ).toBe('/teacher/notices');
    expect(notificationLink({ type: 'absence' }, 'student')).toBe('/student/attendance');
    expect(notificationLink({ type: 'result_updated' }, 'student')).toBe('/student/results');
    // Guardians land on the exact day / test.
    expect(notificationLink({ type: 'absence', data: { date: '2026-09-23' } }, 'student')).toBe(
      '/student/attendance?month=2026-09&day=2026-09-23',
    );
    expect(
      notificationLink({ type: 'result_published', data: { assessmentId: 'a1' } }, 'student'),
    ).toBe('/student/results/a1');
    expect(
      notificationLink(
        { type: 'meeting_updated', data: { meetingId: 'm1', removed: true } },
        'student',
      ),
    ).toBe('/student/meetings');
    // "No longer invited": the meeting is not theirs to open any more.
    expect(
      notificationLink(
        { type: 'meeting_updated', data: { meetingId: 'm1', removed: true } },
        'teacher',
      ),
    ).toBe('/teacher/meetings');
  });

  it('builds screen URLs with only the given parameters', () => {
    expect(teacherPaths.takeAttendance({ classId: 'c', sectionId: 's' })).toBe(
      '/teacher/attendance?classId=c&sectionId=s',
    );
    expect(teacherPaths.takeAttendance()).toBe('/teacher/attendance');
  });
});

describe('school days for the attendance chips', () => {
  const rules = { backdateDays: 7, offDays: ['friday', 'saturday'] };

  it('lists today and earlier school days within the limit, skipping off days', () => {
    // Thursday 24 Sep 2026; 7 days back = Thursday 17 Sep. Fri/Sat 18–19 skipped.
    expect(markableSchoolDays({ today: '2026-09-24', ...rules })).toEqual([
      '2026-09-24',
      '2026-09-23',
      '2026-09-22',
      '2026-09-21',
      '2026-09-20',
      '2026-09-17',
    ]);
  });

  it('starts from the latest school day when today is an off day', () => {
    expect(markableSchoolDays({ today: '2026-09-26', ...rules })[0]).toBe('2026-09-24');
    expect(isOffDay('2026-09-25', rules.offDays)).toBe(true);
  });

  it('stops at the start of the session', () => {
    expect(
      markableSchoolDays({ today: '2026-01-04', ...rules, sessionStart: '2026-01-01' }),
    ).toEqual(['2026-01-04', '2026-01-01']);
  });

  it('labels chips "Today" and "Wed 23 Sep"', () => {
    expect(dayChipLabel('2026-09-24', '2026-09-24')).toBe('Today');
    expect(dayChipLabel('2026-09-23', '2026-09-24')).toBe('Wed 23 Sep');
  });
});
