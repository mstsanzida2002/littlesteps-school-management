import { cn } from '../../utils/cn.js';

/**
 * Frame for every chart: title, the chart (an image whose accessible name is the summary),
 * the summary as visible text, and the numbers in an expandable table. With `empty`, a quiet
 * placeholder replaces the chart (no empty axes).
 *
 * table: { columns: [header, …], rows: [[cell, …], …] }
 */
export function ChartFigure({ title, summary, table, empty = false, className, children }) {
  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      {title && <h3 className="font-bold text-ink">{title}</h3>}
      {empty ? (
        <div className="grid min-h-32 place-items-center rounded-control border-2 border-dashed border-line-strong px-4 text-center text-muted">
          {summary}
        </div>
      ) : (
        <>
          <div role="img" aria-label={`${title ? `${title}. ` : ''}${summary}`}>
            {children}
          </div>
          <figcaption className="text-sm text-muted">{summary}</figcaption>
        </>
      )}
      {table && !empty && (
        <details className="group text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-700 marker:text-sand-400 pointer-coarse:py-2">
            Show the numbers
          </summary>
          <div className="mt-2 max-h-72 overflow-auto rounded-control border border-line">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-blush-50">
                <tr>
                  {table.columns.map((column) => (
                    <th key={column} scope="col" className="px-3 py-2 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i} className="border-t border-line">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-1.5 tabular-nums">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
