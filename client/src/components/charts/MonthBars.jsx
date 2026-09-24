import { cn } from '../../utils/cn.js';
import { formatPercent } from '../../utils/format.js';
import { ChartFigure } from './ChartFigure.jsx';
import { summarizeComparison } from './summaries.js';

/**
 * Horizontal percentage bars (months, subjects…) drawn with plain HTML and CSS: no chart
 * library, so it is safe on pages that must load fast on slow phones (the guardian screens).
 * Each bar prints its value; bars below the threshold get a warning mark and the "below" tone,
 * and the threshold is drawn as a dashed line, so colour is never the only signal.
 *
 * items: [{ key, label, value: number | null }]
 * thresholdLabel: the legend for the dashed line (feature text modules pass their own words).
 * wideLabels: room for longer labels (subject names) instead of short month names.
 */
export function MonthBars({
  title,
  items,
  threshold,
  thresholdLabel = `${formatPercent(threshold)} expected`,
  wideLabels = false,
  summary,
  table,
  className,
}) {
  const known = items.filter((item) => item.value != null);
  const text = summary ?? summarizeComparison(items, { threshold });
  return (
    <ChartFigure
      title={title}
      summary={text}
      table={table}
      empty={!known.length}
      className={className}
    >
      <ul className="flex flex-col gap-2.5" aria-hidden="true">
        {items.map((item) => {
          const below = threshold != null && item.value != null && item.value < threshold;
          return (
            <li
              key={item.key ?? item.label}
              className={cn(
                'grid items-center gap-2',
                wideLabels ? 'grid-cols-[6.5rem_1fr_3.75rem]' : 'grid-cols-[4.5rem_1fr_3.75rem]',
              )}
            >
              <span className="truncate text-sm font-semibold text-sand-700">{item.label}</span>
              <span className="relative h-4 rounded-full bg-sand-100">
                {item.value != null && (
                  <span
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full',
                      below ? 'bg-absent' : 'bg-present',
                    )}
                    style={{ width: `${Math.max(2, Math.min(100, item.value))}%` }}
                  />
                )}
                {threshold != null && (
                  <span
                    className="absolute -inset-y-1 w-0 border-l-2 border-dashed border-sand-700"
                    style={{ left: `${threshold}%` }}
                  />
                )}
              </span>
              <span
                className={cn(
                  'text-right text-sm font-bold tabular-nums',
                  below ? 'text-absent-ink' : 'text-ink',
                )}
              >
                {below && '▾ '}
                {formatPercent(item.value)}
              </span>
            </li>
          );
        })}
      </ul>
      {threshold != null && (
        <p aria-hidden="true" className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span className="h-3 w-0 border-l-2 border-dashed border-sand-700" />
          {thresholdLabel}
        </p>
      )}
    </ChartFigure>
  );
}
