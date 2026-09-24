import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { ProgressRing } from '../../../components/ui/ProgressRing.jsx';
import { formatNumber, formatPercent } from '../../../utils/format.js';
import { text } from '../text/index.js';

/**
 * The guardian's attendance headline: a ring, one plain sentence ("Ayaan attended 82% of classes.
 * The school expects at least 75%.") and the present / absent / late counts. With nothing
 * recorded yet, a friendly sentence replaces "0%".
 *
 * attendance: { percent, present, absent, late, threshold, belowThreshold }
 */
export function AttendanceOverview({ name, attendance }) {
  const { percent, threshold, belowThreshold } = attendance;
  if (percent == null) {
    return <p className="text-muted">{text.noClassesYet(name)}</p>;
  }
  const tone = belowThreshold ? 'absent' : 'present';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <ProgressRing
          value={percent}
          size={92}
          stroke={9}
          tone={tone}
          label={`${text.title} ${formatPercent(percent)}`}
        />
        <p className="text-lg leading-snug font-semibold text-ink">
          {text.attended(name, formatPercent(percent), threshold)}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {['present', 'absent', 'late'].map((status) => (
          <div
            key={status}
            className="flex flex-col items-start gap-1 rounded-control bg-blush-50 p-2.5"
          >
            <dt>
              <StatusBadge
                group="attendance"
                value={status}
                size="sm"
                label={text.counts[status]}
              />
            </dt>
            <dd className="text-2xl font-bold tabular-nums">{formatNumber(attendance[status])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
