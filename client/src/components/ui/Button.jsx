import { LoaderCircle } from 'lucide-react';

import { buttonClasses } from './buttonStyles.js';

/**
 * <Button variant="primary|secondary|ghost|danger|danger-ghost" size="sm|md|lg" loading icon={Save}>
 * While `loading`, the button is disabled, shows a spinner and keeps its label (aria-busy).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  type = 'button',
  disabled,
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="size-[1.15em] shrink-0 animate-spin" />
      ) : (
        Icon && <Icon className="size-[1.15em] shrink-0" />
      )}
      {children}
      {IconRight && !loading && <IconRight className="size-[1.15em] shrink-0" />}
    </button>
  );
}

/** Square 44px icon button. `label` is required: it is the accessible name and the tooltip. */
export function IconButton({ icon: Icon, label, variant = 'ghost', className, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={buttonClasses({ variant, size: 'icon', className })}
      {...props}
    >
      <Icon className="size-5" />
    </button>
  );
}
