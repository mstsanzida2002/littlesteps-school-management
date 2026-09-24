const percentFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const numberFormatter = new Intl.NumberFormat('en-US');

/** 95.5 → "95.5%", 100 → "100%", null → "—" (nothing recorded yet). */
export function formatPercent(value) {
  return value == null || Number.isNaN(value) ? '—' : `${percentFormatter.format(value)}%`;
}

/** 1234 → "1,234". */
export function formatNumber(value) {
  return value == null ? '—' : numberFormatter.format(value);
}

/** "1 student", "3 students". */
export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}
