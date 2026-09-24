/**
 * Guardian-side result pieces: the result itself (grade, marks, or "Absent" / "Excused" — never
 * 0), the teacher's remarks, and the "What do the grades mean?" sheet built from the test's own
 * saved scale. Only the child's own result is ever shown: no averages, ranks or other children.
 */
import { Check, ChevronRight, CircleHelp, MessageSquareQuote } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { studentPaths } from '../../../config/paths.js';
import { cn } from '../../../utils/cn.js';
import { formatNumber, formatPercent } from '../../../utils/format.js';
import { scaleRows, testMeta } from '../guardianFormat.js';
import { text } from '../text/index.js';

const BANGLA = /[ঀ-৿]/;

/** The headline: a big grade and "18 out of 20", or an Absent / Excused badge. */
export function ResultFigure({ result, size = 'md' }) {
  const { assessment } = result;
  if (result.attendance !== 'present') {
    return (
      <StatusBadge
        group="attendance"
        value={result.attendance}
        label={text[result.attendance] ?? result.attendance}
      />
    );
  }
  const big = size === 'lg';
  return (
    <div className={cn('flex items-baseline gap-3', big && 'gap-4')}>
      {result.grade && (
        <p className="leading-none">
          <span className="sr-only">{text.grade}: </span>
          <span className={cn('font-extrabold text-brand-800', big ? 'text-5xl' : 'text-3xl')}>
            {result.grade}
          </span>
        </p>
      )}
      {assessment.mode === 'marks' && result.marksObtained != null && (
        <p className={cn('font-semibold text-ink', big && 'text-lg')}>
          {text.marks(formatNumber(result.marksObtained), formatNumber(assessment.totalMarks))}
          {result.percent != null && (
            <span className="ml-1.5 text-muted">({formatPercent(result.percent)})</span>
          )}
        </p>
      )}
    </div>
  );
}

/** The teacher's remarks, shown prominently as a quote. */
export function Remarks({ remarks, className }) {
  if (!remarks) return null;
  return (
    <figure
      className={cn(
        'flex gap-3 rounded-control border-l-4 border-citron-500 bg-citron-50 p-3',
        className,
      )}
    >
      <MessageSquareQuote aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-citron-700" />
      <div className="min-w-0">
        <figcaption className="text-xs font-bold tracking-wide text-citron-700 uppercase">
          {text.remarksLabel}
        </figcaption>
        <blockquote lang={BANGLA.test(remarks) ? 'bn' : undefined} className="mt-0.5 text-ink">
          {remarks}
        </blockquote>
      </div>
    </figure>
  );
}

/** "What do the grades mean?" — the test's own saved scale (not today's school scale). */
export function GradeScaleButton({ result, className }) {
  const [open, setOpen] = useState(false);
  const scale = result.assessment.gradingScale;
  if (!scale?.length || result.assessment.mode === 'remarks') return null;
  const t = text.scale;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={CircleHelp}
        onClick={() => setOpen(true)}
        className={className}
      >
        {t.open}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.title}
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {t.close}
          </Button>
        }
      >
        <p className="text-muted">{result.assessment.mode === 'grade' ? t.gradeOnly : t.intro}</p>
        <table className="mt-4 w-full text-left">
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              <th scope="col" className="py-2 font-semibold">
                {t.columns.grade}
              </th>
              <th scope="col" className="py-2 font-semibold">
                {t.columns.range}
              </th>
            </tr>
          </thead>
          <tbody>
            {scaleRows(scale).map((row) => {
              const mine = row.grade === result.grade;
              return (
                <tr
                  key={row.grade}
                  aria-current={mine ? 'true' : undefined}
                  className={cn('border-b border-line', mine && 'bg-brand-50 font-bold')}
                >
                  <td className="py-2 pr-4 text-lg font-bold text-brand-800">{row.grade}</td>
                  <td className="py-2 tabular-nums">
                    {t.range(row.min, row.max)}
                    {mine && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-800 px-2 py-0.5 text-xs font-bold text-white">
                        <Check aria-hidden="true" className="size-3" />
                        {t.thisTest}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Modal>
    </>
  );
}

/**
 * One test in a list: subject, test name, the result and the remarks, linking to the test page.
 * `compact` (home page) clamps the remarks to two lines.
 */
export function ResultCard({ result, showSubject = true, compact = false }) {
  return (
    <li>
      <Link
        to={studentPaths.result(result.assessment._id)}
        className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand-300"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {showSubject && (
              <p className="text-sm font-bold tracking-wide text-brand-700 uppercase">
                {result.subject}
              </p>
            )}
            <h3 className="font-bold text-ink">{result.assessment.name}</h3>
            <p className="text-sm text-muted">{testMeta(result)}</p>
          </div>
          <ChevronRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-sand-400" />
        </div>
        <ResultFigure result={result} />
        {result.remarks && (
          <Remarks
            remarks={result.remarks}
            className={compact ? '[&_blockquote]:line-clamp-2' : undefined}
          />
        )}
      </Link>
    </li>
  );
}
