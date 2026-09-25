import { CalendarClock, CalendarDays, Plus, TriangleAlert, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Checkbox } from '../../../components/ui/Checkbox.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { Skeleton, SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { TabPanel, Tabs } from '../../../components/ui/Tabs.jsx';
import { toast } from '../../../components/ui/toast.js';
import { adminPaths } from '../../../config/paths.js';
import { friendlyError } from '../../../lib/errorMessages.js';
import { cn } from '../../../utils/cn.js';
import { WEEKDAY_NAMES } from '../../../utils/schoolDays.js';
import { useSchoolSettings } from '../../school/hooks/useSchool.js';
import { ScheduleEditor } from '../components/ScheduleEditor.jsx';
import { clashErrorsBySlot, summarizeSchedule } from '../scheduleErrors.js';
import {
  useAssignments,
  useClasses,
  useCreateAssignment,
  useRemoveAssignment,
  useSections,
  useSubjects,
  useUpdateSchedule,
  useUsers,
} from '../hooks/useAdmin.js';
import { text } from '../text/index.js';

const VIEWS = [
  { value: 'teacher', label: 'By teacher', icon: UserRound },
  { value: 'class', label: 'By class', icon: Users },
  { value: 'timetable', label: 'Timetable', icon: CalendarDays },
];

const classSectionOf = (a) => `${a.classId?.name}-${a.sectionId?.name}`;
const bySlot = (a, b) =>
  WEEKDAY_NAMES.indexOf(a.day) - WEEKDAY_NAMES.indexOf(b.day) ||
  a.startTime.localeCompare(b.startTime);

function useSchoolDays() {
  const settings = useSchoolSettings();
  const off = settings.data?.weeklyOffDays ?? ['friday', 'saturday'];
  return WEEKDAY_NAMES.filter((d) => !off.includes(d));
}

/** Edit an assignment's weekly slots; clashes appear next to the slot that clashes. */
function ScheduleDialog({ assignment, onClose }) {
  const update = useUpdateSchedule();
  const days = useSchoolDays();
  const [slots, setSlots] = useState(
    [...assignment.schedule]
      .sort(bySlot)
      .map(({ day, startTime, endTime }) => ({ day, startTime, endTime })),
  );
  const [error, setError] = useState(null);
  const slotErrors = clashErrorsBySlot(error, slots);
  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({ id: assignment._id, schedule: slots });
      toast.success('Timetable saved');
      onClose();
    } catch (err) {
      setError(err);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!update.isPending}
      title="Timetable"
      description={`${assignment.teacherId?.name} · ${assignment.subjectId?.name} · ${classSectionOf(assignment)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={update.isPending}>
            Save timetable
          </Button>
        </>
      }
    >
      <ScheduleEditor value={slots} onChange={setSlots} days={days} errors={slotErrors} />
      {error && !Object.keys(slotErrors).length && (
        <Alert tone="error" className="mt-3">
          {friendlyError(error).message}
        </Alert>
      )}
    </Modal>
  );
}

/** Assign a teacher to a class-section and subject, optionally with slots. */
function AssignDialog({ onClose, teacherId: presetTeacher }) {
  const create = useCreateAssignment();
  const days = useSchoolDays();
  const teachers = useUsers({ role: 'teacher', status: 'active', limit: 100, sort: 'name' });
  const classes = useClasses();
  const subjects = useSubjects();
  const [form, setForm] = useState({
    teacherId: presetTeacher ?? '',
    classId: '',
    sectionId: '',
    subjectId: '',
  });
  const sections = useSections(form.classId || undefined, { enabled: Boolean(form.classId) });
  const [slots, setSlots] = useState([]);
  const [error, setError] = useState(null);
  const slotErrors = clashErrorsBySlot(error, slots);
  const fieldError = (name) => error?.errors?.find((e) => e.field === name)?.message;
  const set = (patch) => setForm({ ...form, ...patch });

  const save = async () => {
    setError(null);
    try {
      await create.mutateAsync({ ...form, schedule: slots });
      toast.success('Teacher assigned');
      onClose();
    } catch (err) {
      setError(err);
    }
  };
  const ready = form.teacherId && form.classId && form.sectionId && form.subjectId;
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!create.isPending}
      size="lg"
      title="Assign a teacher"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={create.isPending} disabled={!ready}>
            Assign
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Teacher" required error={fieldError('teacherId')}>
          <Select
            value={form.teacherId}
            placeholder="Choose a teacher"
            onChange={(e) => set({ teacherId: e.target.value })}
            options={(teachers.data?.data ?? []).map((t) => ({ value: t._id, label: t.name }))}
          />
        </FormField>
        <FormField label="Subject" required error={fieldError('subjectId')}>
          <Select
            value={form.subjectId}
            placeholder="Choose a subject"
            onChange={(e) => set({ subjectId: e.target.value })}
            options={(subjects.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
          />
        </FormField>
        <FormField label="Class" required error={fieldError('classId')}>
          <Select
            value={form.classId}
            placeholder="Choose a class"
            onChange={(e) => set({ classId: e.target.value, sectionId: '' })}
            options={(classes.data ?? []).map((c) => ({ value: c._id, label: c.name }))}
          />
        </FormField>
        <FormField label="Section" required error={fieldError('sectionId')}>
          <Select
            value={form.sectionId}
            placeholder="Choose a section"
            disabled={!form.classId}
            onChange={(e) => set({ sectionId: e.target.value })}
            options={(sections.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
          />
        </FormField>
        <div className="sm:col-span-2">
          <ScheduleEditor value={slots} onChange={setSlots} days={days} errors={slotErrors} />
        </div>
      </div>
      {error && !Object.keys(slotErrors).length && !error.errors?.some((e) => e.field) && (
        <Alert tone="error" className="mt-3">
          {friendlyError(error).message}
        </Alert>
      )}
    </Modal>
  );
}

function AssignmentRow({ assignment: a, primary, secondary, onEdit, onRemove }) {
  const unscheduled = a.status === 'active' && !a.schedule.length;
  const ended = a.status === 'ended';
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {primary}
          {unscheduled && (
            <Badge tone="late" icon={TriangleAlert} size="sm">
              No timetable
            </Badge>
          )}
          {ended && (
            <Badge tone="neutral" size="sm">
              Ended
            </Badge>
          )}
        </p>
        <p className="text-sm text-muted">{secondary}</p>
        {a.schedule.length > 0 && (
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm">
            {summarizeSchedule(a.schedule).map((line) => (
              <span key={line} className="tabular-nums">
                {line}
              </span>
            ))}
          </p>
        )}
      </div>
      {!ended && (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={CalendarClock} onClick={() => onEdit(a)}>
            Timetable
          </Button>
          <Button variant="danger-ghost" size="sm" onClick={() => onRemove(a)}>
            Remove
          </Button>
        </div>
      )}
    </li>
  );
}

function Grouped({ items, groupOf, labelOf, rowPrimary, rowSecondary, onEdit, onRemove }) {
  const groups = new Map();
  for (const a of items) {
    const key = groupOf(a);
    if (!groups.has(key)) groups.set(key, { label: labelOf(a), items: [] });
    groups.get(key).items.push(a);
  }
  const sorted = [...groups.entries()].sort((x, y) => x[1].label.localeCompare(y[1].label));
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {sorted.map(([key, group]) => (
        <Card key={key} title={group.label} description={`${group.items.length} assignments`}>
          <ul className="flex flex-col divide-y divide-line">
            {group.items.map((a) => (
              <AssignmentRow
                key={a._id}
                assignment={a}
                primary={rowPrimary(a)}
                secondary={rowSecondary(a)}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/** Days across, start times down; each cell names the subject and the teacher or class. */
function WeekTimetable({ items, days, describe }) {
  const slots = items.flatMap((a) => a.schedule.map((s) => ({ ...s, a })));
  const times = [...new Set(slots.map((s) => `${s.startTime}–${s.endTime}`))].sort();
  if (!slots.length) {
    return <EmptyState compact icon={CalendarDays} title="Nothing scheduled" />;
  }
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] table-fixed text-left">
          <caption className="sr-only">Weekly timetable</caption>
          <thead className="bg-blush-50 text-sm">
            <tr>
              <th scope="col" className="w-28 px-3 py-2 font-semibold">
                Time
              </th>
              {days.map((d) => (
                <th key={d} scope="col" className="px-3 py-2 font-semibold">
                  {text.weekdays[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((time) => (
              <tr key={time} className="border-t border-line align-top">
                <th scope="row" className="px-3 py-2 text-sm font-semibold tabular-nums">
                  {time}
                </th>
                {days.map((d) => {
                  const here = slots.filter(
                    (s) => s.day === d && `${s.startTime}–${s.endTime}` === time,
                  );
                  return (
                    <td key={d} className="px-2 py-1.5">
                      {here.map((s) => (
                        <div
                          key={s.a._id}
                          className="mb-1 rounded-control bg-brand-50 px-2 py-1 text-sm"
                        >
                          <p className="font-semibold">{s.a.subjectId?.name}</p>
                          <p className="text-xs text-muted">{describe(s.a)}</p>
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Phones: one list per day. */}
      <div className="flex flex-col gap-3 md:hidden">
        {days.map((d) => {
          const here = slots.filter((s) => s.day === d).sort(bySlot);
          return (
            <section key={d} aria-label={text.weekdays[d]}>
              <h3 className="mb-1 font-bold">{text.weekdays[d]}</h3>
              {here.length ? (
                <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
                  {here.map((s) => (
                    <li key={`${s.a._id}${s.startTime}`} className="flex gap-3 px-3 py-2">
                      <span className="w-24 shrink-0 text-sm font-semibold tabular-nums">
                        {s.startTime}–{s.endTime}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{s.a.subjectId?.name}</span>
                        <span className="block text-sm text-muted">{describe(s.a)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No classes</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Teacher assignments and the timetable (FR-ADM-06, FR-TCH-01). */
export default function AssignmentsPage() {
  const [params, setParams] = useSearchParams();
  const view = VIEWS.some((v) => v.value === params.get('view')) ? params.get('view') : 'teacher';
  const teacherId = params.get('teacherId') ?? '';
  const [showEnded, setShowEnded] = useState(false);
  const list = useAssignments({ ...(!showEnded && { status: 'active' }) });
  const teachers = useUsers({ role: 'teacher', limit: 100, sort: 'name' });
  const days = useSchoolDays();
  const remove = useRemoveAssignment();
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [timetableFor, setTimetableFor] = useState('');

  const setParam = (patch) =>
    setParams(
      Object.fromEntries(
        Object.entries({ view, teacherId, ...patch }).filter(
          ([k, v]) => v && !(k === 'view' && v === 'teacher'),
        ),
      ),
      { replace: true },
    );

  const confirmRemove = async () => {
    try {
      const res = await remove.mutateAsync(removing._id);
      // The server says whether it was ended (history kept) or deleted.
      toast.success(res.message);
      setRemoving(null);
    } catch (err) {
      toast.error(friendlyError(err).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Who teaches what, and when. Teachers only reach the class-sections they are assigned to."
        actions={
          <Button icon={Plus} onClick={() => setAssigning(true)}>
            Assign a teacher
          </Button>
        }
      />
      <QueryState
        query={list}
        loading={
          <div aria-busy="true" aria-label="Loading assignments" className="flex flex-col gap-3">
            <Skeleton className="h-11 w-80" />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        }
      >
        {({ data }) => {
          const items = teacherId
            ? data.filter((a) => String(a.teacherId?._id) === teacherId)
            : data;
          const unscheduled = data.filter((a) => a.status === 'active' && !a.schedule.length);
          const classSections = [
            ...new Map(
              data.map((a) => [
                `${a.classId?._id}:${a.sectionId?._id}`,
                { value: `cs:${a.classId?._id}:${a.sectionId?._id}`, label: classSectionOf(a) },
              ]),
            ).values(),
          ].sort((x, y) => x.label.localeCompare(y.label));
          const timetableItems = timetableFor.startsWith('cs:')
            ? data.filter((a) => `cs:${a.classId?._id}:${a.sectionId?._id}` === timetableFor)
            : data.filter((a) => String(a.teacherId?._id) === timetableFor.slice(2));

          return (
            <div className="flex flex-col gap-4">
              {unscheduled.length > 0 && (
                <Alert tone="warning" title={`${unscheduled.length} without a timetable`}>
                  Teachers don&apos;t see these in &quot;today&apos;s classes&quot;. Open
                  &quot;Timetable&quot; on the rows marked <strong>No timetable</strong>.
                </Alert>
              )}
              <div className="flex flex-wrap items-end gap-4">
                <FormField label="Teacher" className="w-full sm:w-64">
                  <Select
                    value={teacherId}
                    placeholder="All teachers"
                    onChange={(e) => setParam({ teacherId: e.target.value })}
                    options={(teachers.data?.data ?? []).map((t) => ({
                      value: t._id,
                      label: t.name,
                    }))}
                  />
                </FormField>
                <Checkbox
                  label="Show ended assignments"
                  checked={showEnded}
                  onChange={(e) => setShowEnded(e.target.checked)}
                />
              </div>
              <Tabs
                label="Assignment views"
                value={view}
                onChange={(v) => setParam({ view: v })}
                items={VIEWS}
              >
                <TabPanel value={view} className="mt-4">
                  {!items.length ? (
                    <Card>
                      <EmptyState icon={UserRound} title="No assignments yet" />
                    </Card>
                  ) : view === 'teacher' ? (
                    <Grouped
                      items={items}
                      groupOf={(a) => String(a.teacherId?._id)}
                      labelOf={(a) => a.teacherId?.name ?? 'Unknown teacher'}
                      rowPrimary={(a) => a.subjectId?.name}
                      rowSecondary={(a) => classSectionOf(a)}
                      onEdit={setEditing}
                      onRemove={setRemoving}
                    />
                  ) : view === 'class' ? (
                    <Grouped
                      items={items}
                      groupOf={(a) => `${a.classId?._id}:${a.sectionId?._id}`}
                      labelOf={classSectionOf}
                      rowPrimary={(a) => a.subjectId?.name}
                      rowSecondary={(a) => (
                        <Link to={adminPaths.user(a.teacherId?._id)} className="hover:underline">
                          {a.teacherId?.name}
                        </Link>
                      )}
                      onEdit={setEditing}
                      onRemove={setRemoving}
                    />
                  ) : (
                    <Card>
                      <FormField label="Show the week of" className="mb-4 sm:w-72">
                        <Select
                          value={timetableFor}
                          placeholder="Choose a teacher or class"
                          onChange={(e) => setTimetableFor(e.target.value)}
                        >
                          <optgroup label="Teachers">
                            {(teachers.data?.data ?? []).map((t) => (
                              <option key={t._id} value={`t:${t._id}`}>
                                {t.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Classes">
                            {classSections.map((cs) => (
                              <option key={cs.value} value={cs.value}>
                                {cs.label}
                              </option>
                            ))}
                          </optgroup>
                        </Select>
                      </FormField>
                      {timetableFor ? (
                        <WeekTimetable
                          items={timetableItems}
                          days={days}
                          describe={
                            timetableFor.startsWith('cs:')
                              ? (a) => a.teacherId?.name
                              : (a) => classSectionOf(a)
                          }
                        />
                      ) : (
                        <p className={cn('text-muted')}>Choose whose week to show.</p>
                      )}
                    </Card>
                  )}
                </TabPanel>
              </Tabs>
            </div>
          );
        }}
      </QueryState>

      {editing && <ScheduleDialog assignment={editing} onClose={() => setEditing(null)} />}
      {assigning && (
        <AssignDialog teacherId={teacherId || undefined} onClose={() => setAssigning(false)} />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove this assignment?"
        message={
          removing && (
            <>
              <p>
                {removing.teacherId?.name} · {removing.subjectId?.name} · {classSectionOf(removing)}
              </p>
              <p className="mt-2 text-muted">
                If attendance or results were recorded, it is <strong>ended</strong> (kept for the
                history, no more access). Otherwise it is deleted.
              </p>
            </>
          )
        }
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={confirmRemove}
      />
    </>
  );
}
