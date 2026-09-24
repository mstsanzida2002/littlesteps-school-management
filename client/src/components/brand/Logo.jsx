import { Link } from 'react-router';

import { cn } from '../../utils/cn.js';
import { LOGO_RATIO, logoSources } from './logoAssets.js';

/**
 * Full logo. `width` sets the width/height attributes, which reserve the space (no layout
 * shift) and are the rendered size unless the parent sets a width: the image fills its parent.
 * `sizes` defaults to the fixed width.
 */
export function Logo({ width = 140, sizes, priority = false, className }) {
  const height = Math.round(width * LOGO_RATIO);
  const imageSizes = sizes ?? `${width}px`;
  return (
    <picture className={cn('block', className)}>
      <source type="image/webp" srcSet={logoSources.webpSrcSet} sizes={imageSizes} />
      <img
        src={logoSources.fallback}
        srcSet={logoSources.pngSrcSet}
        sizes={imageSizes}
        width={width}
        height={height}
        alt="LittleSteps"
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        className="block h-auto w-full"
      />
    </picture>
  );
}

/** The footprint from the logo, flat. Decorative unless `title` is given. */
export function LogoMark({ size = 32, title, className }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <g transform="rotate(-18 32 34) translate(0 -2.5)">
        <path
          fill="#e23260"
          d="M31 22c8.5-2.2 16.5 1.8 16.5 9.3 0 6.2-5.3 8.6-8.2 13.2-2.6 4.1-4.6 10.5-11 10.5-6.2 0-8.8-6.3-8.3-12.6.7-9.1 3.4-18.1 11-20.4z"
        />
        <path
          fill="#f2678e"
          d="M28.2 27.5c2.6-2.3 6.4-2.8 8.4-1.6 1 .6.6 1.8-.6 2-3 .5-5.3 2-6.7 4.3-.8 1.3-2.4 1-2.4-.4 0-1.6.4-3.2 1.3-4.3z"
        />
        <circle fill="#e23260" cx="23.6" cy="15.6" r="3.3" />
        <circle fill="#e23260" cx="31" cy="12" r="3.6" />
        <circle fill="#e23260" cx="39" cy="12.2" r="3.9" />
        <circle fill="#e23260" cx="46.4" cy="16.4" r="4.4" />
      </g>
    </svg>
  );
}

/**
 * The logo (or mark) as a link home: the user's dashboard when signed in, otherwise the login
 * page. The link's accessible name is "LittleSteps".
 */
export function LogoLink({ to, variant = 'full', width, markSize = 36, className, ...props }) {
  return (
    <Link
      to={to}
      className={cn(
        'rounded-control',
        variant === 'mark' ? 'inline-grid shrink-0 place-items-center' : 'inline-block',
        className,
      )}
      aria-label={variant === 'mark' ? 'LittleSteps' : undefined}
    >
      {variant === 'mark' ? <LogoMark size={markSize} /> : <Logo width={width} {...props} />}
    </Link>
  );
}
