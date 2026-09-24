import { describe, expect, it } from 'vitest';

import { gradeFor, parseMarks, percentOf } from '../utils/grading.js';

const scale = [
  { grade: 'B', minPercent: 50 },
  { grade: 'A+', minPercent: 80 },
  { grade: 'F', minPercent: 0 },
  { grade: 'A', minPercent: 70 },
];

describe('grade preview (same rule as the server)', () => {
  it('uses the highest band whose threshold is reached, in any order', () => {
    expect(gradeFor(percentOf(18, 20), scale)).toBe('A+');
    expect(gradeFor(percentOf(14, 20), scale)).toBe('A');
    expect(gradeFor(69.9, scale)).toBe('B');
    expect(gradeFor(0, scale)).toBe('F');
  });

  it('parses marks inputs with the API rules', () => {
    expect(parseMarks('', 20)).toEqual({ value: null });
    expect(parseMarks('12.5', 20)).toEqual({ value: 12.5 });
    expect(parseMarks('21', 20).error).toBe('At most 20');
    expect(parseMarks('1.234', 20).error).toMatch(/2 decimals/);
    expect(parseMarks('-1', 20).error).toBeDefined();
  });
});
