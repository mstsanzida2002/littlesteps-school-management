/**
 * Grading (FR-TCH-10). Scales are thresholds, highest first: the grade is the first band whose
 * minPercent ≤ percent. Drafts are graded with the current Settings scale when saved; at publish
 * the scale is snapshotted onto the assessment and every non-overridden marks entry is regraded
 * with it. Published assessments only ever use their own snapshot.
 */
export const round1 = (n) => Math.round(n * 10) / 10;

export const percentOf = (marks, total) => round1((marks / total) * 100);

export function gradeFor(percent, scale) {
  const band = [...scale]
    .sort((a, b) => b.minPercent - a.minPercent)
    .find((b) => percent >= b.minPercent);
  return band?.grade;
}

export const scaleGrades = (scale) => scale.map((b) => b.grade);

/** Plain copy of a scale for storing on an assessment. */
export const snapshotScale = (scale) =>
  scale.map(({ grade, minPercent, gpa }) => ({ grade, minPercent, ...(gpa != null && { gpa }) }));
