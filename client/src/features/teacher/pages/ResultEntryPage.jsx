import { ArrowLeft, Pencil, Save, Send, TriangleAlert } from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Badge, StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button, IconButton } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { fieldClasses } from '../../../components/ui/fieldStyles.js';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { toast } from '../../../components/ui/toast.js';
import { UnsavedChangesDialog } from '../../../components/ui/UnsavedChangesDialog.jsx';
import { useIsDesktop } from '../../../hooks/useMediaQuery.js';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { errorMessage } from '../../../lib/errorMessages.js';
import { cn } from '../../../utils/cn.js';
import { formatSchoolDate } from '../../../utils/date.js';
import { plural } from '../../../utils/format.js';
import { gradeFor, parseMarks, percentOf } from '../../../utils/grading.js';
import { EditResultDialog } from '../../results/components/EditResultDialog.jsx';
import { RESULT_ATTENDANCE_OPTIONS } from '../../results/components/resultAttendance.js';
import {
  buildEntries,
  rowErrors,
  rowsFromAssessment,
  serverErrorsByStudent,
} from '../../results/entryRows.js';
import {
  useAssessment,
  usePublishAssessment,
  useSaveDraftResults,
} from '../../results/hooks/useResults.js';
import { classSectionLabel, modeLabel, typeLabel } from '../../results/labels.js';
import { useSchoolSettings } from '../../school/hooks/useSchool.js';
import { useRolePaths } from '../../school/hooks/useScope.js';

const TONE_SELECTED = {
  present: 'border-present-ink bg-present-soft text-present-ink',
  absent: 'border-absent-ink bg-absent-soft text-absent-ink',
  excused: 'border-excused-ink bg-excused-soft text-excused-ink',
};

/** Present / Absent / Excused for one student (native radios). */
function AttendanceToggle({ studentId, name, value, disabled, onChange, compact }) {
  return (
    <div role="radiogroup" aria-label={`${name}: attendance`} className="grid grid-cols-3 gap-1.5">
      {RESULT_ATTENDANCE_OPTIONS.map((option) => (
        <label
          key={option.value}
          title={option.label}
          className={cn(
            'flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-control border-2 px-1.5 text-sm font-semibold has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55',
            'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
            value === option.value
              ? TONE_SELECTED[option.value]
              : 'border-line-strong bg-surface text-sand-700 hover:border-sand-300',
          )}
        >
          <input
            type="radio"
            name={`attendance-${studentId}`}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(studentId, 'attendance', option.value)}
            className="sr-only"
          />
          <option.icon aria-hidden="true" className="size-4 shrink-0" />
          <span className={cn(compact && 'sr-only xl:not-sr-only')}>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function GradePreview({ assessment, row, scale }) {
  if (row.attendance !== 'present')
    return <StatusBadge group="attendance" value={row.attendance} size="sm" />;
  const parsed = parseMarks(row.marks, assessment.totalMarks);
  if (parsed.value == null || parsed.error) return <span className="text-sand-400">—</span>;
  const percent = percentOf(parsed.value, assessment.totalMarks);
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-lg font-bold text-brand-800">{gradeFor(percent, scale) ?? '—'}</span>
      <span className="text-xs text-muted tabular-nums">{percent}%</span>
    </span>
  );
}

/**
 * One student's inputs. `layout`: 'row' (desktop grid) or 'card' (phones). Inputs carry
 * data-row / data-col so the grid can move between cells with the keyboard.
 */
const StudentEntry = memo(function StudentEntry({
  index,
  student,
  row,
  assessment,
  scale,
  errors,
  missing,
  disabled,
  onChange,
  layout,
}) {
  const present = row.attendance === 'present';
  const markError = errors?.marks;
  const cellInput = (col, props) => ({
    'data-row': index,
    'data-col': col,
    disabled: disabled || !present,
    ...props,
  });
  const labelFor = (what) => `${student.name}: ${what}`;

  const marksInput = assessment.mode === 'marks' && (
    <div className="flex items-center gap-2">
      <input
        {...cellInput('marks')}
        inputMode="decimal"
        aria-label={labelFor(`marks out of ${assessment.totalMarks}`)}
        aria-invalid={markError ? true : undefined}
        value={present ? row.marks : ''}
        placeholder={present ? '' : '—'}
        onChange={(event) => onChange(student.studentId, 'marks', event.target.value)}
        className={fieldClasses(Boolean(markError), 'w-24 text-right tabular-nums')}
      />
      <span className="text-sm whitespace-nowrap text-muted">/ {assessment.totalMarks}</span>
    </div>
  );
  const gradeInput = assessment.mode === 'grade' && (
    <select
      {...cellInput('grade')}
      aria-label={labelFor('grade')}
      aria-invalid={errors?.grade ? true : undefined}
      value={present ? row.grade : ''}
      onChange={(event) => onChange(student.studentId, 'grade', event.target.value)}
      className={fieldClasses(Boolean(errors?.grade), 'w-28')}
    >
      <option value="">{present ? 'Grade' : '—'}</option>
      {scale.map((band) => (
        <option key={band.grade} value={band.grade}>
          {band.grade}
        </option>
      ))}
    </select>
  );
  const remarksInput = (
    <input
      data-row={index}
      data-col="remarks"
      disabled={disabled}
      aria-label={labelFor('remarks')}
      aria-invalid={errors?.remarks ? true : undefined}
      value={row.remarks}
      placeholder={assessment.mode === 'remarks' && present ? 'Required' : 'Optional'}
      onChange={(event) => onChange(student.studentId, 'remarks', event.target.value)}
      className={fieldClasses(Boolean(errors?.remarks), 'min-w-0')}
    />
  );
  const problems = [missing, markError, errors?.grade, errors?.remarks, errors?.attendance].filter(
    Boolean,
  );
  const nameCell = (
    <div className="min-w-0">
      <p className="truncate font-semibold">{student.name}</p>
      <p className="text-sm text-muted">Roll {student.rollNo}</p>
    </div>
  );

  if (layout === 'row') {
    return (
      <tr
        id={`result-${student.studentId}`}
        className={cn('border-t border-line align-top', missing && 'bg-absent-soft/50')}
      >
        <td className="px-3 py-2.5">
          {nameCell}
          {problems.length > 0 && (
            <p className="mt-1 flex items-start gap-1 text-sm font-semibold text-absent-ink">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {problems.join(' · ')}
            </p>
          )}
        </td>
        <td className="px-3 py-2.5">
          <AttendanceToggle
            studentId={student.studentId}
            name={student.name}
            value={row.attendance}
            disabled={disabled}
            onChange={onChange}
            compact
          />
        </td>
        {assessment.mode !== 'remarks' && (
          <td className="px-3 py-2.5">{marksInput || gradeInput}</td>
        )}
        {assessment.mode === 'marks' && (
          <td className="px-3 py-2.5 pt-4">
            <GradePreview assessment={assessment} row={row} scale={scale} />
          </td>
        )}
        <td className="px-3 py-2.5">{remarksInput}</td>
      </tr>
    );
  }

  return (
    <li
      id={`result-${student.studentId}`}
      className={cn(
        'flex flex-col gap-3 rounded-card border bg-surface p-4 shadow-card',
        missing ? 'border-absent-ink bg-absent-soft/40' : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {nameCell}
        {assessment.mode === 'marks' && (
          <GradePreview assessment={assessment} row={row} scale={scale} />
        )}
      </div>
      {problems.length > 0 && (
        <p className="flex items-start gap-1 text-sm font-semibold text-absent-ink">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {problems.join(' · ')}
        </p>
      )}
      <AttendanceToggle
        studentId={student.studentId}
        name={student.name}
        value={row.attendance}
        disabled={disabled}
        onChange={onChange}
      />
      {(marksInput || gradeInput) && <div>{marksInput || gradeInput}</div>}
      {remarksInput}
    </li>
  );
});

/** Enter / ↓ / ↑ move to the same column in the next / previous row. */
function moveBetweenCells(event) {
  const { row, col } = event.target.dataset ?? {};
  if (row === undefined) return;
  const step =
    event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' || event.key === 'Enter' ? 1 : 0;
  if (!step || event.target.tagName === 'SELECT') return;
  const next = event.currentTarget.querySelector(
    `[data-row="${Number(row) + step}"][data-col="${col}"]:not(:disabled)`,
  );
  if (!next) return;
  event.preventDefault();
  next.focus();
  next.select?.();
}

function DraftEntry({ assessment, scale, today }) {
  const desktop = useIsDesktop();
  const [rows, setRows] = useState(() => rowsFromAssessment(assessment));
  const [baseline, setBaseline] = useState(rows);
  const [serverErrors, setServerErrors] = useState({});
  const [missing, setMissing] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState(null);
  const busy = useRef(false);
  const save = useSaveDraftResults();
  const publish = usePublishAssessment();

  const tooEarly = today < assessment.date;
  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(baseline), [rows, baseline]);
  const { blocker, allowNavigation } = useUnsavedChanges(dirty);

  const onChange = useCallback((studentId, field, value) => {
    setRows((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
    setServerErrors((prev) => (prev[studentId] ? { ...prev, [studentId]: undefined } : prev));
    setMissing((prev) => (prev[studentId] ? { ...prev, [studentId]: undefined } : prev));
  }, []);

  const clientErrors = Object.fromEntries(
    assessment.students.map((s) => [s.studentId, rowErrors(assessment, rows[s.studentId])]),
  );
  const complete = assessment.students.filter((s) => {
    const row = rows[s.studentId];
    if (row.attendance !== 'present') return true;
    if (assessment.mode === 'marks')
      return parseMarks(row.marks, assessment.totalMarks).value != null;
    if (assessment.mode === 'grade') return Boolean(row.grade);
    return row.remarks.trim() !== '';
  }).length;

  /** Save the draft; → true when saved (or nothing to save). */
  const saveDraft = async ({ quiet = false } = {}) => {
    const { entries, invalid } = buildEntries(assessment, assessment.students, rows);
    if (invalid.length) {
      setFailure({ message: `Fix the marks for ${plural(invalid.length, 'student')} first.` });
      document.getElementById(`result-${invalid[0]}`)?.scrollIntoView({ block: 'center' });
      return false;
    }
    if (!entries.length) return true;
    try {
      await save.mutateAsync({ id: assessment._id, entries });
      setBaseline(rows);
      setServerErrors({});
      setFailure(null);
      if (!quiet) toast.success('Draft saved');
      return true;
    } catch (error) {
      setServerErrors(serverErrorsByStudent(error, entries));
      setFailure(error);
      return false;
    }
  };

  const onPublish = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (dirty && !(await saveDraft({ quiet: true }))) return;
      await publish.mutateAsync(assessment._id);
      allowNavigation();
      toast.success('Results published. Guardians are being notified.');
    } catch (error) {
      if (error.code === 'RESULTS_INCOMPLETE') {
        const students = error.details?.students ?? [];
        setMissing(Object.fromEntries(students.map((s) => [s.studentId, s.problem])));
        document
          .getElementById(`result-${students[0]?.studentId}`)
          ?.scrollIntoView({ block: 'center' });
      }
      setFailure(error);
    } finally {
      busy.current = false;
      setConfirming(false);
    }
  };

  const missingCount = Object.values(missing).filter(Boolean).length;
  const entryProps = (student, index) => ({
    index,
    student,
    row: rows[student.studentId],
    assessment,
    scale,
    errors: { ...clientErrors[student.studentId], ...serverErrors[student.studentId] },
    missing: missing[student.studentId],
    disabled: tooEarly,
    onChange,
  });

  return (
    <>
      {tooEarly && (
        <Alert tone="info" className="mb-4" title="Not yet">
          Results can be entered from {formatSchoolDate(assessment.date, { weekday: true })}.
        </Alert>
      )}
      {missingCount > 0 && (
        <Alert
          tone="error"
          className="mb-4"
          title={`${plural(missingCount, 'student')} still need an entry`}
        >
          The highlighted students need{' '}
          {assessment.mode === 'remarks' ? 'remarks' : assessment.mode} (or Absent / Excused) before
          publishing.
        </Alert>
      )}

      {desktop ? (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full text-left" onKeyDown={moveBetweenCells}>
            <caption className="sr-only">Results for {assessment.name}</caption>
            <thead className="bg-blush-50 text-sm text-sand-700">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Student
                </th>
                <th scope="col" className="w-64 px-3 py-2.5 font-semibold xl:w-80">
                  Attendance
                </th>
                {assessment.mode !== 'remarks' && (
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    {assessment.mode === 'marks' ? 'Marks' : 'Grade'}
                  </th>
                )}
                {assessment.mode === 'marks' && (
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Grade
                  </th>
                )}
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {assessment.students.map((student, index) => (
                <StudentEntry
                  key={student.studentId}
                  layout="row"
                  {...entryProps(student, index)}
                />
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <ul aria-label={`Results for ${assessment.name}`} className="flex flex-col gap-3">
          {assessment.students.map((student, index) => (
            <StudentEntry key={student.studentId} layout="card" {...entryProps(student, index)} />
          ))}
        </ul>
      )}

      <div className="sticky bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 border-t border-line bg-surface/95 px-4 py-3 shadow-raised backdrop-blur sm:mx-0 sm:rounded-card sm:border lg:bottom-4">
        {failure && (
          <Alert tone="error" className="mb-3">
            {failure.code === 'RESULTS_INCOMPLETE'
              ? 'Some students still need an entry (highlighted).'
              : errorMessage(failure)}
          </Alert>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold tabular-nums">
              {complete} of {assessment.students.length} complete
            </span>
            <span className="block text-muted" aria-live="polite">
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              variant="secondary"
              icon={Save}
              onClick={() => saveDraft()}
              loading={save.isPending && !confirming}
              disabled={!dirty || tooEarly}
            >
              Save draft
            </Button>
            <Button icon={Send} onClick={() => setConfirming(true)} disabled={tooEarly}>
              Publish
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={onPublish}
        loading={save.isPending || publish.isPending}
        tone="primary"
        title="Publish these results?"
        confirmLabel="Publish results"
        message={
          <div className="flex flex-col gap-2">
            <p>
              Guardians of {plural(assessment.students.length, 'student')} will see the results and
              get a notification.
            </p>
            {dirty && <p>Your unsaved changes are saved first.</p>}
            <p className="text-sm text-muted">
              After publishing, a result can only be changed with a reason.
            </p>
          </div>
        }
      />
      <UnsavedChangesDialog
        blocker={blocker}
        message="Your results have not been saved as a draft."
      />
    </>
  );
}

function PublishedResults({ assessment, scale }) {
  const [editing, setEditing] = useState(null);
  const desktop = useIsDesktop();
  const value = (r) => {
    if (!r) return '—';
    if (r.attendance !== 'present')
      return <StatusBadge group="attendance" value={r.attendance} size="sm" />;
    if (assessment.mode === 'marks') {
      return (
        <span className="tabular-nums">
          {r.marksObtained} / {assessment.totalMarks}{' '}
          <strong className="ml-1 text-brand-800">{r.grade}</strong>
        </span>
      );
    }
    if (assessment.mode === 'grade') return <strong className="text-brand-800">{r.grade}</strong>;
    return null;
  };
  const editButton = (student) =>
    student.result && (
      <IconButton
        icon={Pencil}
        label={`Change ${student.name}'s result`}
        onClick={() => setEditing(student)}
      />
    );

  return (
    <>
      <Alert tone="success" className="mb-4" title="Published">
        Guardians can see these results. Change one with the pencil; a reason is required.
      </Alert>
      {desktop ? (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Published results for {assessment.name}</caption>
            <thead className="bg-blush-50 text-sm text-sand-700">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  Roll
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Student
                </th>
                {assessment.mode !== 'remarks' && (
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Result
                  </th>
                )}
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Remarks
                </th>
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Change</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {assessment.students.map((s) => (
                <tr key={s.studentId} className="border-t border-line">
                  <td className="px-4 py-2 text-right tabular-nums">{s.rollNo}</td>
                  <td className="px-4 py-2 font-semibold">{s.name}</td>
                  {assessment.mode !== 'remarks' && (
                    <td className="px-4 py-2">{value(s.result)}</td>
                  )}
                  <td className="px-4 py-2 text-muted">
                    {assessment.mode === 'remarks' && s.result?.attendance !== 'present'
                      ? value(s.result)
                      : s.result?.remarks || '—'}
                  </td>
                  <td className="px-4 py-1 text-right">{editButton(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <ul aria-label={`Published results for ${assessment.name}`} className="flex flex-col gap-3">
          {assessment.students.map((s) => (
            <li
              key={s.studentId}
              className="flex items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-muted">Roll {s.rollNo}</p>
                <div className="mt-2">{value(s.result)}</div>
                {s.result?.remarks && (
                  <p className="mt-1 text-sm text-muted">“{s.result.remarks}”</p>
                )}
              </div>
              {editButton(s)}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <EditResultDialog
          assessment={assessment}
          student={editing}
          scale={scale}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function AssessmentView({ assessment: a, settings }) {
  const paths = useRolePaths();
  const published = a.status === 'published';
  const scale = published ? a.gradingScale : settings.gradingScale;
  return (
    <>
      <PageHeader
        title={a.name}
        description={`${a.subjectId.name} · ${classSectionLabel(a)} · ${formatSchoolDate(a.date, { weekday: true })} · ${typeLabel(a.type)} · ${modeLabel(a)}`}
        actions={
          <>
            <StatusBadge group="publication" value={a.status} />
            {!published && (
              <Link
                to={paths.editAssessment(a._id)}
                className={buttonClasses({ variant: 'ghost', size: 'sm' })}
              >
                <Pencil aria-hidden="true" className="size-4" />
                Edit details
              </Link>
            )}
          </>
        }
      />
      {!a.students.length ? (
        <Card>
          <EmptyState
            title="No students in this class"
            description="Students appear once they are enrolled."
          />
        </Card>
      ) : published ? (
        <PublishedResults assessment={a} scale={scale} />
      ) : (
        <DraftEntry key={a._id} assessment={a} scale={scale} today={settings.today} />
      )}
      {!published && a.students.length > 0 && (
        <p className="mt-3 hidden text-sm text-muted md:block">
          <Badge size="sm">Tip</Badge> Enter or ↓ moves to the next student, ↑ to the previous one.
        </p>
      )}
    </>
  );
}

export default function ResultEntryPage() {
  const paths = useRolePaths();
  const { assessmentId } = useParams();
  const assessment = useAssessment(assessmentId);
  const settings = useSchoolSettings();

  const loading = (
    <div aria-busy="true" aria-label="Loading results" className="flex flex-col gap-3">
      <Skeleton className="h-10 w-72" />
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-20 rounded-card" />
      ))}
    </div>
  );
  const queries = [assessment, settings];
  const blocking = queries.find((q) => q.isError) ?? queries.find((q) => q.isPending);

  return (
    <>
      <Link
        to={paths.assessments()}
        className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-2' })}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All assessments
      </Link>
      {blocking ? (
        <QueryState query={blocking} loading={loading}>
          {() => null}
        </QueryState>
      ) : (
        <AssessmentView assessment={assessment.data} settings={settings.data} />
      )}
    </>
  );
}
