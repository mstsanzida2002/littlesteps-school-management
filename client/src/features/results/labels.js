/** How assessment types and modes are named in the UI (server enums in models/assessment). */
export const ASSESSMENT_TYPES = Object.freeze([
  { value: 'class_test', label: 'Class test' },
  { value: 'mid_term', label: 'Mid-term' },
  { value: 'final', label: 'Final exam' },
  { value: 'other', label: 'Other' },
]);

export const ASSESSMENT_MODES = Object.freeze([
  {
    value: 'marks',
    label: 'Marks',
    description: 'Marks out of a total; the grade is worked out for you.',
  },
  { value: 'grade', label: 'Grade', description: 'Choose a grade for each student.' },
  { value: 'remarks', label: 'Remarks', description: 'Written feedback only, no marks or grade.' },
]);

export const typeLabel = (value) => ASSESSMENT_TYPES.find((t) => t.value === value)?.label ?? value;
export const modeLabel = (assessment) =>
  assessment.mode === 'marks'
    ? `Marks out of ${assessment.totalMarks}`
    : (ASSESSMENT_MODES.find((m) => m.value === assessment.mode)?.label ?? assessment.mode);

export const classSectionLabel = (assessment) =>
  `${assessment.classId?.name ?? ''}-${assessment.sectionId?.name ?? ''}`;
