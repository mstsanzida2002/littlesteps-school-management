import { z } from 'zod';

import { WEEKDAYS } from '../config/constants.js';

const band = z.strictObject({
  grade: z.string().trim().min(1).max(5),
  minPercent: z.number().min(0).max(100),
  gpa: z.number().min(0).max(5).optional(),
});

/**
 * Grading scale as thresholds: each band covers [minPercent, next higher band's minPercent),
 * the top band up to 100. Accepts any order and returns it sorted highest-first.
 * Valid ⇔ unique grades, unique thresholds (no overlaps), a band starting at 0 (no gap at the
 * bottom), GPA never increasing as the grade falls.
 */
export const gradingScaleSchema = z
  .array(band)
  .min(2, 'A grading scale needs at least two grades')
  .max(15)
  .transform((bands) => [...bands].sort((a, b) => b.minPercent - a.minPercent))
  .superRefine((bands, ctx) => {
    const issue = (message, path = []) => ctx.addIssue({ code: 'custom', message, path });

    const grades = bands.map((b) => b.grade.toUpperCase());
    const duplicateGrade = grades.find((g, i) => grades.indexOf(g) !== i);
    if (duplicateGrade) issue(`Grade "${duplicateGrade}" appears more than once`);

    const overlap = bands.find((b, i) => i > 0 && b.minPercent === bands[i - 1].minPercent);
    if (overlap) {
      issue(`Two grades start at ${overlap.minPercent}% (overlap): each threshold must be unique`);
    }

    if (bands.at(-1).minPercent !== 0) {
      issue(
        `The lowest grade must start at 0% (currently ${bands.at(-1).minPercent}%), ` +
          'otherwise lower marks have no grade',
      );
    }

    const gpaRise = bands.find(
      (b, i) => i > 0 && b.gpa != null && bands[i - 1].gpa != null && b.gpa > bands[i - 1].gpa,
    );
    if (gpaRise) issue(`GPA for ${gpaRise.grade} is higher than for the grade above it`);
  });

export const updateSettingsSchema = z
  .strictObject({
    gradingScale: gradingScaleSchema.optional(),
    attendanceThreshold: z.number().min(0).max(100).optional(),
    lateCountsAsPresent: z.boolean().optional(),
    weeklyOffDays: z
      .array(z.enum(WEEKDAYS))
      .max(6, 'At least one day must be a school day')
      .refine((days) => new Set(days).size === days.length, 'Each day may appear only once')
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one setting to update');
