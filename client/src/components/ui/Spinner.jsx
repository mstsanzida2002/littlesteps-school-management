import { LoaderCircle } from 'lucide-react';

import { cn } from '../../utils/cn.js';

export function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-3 p-8', className)}>
      <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-cerise-500" />
      <span className="text-muted">{label}</span>
    </div>
  );
}
