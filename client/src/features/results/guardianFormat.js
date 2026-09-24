/** Plain helpers for the guardian's result screens. */
import { formatSchoolDate } from '../../utils/date.js';
import { text } from './text/index.js';

/** "Class test · Wed, 23 Sep" */
export function testMeta(result) {
  const { assessment } = result;
  const type = text.testTypes[assessment.type] ?? text.testTypes.other;
  return `${type} · ${formatSchoolDate(assessment.date, { weekday: true, year: false })}`;
}

/** Bands highest first with the upper bound taken from the band above. */
export function scaleRows(scale = []) {
  const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent);
  return sorted.map((band, i) => ({
    grade: band.grade,
    min: band.minPercent,
    max: i === 0 ? null : sorted[i - 1].minPercent,
  }));
}
