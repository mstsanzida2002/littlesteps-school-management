import { cn } from '../../utils/cn.js';

/** Placeholder block while data loads. Hidden from screen readers; mark the region aria-busy. */
export function Skeleton({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block animate-pulse rounded-md bg-sand-100 motion-reduce:animate-none',
        className,
      )}
    />
  );
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <span aria-hidden="true" className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </span>
  );
}

/** A card-shaped placeholder (stat cards, list cards). */
export function SkeletonCard({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card',
        className,
      )}
    >
      <Skeleton className="size-16 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-3.5 w-1/3" />
      </div>
    </div>
  );
}
