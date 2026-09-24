import { getStatus } from '../../config/statuses.js';
import { cn } from '../../utils/cn.js';
import { TONE_SOFT } from './tones.js';

const SIZES = {
  sm: 'gap-1 px-2 py-0.5 text-xs',
  md: 'gap-1.5 py-1 pr-2.5 pl-2 text-sm',
};

/** Pill label. Give it an icon whenever the tone carries meaning. */
export function Badge({ tone = 'neutral', icon: Icon, size = 'md', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold whitespace-nowrap',
        SIZES[size],
        TONE_SOFT[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" className="size-[1.1em] shrink-0" />}
      {children}
    </span>
  );
}

/**
 * A status from config/statuses.js, always icon + label:
 *   <StatusBadge group="attendance" value="late" />  <StatusBadge group="rsvp" value={null} />
 */
export function StatusBadge({ group, value, size, label, className }) {
  const status = getStatus(group, value);
  return (
    <Badge tone={status.tone} icon={status.icon} size={size} className={className}>
      {label ?? status.label}
    </Badge>
  );
}
