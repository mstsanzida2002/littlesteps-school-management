import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useId } from 'react';

import { useIsDesktop } from '../../hooks/useMediaQuery.js';
import { cn } from '../../utils/cn.js';
import { Select } from './Select.jsx';
import { Skeleton } from './Skeleton.jsx';

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

const cellValue = (column, row) => (column.cell ? column.cell(row) : row[column.key]);

/** 'name' ↔ '-name' (the API's sort format). */
const parseSort = (sort) =>
  sort
    ? { field: sort.replace(/^-/, ''), desc: sort.startsWith('-') }
    : { field: null, desc: false };

/**
 * A table on wider screens and a list of cards on phones (same data, same columns).
 *
 * columns: [{
 *   key, header, cell?: (row) => node, align?: 'left'|'right'|'center',
 *   sortable?: boolean (sorts by `key`),
 *   mobile?: 'title' | 'subtitle' | 'field' (default) | 'actions' | 'hidden',
 * }]
 * `sort` / `onSortChange` use the API's format ('name' or '-name').
 */
export function DataTable({
  columns,
  rows,
  rowKey = '_id',
  caption,
  loading = false,
  skeletonRows = 5,
  empty,
  sort,
  onSortChange,
  className,
}) {
  const desktop = useIsDesktop();
  const keyOf = (row, i) => (typeof rowKey === 'function' ? rowKey(row) : (row[rowKey] ?? i));

  if (!loading && rows.length === 0 && empty) return empty;

  return desktop ? (
    <TableView
      {...{ columns, rows, keyOf, caption, loading, skeletonRows, sort, onSortChange, className }}
    />
  ) : (
    <CardList
      {...{ columns, rows, keyOf, caption, loading, skeletonRows, sort, onSortChange, className }}
    />
  );
}

function TableView({
  columns,
  rows,
  keyOf,
  caption,
  loading,
  skeletonRows,
  sort,
  onSortChange,
  className,
}) {
  const current = parseSort(sort);
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-card border border-line bg-surface shadow-card',
        className,
      )}
      aria-busy={loading || undefined}
    >
      <table className="w-full border-collapse text-left">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-blush-50 text-sm text-sand-700">
          <tr>
            {columns.map((column) => {
              const sorted = current.field === column.key;
              const ariaSort = sorted ? (current.desc ? 'descending' : 'ascending') : undefined;
              const SortIcon = sorted ? (current.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sortable ? (ariaSort ?? 'none') : undefined}
                  className={cn(
                    'border-b border-line px-4 py-2.5 font-semibold',
                    ALIGN[column.align ?? 'left'],
                  )}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSortChange(sorted && !current.desc ? `-${column.key}` : column.key)
                      }
                      className="-mx-2 inline-flex min-h-9 items-center gap-1.5 rounded-control px-2 hover:bg-blush-100"
                    >
                      {column.header}
                      <SortIcon
                        aria-hidden="true"
                        className={cn('size-4', !sorted && 'text-sand-400')}
                      />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={`skeleton-${i}`} className="border-b border-line last:border-0">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row, i) => (
                <tr
                  key={keyOf(row, i)}
                  className="border-b border-line last:border-0 hover:bg-blush-50/60"
                >
                  {columns.map((column) => (
                    <td key={column.key} className={cn('px-4 py-3', ALIGN[column.align ?? 'left'])}>
                      {cellValue(column, row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

function CardList({
  columns,
  rows,
  keyOf,
  caption,
  loading,
  skeletonRows,
  sort,
  onSortChange,
  className,
}) {
  const title = columns.find((c) => c.mobile === 'title') ?? columns[0];
  const subtitle = columns.find((c) => c.mobile === 'subtitle');
  const actions = columns.find((c) => c.mobile === 'actions');
  const fields = columns.filter(
    (c) => c !== title && c !== subtitle && c !== actions && c.mobile !== 'hidden',
  );
  const sortable = columns.filter((c) => c.sortable);
  const sortId = useId();

  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy={loading || undefined}>
      {sortable.length > 0 && onSortChange && (
        <div className="flex items-center justify-end gap-2">
          <label htmlFor={sortId} className="text-sm font-semibold text-sand-700">
            Sort by
          </label>
          <Select
            id={sortId}
            value={sort ?? ''}
            onChange={(event) => onSortChange(event.target.value)}
            className="w-auto min-w-44 text-sm"
            options={sortable.flatMap((c) => [
              { value: c.key, label: `${c.header} (ascending)` },
              { value: `-${c.key}`, label: `${c.header} (descending)` },
            ])}
          />
        </div>
      )}
      <ul aria-label={caption} className="flex flex-col gap-3">
        {loading
          ? Array.from({ length: skeletonRows }, (_, i) => (
              <li
                key={`skeleton-${i}`}
                className="rounded-card border border-line bg-surface p-4 shadow-card"
              >
                <Skeleton className="mb-3 h-5 w-1/2" />
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </li>
            ))
          : rows.map((row, i) => (
              <li
                key={keyOf(row, i)}
                className="rounded-card border border-line bg-surface p-4 shadow-card"
              >
                <div className="font-bold text-ink">{cellValue(title, row)}</div>
                {subtitle && <div className="text-sm text-muted">{cellValue(subtitle, row)}</div>}
                {fields.length > 0 && (
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    {fields.map((column) => (
                      <div key={column.key} className="contents">
                        <dt className="text-muted">{column.header}</dt>
                        <dd className="min-w-0 text-right font-medium text-ink">
                          {cellValue(column, row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {actions && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    {cellValue(actions, row)}
                  </div>
                )}
              </li>
            ))}
      </ul>
    </div>
  );
}
