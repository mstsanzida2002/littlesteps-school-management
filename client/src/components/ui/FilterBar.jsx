import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

import { useIsDesktop } from '../../hooks/useMediaQuery.js';
import { cn } from '../../utils/cn.js';
import { Button } from './Button.jsx';
import { Drawer } from './Drawer.jsx';

/**
 * Search plus filters. Wide screens: everything in one row. Phones: search and a
 * "Filters (n)" button that opens the filters in a bottom sheet.
 *
 *   <FilterBar search={<SearchInput … />} activeCount={2} onReset={reset}>
 *     <Select … /> <DatePicker … />
 *   </FilterBar>
 */
export function FilterBar({
  search,
  activeCount = 0,
  onReset,
  label = 'Filters',
  className,
  children,
}) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);

  if (desktop) {
    return (
      <div
        role="search"
        aria-label={label}
        className={cn('flex flex-wrap items-end gap-3', className)}
      >
        {search && <div className="min-w-60 flex-1">{search}</div>}
        {children}
        {onReset && activeCount > 0 && (
          <Button variant="ghost" icon={RotateCcw} onClick={onReset}>
            Reset
          </Button>
        )}
      </div>
    );
  }

  return (
    <div role="search" aria-label={label} className={cn('flex items-center gap-2', className)}>
      {search && <div className="min-w-0 flex-1">{search}</div>}
      {children && (
        <Button
          variant="secondary"
          icon={SlidersHorizontal}
          onClick={() => setOpen(true)}
          aria-label={activeCount ? `${label}, ${activeCount} active` : label}
        >
          <span className={search ? 'sr-only sm:not-sr-only' : undefined}>{label}</span>
          {activeCount > 0 && (
            <span className="min-w-6 rounded-full bg-brand-800 px-1.5 text-center text-xs leading-6 text-white">
              {activeCount}
            </span>
          )}
        </Button>
      )}
      <Drawer
        side="bottom"
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <>
            {onReset && (
              <Button
                variant="secondary"
                icon={RotateCcw}
                onClick={onReset}
                disabled={!activeCount}
              >
                Reset
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>Show results</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">{children}</div>
      </Drawer>
    </div>
  );
}
