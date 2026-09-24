import { useState } from 'react';

import { cn } from '../../utils/cn.js';
import { initialsOf } from '../../utils/initials.js';

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' };

// Tints from the palette; each pairs a soft background with AA text.
const TINTS = [
  'bg-blush-200 text-cerise-800',
  'bg-citron-100 text-citron-700',
  'bg-brand-100 text-brand-800',
  'bg-excused-soft text-excused-ink',
  'bg-late-soft text-late-ink',
];

const BANGLA = /[ঀ-৿]/;

function tintFor(name = '') {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

/**
 * Initials (or a photo). Decorative by default, because the name is shown next to it; pass
 * `label` when the avatar stands alone.
 */
export function Avatar({ name, src, size = 'md', label, className }) {
  const [broken, setBroken] = useState(false);
  const initials = initialsOf(name);
  const common = cn(
    'inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold',
    SIZES[size],
  );

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={label ?? ''}
        onError={() => setBroken(true)}
        className={cn(common, 'object-cover', className)}
      />
    );
  }
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      lang={BANGLA.test(initials) ? 'bn' : undefined}
      className={cn(common, tintFor(name), 'leading-none', className)}
    >
      {initials}
    </span>
  );
}
