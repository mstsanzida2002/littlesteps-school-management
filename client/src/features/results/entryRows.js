/**
 * Draft result entry, as plain data: one row per student with the inputs as typed
 * ({ attendance, marks: string, grade, remarks, hasResult }), turned into the API's entries.
 */
import { parseMarks } from '../../utils/grading.js';

export const rowFromResult = (result) => ({
  attendance: result?.attendance ?? 'present',
  marks: result?.marksObtained != null ? String(result.marksObtained) : '',
  grade: result?.grade ?? '',
  remarks: result?.remarks ?? '',
  hasResult: Boolean(result),
});

export const rowsFromAssessment = (assessment) =>
  Object.fromEntries(assessment.students.map((s) => [s.studentId, rowFromResult(s.result)]));

/** Rows worth sending: anything typed, a non-present attendance, or an existing result. */
export const isTouched = (row) =>
  row.hasResult ||
  row.attendance !== 'present' ||
  row.marks.trim() !== '' ||
  row.grade !== '' ||
  row.remarks.trim() !== '';

/** Client-side check of one row → { marks?: message } */
export function rowErrors(assessment, row) {
  if (assessment.mode !== 'marks' || row.attendance !== 'present') return {};
  const { error } = parseMarks(row.marks, assessment.totalMarks);
  return error ? { marks: error } : {};
}

/**
 * → { entries, invalid: [studentId] } for PUT /results/:assessmentId. Absent/excused rows carry
 * no marks or grade (the API rejects them); remarks are sent trimmed.
 */
export function buildEntries(assessment, students, rows) {
  const entries = [];
  const invalid = [];
  for (const { studentId } of students) {
    const row = rows[studentId];
    if (!isTouched(row)) continue;
    if (Object.keys(rowErrors(assessment, row)).length) {
      invalid.push(studentId);
      continue;
    }
    const entry = { studentId, attendance: row.attendance, remarks: row.remarks.trim() };
    if (row.attendance === 'present') {
      if (assessment.mode === 'marks') entry.marksObtained = parseMarks(row.marks).value;
      if (assessment.mode === 'grade') entry.grade = row.grade || null;
    }
    entries.push(entry);
  }
  return { entries, invalid };
}

/**
 * The API reports entry errors as `entries.<index>.<field>`: map them back to the students.
 * → { [studentId]: { marks | grade | remarks | attendance: message } }
 */
export function serverErrorsByStudent(error, entries) {
  const byStudent = {};
  for (const item of error?.errors ?? []) {
    const match = /^entries\.(\d+)\.(\w+)/.exec(item.field ?? '');
    const entry = match && entries[Number(match[1])];
    if (!entry) continue;
    const field = match[2] === 'marksObtained' ? 'marks' : match[2];
    byStudent[entry.studentId] = { ...byStudent[entry.studentId], [field]: item.message };
  }
  return byStudent;
}
