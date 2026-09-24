import { describe, expect, it } from 'vitest';

import { dayStatuses } from '../features/attendance/dayStatus.js';
import {
  buildEntries,
  isTouched,
  rowsFromAssessment,
  serverErrorsByStudent,
} from '../features/results/entryRows.js';

const assessment = {
  mode: 'marks',
  totalMarks: 20,
  students: [
    { studentId: 'a', result: { attendance: 'present', marksObtained: 18, grade: 'A+' } },
    { studentId: 'b', result: null },
    { studentId: 'c', result: null },
    { studentId: 'd', result: null },
  ],
};

describe('draft result entry', () => {
  it('starts from saved results, everyone else present and empty', () => {
    const rows = rowsFromAssessment(assessment);
    expect(rows.a).toMatchObject({ marks: '18', hasResult: true });
    expect(rows.b).toEqual({
      attendance: 'present',
      marks: '',
      grade: '',
      remarks: '',
      hasResult: false,
    });
    expect(isTouched(rows.b)).toBe(false);
  });

  it('sends only touched rows, with no marks for absent students, and flags bad marks', () => {
    const rows = rowsFromAssessment(assessment);
    rows.b = { ...rows.b, attendance: 'absent', marks: '7' };
    rows.c = { ...rows.c, marks: '25' };
    const { entries, invalid } = buildEntries(assessment, assessment.students, rows);
    expect(entries).toEqual([
      { studentId: 'a', attendance: 'present', remarks: '', marksObtained: 18 },
      { studentId: 'b', attendance: 'absent', remarks: '' },
    ]);
    expect(invalid).toEqual(['c']);
  });

  it('maps the API errors (entries.<i>.<field>) back to the students', () => {
    const entries = [{ studentId: 'a' }, { studentId: 'b' }];
    const error = {
      errors: [
        { field: 'entries.1.marksObtained', message: 'Marks cannot exceed 20' },
        { field: 'entries.0.remarks', message: 'Too long' },
        { field: 'students', message: 'unrelated' },
      ],
    };
    expect(serverErrorsByStudent(error, entries)).toEqual({
      a: { remarks: 'Too long' },
      b: { marks: 'Marks cannot exceed 20' },
    });
  });
});

describe('calendar day status', () => {
  it('shows a day as absent if any subject was, then late, then present', () => {
    expect(
      dayStatuses([
        { date: '2026-09-23', status: 'present' },
        { date: '2026-09-23', status: 'absent' },
        { date: '2026-09-22', status: 'late' },
        { date: '2026-09-22', status: 'present' },
        { date: '2026-09-21', status: 'present' },
      ]),
    ).toEqual([
      { date: '2026-09-21', status: 'present' },
      { date: '2026-09-22', status: 'late' },
      { date: '2026-09-23', status: 'absent' },
    ]);
  });
});
