import { cn } from '../../utils/cn.js';
import { ProgressRing } from './ProgressRing.jsx';
import { SkeletonCard } from './Skeleton.jsx';
import { TONE_SOFT, TONE_TEXT } from './tones.js';

/**
 * A headline number. Either a `progress` ring (0–100, null = no data) or an `icon` chip.
 * `hint` is coloured by `tone`, and should say in words what the tone means
 * ("Below the 75% requirement"), so it never relies on colour.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'info',
  progress,
  progressLabel,
  loading = false,
  className,
}) {
  if (loading) return <SkeletonCard className={className} />;
  const hasRing = progress !== undefined;

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card',
        className,
      )}
    >
      {hasRing ? (
        <ProgressRing value={progress} tone={tone} label={progressLabel ?? label} />
      ) : (
        Icon && (
          <span
            className={cn(
              'grid size-12 shrink-0 place-items-center rounded-control',
              TONE_SOFT[tone],
            )}
          >
            <Icon aria-hidden="true" className="size-6" />
          </span>
        )
      )}
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl leading-tight font-bold tabular-nums text-ink">{value}</p>
        {hint && <p className={cn('mt-0.5 text-sm font-semibold', TONE_TEXT[tone])}>{hint}</p>}
      </div>
    </div>
  );
}
