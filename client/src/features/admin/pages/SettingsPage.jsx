import { Info, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button, IconButton } from '../../../components/ui/Button.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Checkbox } from '../../../components/ui/Checkbox.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { toast } from '../../../components/ui/toast.js';
import { friendlyError } from '../../../lib/errorMessages.js';
import { cn } from '../../../utils/cn.js';
import { WEEKDAY_NAMES } from '../../../utils/schoolDays.js';
import { scaleBands, scaleToBody, validateScale } from '../gradingScale.js';
import { useAdminSettings, useUpdateSettings } from '../hooks/useAdmin.js';
import { text } from '../text/index.js';

// Alternating fills so neighbouring grades are told apart (each segment also carries its label).
const SEGMENT = [
  'bg-brand-700 text-white',
  'bg-citron-500 text-brand-900',
  'bg-brand-200 text-brand-900',
];

/** 0 → 100 with each grade's range; gaps (no grade) are hatched. */
function ScaleBar({ rows }) {
  const bands = scaleBands(rows).filter((b) => b.max > b.min || b.max === 100);
  const lowest = bands.at(-1)?.min ?? 0;
  const ordered = [...bands].reverse();
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="sr-only">
        {ordered.map((b) => `${b.grade || '?'}: ${b.min}% up to ${b.max}%`).join('; ')}
        {lowest > 0 ? `; below ${lowest}%: no grade` : ''}
      </figcaption>
      <div
        aria-hidden="true"
        className="flex h-12 overflow-hidden rounded-control border border-line-strong"
      >
        {lowest > 0 && (
          <div
            style={{ width: `${lowest}%` }}
            className="flex items-center justify-center bg-absent-soft bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgb(226_50_96/0.25)_6px,rgb(226_50_96/0.25)_12px)] text-xs font-bold text-absent-ink"
          >
            No grade
          </div>
        )}
        {ordered.map((b, i) => (
          <div
            key={`${b.index}-${b.grade}`}
            style={{ width: `${Math.max(0, b.max - b.min)}%` }}
            className={cn(
              'flex min-w-0 items-center justify-center overflow-hidden border-l border-white text-sm font-bold first:border-l-0',
              SEGMENT[i % SEGMENT.length],
            )}
            title={`${b.grade}: ${b.min}–${b.max}%`}
          >
            <span className="truncate px-1">{b.grade}</span>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex justify-between text-xs text-muted tabular-nums">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </figure>
  );
}

function GradingScaleCard({ settings }) {
  const update = useUpdateSettings();
  const initial = settings.gradingScale.map((b) => ({
    grade: b.grade,
    minPercent: String(b.minPercent),
    gpa: b.gpa == null ? '' : String(b.gpa),
  }));
  const [rows, setRows] = useState(initial);
  const [serverError, setServerError] = useState(null);
  const check = validateScale(rows);
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const set = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setServerError(null);
    try {
      await update.mutateAsync({ gradingScale: scaleToBody(rows) });
      toast.success('Grading scale saved. It applies to results published from now on.');
    } catch (err) {
      setServerError(friendlyError(err).message);
    }
  };

  return (
    <Card
      title="Grading scale"
      description="Each grade starts at its percentage and runs up to the next grade."
    >
      <Alert tone="info" className="mb-4">
        Changes apply to results published from now on. Published results keep the scale saved with
        them, so their grades never change.
      </Alert>
      <ScaleBar rows={rows} />
      <table className="mt-4 w-full text-left">
        <caption className="sr-only">Grades</caption>
        <thead className="text-sm text-muted">
          <tr>
            <th scope="col" className="pb-1 font-semibold">
              Grade
            </th>
            <th scope="col" className="pb-1 font-semibold">
              From %
            </th>
            <th scope="col" className="pb-1 font-semibold">
              GPA
            </th>
            <th scope="col">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              <td className="py-1 pr-2">
                <Input
                  aria-label={`Grade ${i + 1}`}
                  value={row.grade}
                  invalid={Boolean(check.rows[i])}
                  onChange={(e) => set(i, { grade: e.target.value })}
                />
              </td>
              <td className="py-1 pr-2">
                <Input
                  aria-label={`Grade ${i + 1} starts at (%)`}
                  inputMode="decimal"
                  value={row.minPercent}
                  invalid={Boolean(check.rows[i])}
                  onChange={(e) => set(i, { minPercent: e.target.value })}
                />
              </td>
              <td className="py-1 pr-2">
                <Input
                  aria-label={`Grade ${i + 1} GPA`}
                  inputMode="decimal"
                  value={row.gpa}
                  onChange={(e) => set(i, { gpa: e.target.value })}
                />
              </td>
              <td className="py-1">
                <IconButton
                  icon={Trash2}
                  label={`Remove grade ${row.grade || i + 1}`}
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                />
              </td>
            </tr>
          ))}
          {rows.map(
            (row, i) =>
              check.rows[i] && (
                <tr key={`error-${i}`}>
                  <td
                    colSpan={4}
                    role="alert"
                    className="pb-1 text-sm font-semibold text-absent-ink"
                  >
                    {row.grade || `Grade ${i + 1}`}: {check.rows[i]}
                  </td>
                </tr>
              ),
          )}
        </tbody>
      </table>
      {check.scale.map((message) => (
        <p key={message} role="alert" className="mt-2 text-sm font-semibold text-absent-ink">
          {message}
        </p>
      ))}
      {serverError && (
        <Alert tone="error" className="mt-3">
          {serverError}
        </Alert>
      )}
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-4">
        <Button
          variant="ghost"
          icon={Plus}
          onClick={() => setRows([...rows, { grade: '', minPercent: '', gpa: '' }])}
        >
          Add a grade
        </Button>
        <Button
          icon={Save}
          onClick={save}
          loading={update.isPending}
          disabled={!dirty || !check.valid}
        >
          Save grading scale
        </Button>
      </div>
    </Card>
  );
}

function AttendanceRulesCard({ settings }) {
  const update = useUpdateSettings();
  const initial = {
    attendanceThreshold: String(settings.attendanceThreshold),
    lateCountsAsPresent: settings.lateCountsAsPresent,
    attendanceBackdateDays: String(settings.attendanceBackdateDays),
    weeklyOffDays: settings.weeklyOffDays,
  };
  const [values, setValues] = useState(initial);
  const [error, setError] = useState(null);
  const set = (patch) => setValues({ ...values, ...patch });
  const threshold = Number(values.attendanceThreshold);
  const backdate = Number(values.attendanceBackdateDays);
  const errors = {
    attendanceThreshold:
      values.attendanceThreshold === '' ||
      Number.isNaN(threshold) ||
      threshold < 0 ||
      threshold > 100
        ? 'Use a percentage from 0 to 100'
        : null,
    attendanceBackdateDays:
      !/^\d+$/.test(values.attendanceBackdateDays) || backdate > 365 ? 'Use 0 to 365 days' : null,
    weeklyOffDays:
      values.weeklyOffDays.length >= 7 ? 'At least one day must be a school day' : null,
  };
  const serverError = (name) => error?.errors?.find((e) => e.field === name)?.message;
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const valid = !Object.values(errors).some(Boolean);

  const save = async () => {
    setError(null);
    const changes = {};
    if (values.attendanceThreshold !== initial.attendanceThreshold)
      changes.attendanceThreshold = threshold;
    if (values.lateCountsAsPresent !== initial.lateCountsAsPresent)
      changes.lateCountsAsPresent = values.lateCountsAsPresent;
    if (values.attendanceBackdateDays !== initial.attendanceBackdateDays)
      changes.attendanceBackdateDays = backdate;
    if (JSON.stringify(values.weeklyOffDays) !== JSON.stringify(initial.weeklyOffDays))
      changes.weeklyOffDays = values.weeklyOffDays;
    try {
      await update.mutateAsync(changes);
      toast.success('Attendance rules saved');
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Card title="Attendance rules" description="Used for every percentage, warning and off day.">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Required attendance (%)"
          hint="Guardians are warned below this."
          error={errors.attendanceThreshold ?? serverError('attendanceThreshold')}
        >
          <Input
            inputMode="decimal"
            value={values.attendanceThreshold}
            onChange={(e) => set({ attendanceThreshold: e.target.value })}
          />
        </FormField>
        <FormField
          label="Teachers can change attendance for"
          hint="Days back. Admins have no limit."
          error={errors.attendanceBackdateDays ?? serverError('attendanceBackdateDays')}
        >
          <Input
            inputMode="numeric"
            value={values.attendanceBackdateDays}
            onChange={(e) => set({ attendanceBackdateDays: e.target.value })}
          />
        </FormField>
        <div className="sm:col-span-2">
          <Checkbox
            label="Late counts as present"
            description="Late arrivals count as attended in every percentage."
            checked={values.lateCountsAsPresent}
            onChange={(e) => set({ lateCountsAsPresent: e.target.checked })}
          />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 font-semibold">Weekly off days</legend>
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            {WEEKDAY_NAMES.map((day) => (
              <Checkbox
                key={day}
                label={text.weekdays[day]}
                checked={values.weeklyOffDays.includes(day)}
                onChange={(e) =>
                  set({
                    weeklyOffDays: e.target.checked
                      ? WEEKDAY_NAMES.filter((d) => d === day || values.weeklyOffDays.includes(d))
                      : values.weeklyOffDays.filter((d) => d !== day),
                  })
                }
              />
            ))}
          </div>
          {(errors.weeklyOffDays ?? serverError('weeklyOffDays')) && (
            <p role="alert" className="text-sm font-semibold text-absent-ink">
              {errors.weeklyOffDays ?? serverError('weeklyOffDays')}
            </p>
          )}
        </fieldset>
      </div>
      <p className="mt-4 flex items-start gap-2 text-sm text-muted">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Changes affect calculations from now on; attendance already taken on a new off day stays
        recorded.
      </p>
      {error && !error.errors?.length && (
        <Alert tone="error" className="mt-3">
          {friendlyError(error).message}
        </Alert>
      )}
      <div className="mt-4 flex justify-end border-t border-line pt-4">
        <Button icon={Save} onClick={save} loading={update.isPending} disabled={!dirty || !valid}>
          Save attendance rules
        </Button>
      </div>
    </Card>
  );
}

/** School-wide rules (FR-ADM-10). */
export default function SettingsPage() {
  const settings = useAdminSettings();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Grading and attendance rules for the whole school."
      />
      <QueryState query={settings} loading={<Skeleton className="h-96 rounded-card" />}>
        {(data) => (
          <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
            <GradingScaleCard key={`scale-${data.updatedAt}`} settings={data} />
            <AttendanceRulesCard key={`rules-${data.updatedAt}`} settings={data} />
          </div>
        )}
      </QueryState>
    </>
  );
}
