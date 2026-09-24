/**
 * Static Tailwind classes per status tone (see config/statuses.js). Written out in full so
 * Tailwind can find them.
 */
export const TONE_SOFT = Object.freeze({
  present: 'bg-present-soft text-present-ink',
  absent: 'bg-absent-soft text-absent-ink',
  late: 'bg-late-soft text-late-ink',
  excused: 'bg-excused-soft text-excused-ink',
  neutral: 'bg-neutral-soft text-neutral-ink',
  info: 'bg-info-soft text-info-ink',
});

export const TONE_TEXT = Object.freeze({
  present: 'text-present-ink',
  absent: 'text-absent-ink',
  late: 'text-late-ink',
  excused: 'text-excused-ink',
  neutral: 'text-neutral-ink',
  info: 'text-info-ink',
});

/** SVG strokes (progress rings). Fills are graphics, so the lighter status colours are fine. */
export const TONE_STROKE = Object.freeze({
  present: 'stroke-present',
  absent: 'stroke-absent',
  late: 'stroke-late',
  excused: 'stroke-excused',
  neutral: 'stroke-neutral',
  info: 'stroke-info',
});

export const TONE_BORDER = Object.freeze({
  present: 'border-present',
  absent: 'border-absent',
  late: 'border-late',
  excused: 'border-excused',
  neutral: 'border-neutral',
  info: 'border-info',
});
