/**
 * Grade preview while entering marks, with the same rule as server/src/services/grading.js:
 * a scale is thresholds, and the grade is the first band (highest first) whose minPercent ≤
 * percent. The server stays the authority: it stores the grade when the draft is saved.
 */
const round1 = (n) => Math.round(n * 10) / 10;

export const percentOf = (marks, total) => round1((marks / total) * 100);

export function gradeFor(percent, scale = []) {
  return [...scale].sort((a, b) => b.minPercent - a.minPercent).find((b) => percent >= b.minPercent)
    ?.grade;
}

/**
 * Parse a marks input: '' → null, otherwise a number, or an error message
 * (0…total, at most 2 decimals — the API's rules).
 */
export function parseMarks(text, total) {
  const value = String(text ?? '').trim();
  if (value === '') return { value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return { error: 'Use a number with at most 2 decimals' };
  const marks = Number(value);
  if (marks > total) return { error: `At most ${total}` };
  return { value: marks };
}
