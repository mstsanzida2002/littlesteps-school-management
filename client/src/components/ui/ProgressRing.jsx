import { cn } from '../../utils/cn.js';
import { formatPercent } from '../../utils/format.js';
import { TONE_STROKE } from './tones.js';

/**
 * Circular percentage (0–100). `value` null means "nothing recorded" and shows "—".
 * The ring is an image with a text label (`label`, e.g. "Attendance 95.5%"); the number inside is
 * visible text too, so colour is never the only signal.
 */
export function ProgressRing({
  value,
  size = 76,
  stroke = 8,
  tone = 'present',
  label,
  className,
  children,
}) {
  const pct = value == null ? 0 : Math.min(100, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const text = formatPercent(value);

  return (
    <div
      role="img"
      aria-label={label ?? (value == null ? 'No data yet' : text)}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-sand-100"
        />
        {value != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
            className={cn(
              TONE_STROKE[tone],
              'transition-[stroke-dashoffset] duration-700 ease-out',
            )}
          />
        )}
      </svg>
      <span aria-hidden="true" className="absolute text-sm font-bold tabular-nums text-ink">
        {children ?? text}
      </span>
    </div>
  );
}
