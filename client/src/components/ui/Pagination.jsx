import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../../utils/cn.js';
import { formatNumber } from '../../utils/format.js';
import { pageRange, pageWindow } from '../../utils/pagination.js';
import { buttonClasses } from './buttonStyles.js';

/**
 * Pagination for the API's meta ({ page, limit, total, totalPages }). Phones get
 * Previous / "Page 2 of 5" / Next; wider screens also get page numbers.
 */
export function Pagination({ meta, onPageChange, label = 'Pagination', className }) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages } = meta;
  const { from, to, total } = pageRange(meta);

  return (
    <nav
      aria-label={label}
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      <p className="text-sm text-muted">
        Showing {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <span className="px-2 text-sm font-semibold md:hidden" aria-current="page">
          Page {page} of {totalPages}
        </span>
        <ul className="hidden items-center gap-1 md:flex">
          {pageWindow(page, totalPages).map((p, i) =>
            p === 'gap' ? (
              <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-sand-500">
                …
              </li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                  aria-label={`Page ${p}`}
                  className={cn(
                    buttonClasses({ variant: p === page ? 'primary' : 'ghost', size: 'sm' }),
                    'min-w-9 px-2 tabular-nums',
                  )}
                >
                  {p}
                </button>
              </li>
            ),
          )}
        </ul>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
    </nav>
  );
}
