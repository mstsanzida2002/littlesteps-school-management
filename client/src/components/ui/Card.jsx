import { useId } from 'react';

import { cn } from '../../utils/cn.js';

/**
 * Surface for grouped content. With `title`, renders a header (heading level `level`, default
 * h2) plus optional `description` and `actions`, and the section is named by its title (a
 * landmark screen-reader users can jump to).
 */
export function Card({
  as: Tag = 'section',
  title,
  description,
  actions,
  level = 2,
  padded = true,
  className,
  children,
  ...props
}) {
  const Heading = `h${level}`;
  const titleId = useId();
  return (
    <Tag
      aria-labelledby={title && !props['aria-label'] ? titleId : undefined}
      className={cn(
        'rounded-card border border-line bg-surface shadow-card',
        padded && 'p-4 sm:p-5',
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            {title && (
              <Heading id={titleId} className="text-lg leading-tight font-bold text-ink">
                {title}
              </Heading>
            )}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}
