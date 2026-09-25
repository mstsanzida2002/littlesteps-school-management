/**
 * The grading scale editor's rules, the same as the server's (validators/settings.validator.js):
 * thresholds (each grade covers [its minimum, the next grade's minimum)), unique grades, unique
 * minimums, the lowest grade at 0%, values 0–100, and GPA never rising as the grade falls.
 *
 * rows: [{ grade: string, minPercent: string|number, gpa: string|number|'' }] in the editor's
 * order (typing never reorders them).
 */
const toNumber = (v) => (v === '' || v == null ? null : Number(v));

/** Rows as numbers, highest minimum first, each with its upper bound (null = up to 100). */
export function scaleBands(rows) {
  const bands = rows
    .map((row, index) => ({
      index,
      grade: String(row.grade ?? '').trim(),
      min: toNumber(row.minPercent),
      gpa: toNumber(row.gpa),
    }))
    .filter((b) => b.min != null && !Number.isNaN(b.min))
    .sort((a, b) => b.min - a.min);
  return bands.map((band, i) => ({ ...band, max: i === 0 ? 100 : bands[i - 1].min }));
}

/** { rows: { [rowIndex]: message }, scale: [messages], valid } */
export function validateScale(rows) {
  const rowErrors = {};
  const scaleErrors = [];
  const rowError = (i, message) => {
    rowErrors[i] ??= message;
  };

  rows.forEach((row, i) => {
    const grade = String(row.grade ?? '').trim();
    const min = toNumber(row.minPercent);
    const gpa = toNumber(row.gpa);
    if (!grade) rowError(i, 'Enter a grade');
    else if (grade.length > 5) rowError(i, 'Keep grades to 5 characters');
    if (min == null || Number.isNaN(min)) rowError(i, 'Enter the lowest percentage');
    else if (min < 0 || min > 100) rowError(i, 'Use a percentage from 0 to 100');
    if (gpa != null && (Number.isNaN(gpa) || gpa < 0 || gpa > 5)) rowError(i, 'GPA is from 0 to 5');
  });
  if (rows.length < 2) scaleErrors.push('A grading scale needs at least two grades');

  const grades = rows.map((r) =>
    String(r.grade ?? '')
      .trim()
      .toUpperCase(),
  );
  grades.forEach((g, i) => {
    if (g && grades.indexOf(g) !== i) rowError(i, `Grade "${g}" appears more than once`);
  });
  const mins = rows.map((r) => toNumber(r.minPercent));
  mins.forEach((m, i) => {
    if (m != null && mins.indexOf(m) !== i) rowError(i, `Another grade already starts at ${m}%`);
  });

  const bands = scaleBands(rows);
  if (bands.length && bands.at(-1).min !== 0) {
    scaleErrors.push(
      `The lowest grade must start at 0% (now ${bands.at(-1).min}%), or lower marks get no grade`,
    );
  }
  bands.forEach((band, i) => {
    const above = bands[i - 1];
    if (i > 0 && band.gpa != null && above.gpa != null && band.gpa > above.gpa) {
      rowError(band.index, `GPA is higher than for ${above.grade || 'the grade above'}`);
    }
  });
  return {
    rows: rowErrors,
    scale: scaleErrors,
    valid: !Object.keys(rowErrors).length && !scaleErrors.length,
  };
}

/** Rows → the PATCH body (numbers; GPA only when given). */
export const scaleToBody = (rows) =>
  rows.map((r) => ({
    grade: String(r.grade).trim(),
    minPercent: Number(r.minPercent),
    ...(toNumber(r.gpa) != null && { gpa: Number(r.gpa) }),
  }));
