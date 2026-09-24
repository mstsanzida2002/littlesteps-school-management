import { CircleCheckBig, RotateCcw, Send, UsersRound } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { Checkbox } from '../../../components/ui/Checkbox.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { DateChips } from '../../../components/ui/DateChips.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { toast } from '../../../components/ui/toast.js';
import { UnsavedChangesDialog } from '../../../components/ui/UnsavedChangesDialog.jsx';
import { teacherPaths } from '../../../config/paths.js';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { errorMessage, friendlyError } from '../../../lib/errorMessages.js';
import { addDaysToKey, formatSchoolDate } from '../../../utils/date.js';
import { isOffDay, markableSchoolDays } from '../../../utils/schoolDays.js';
import { AttendanceRosterRow } from '../../attendance/components/AttendanceRosterRow.jsx';
import {
  useAttendanceSheet,
  useAttendanceToday,
  useMarkAttendance,
} from '../../attendance/hooks/useAttendance.js';
import {
  findClassSection,
  useMyAssignments,
  useSchoolSettings,
} from '../../school/hooks/useSchool.js';
import { AttendanceNav } from '../components/AttendanceNav.jsx';
import { classSectionValue } from '../classSection.js';
import { ClassSectionSelect } from '../components/ClassSectionSelect.jsx';

const RosterSkeleton = () => (
  <div aria-busy="true" aria-label="Loading students" className="flex flex-col gap-2">
    {[1, 2, 3, 4, 5].map((i) => (
      <Skeleton key={i} className="h-16 rounded-card" />
    ))}
  </div>
);

/** Why a day from the URL can't be used (fallback: the chips only offer valid days). */
function dateProblem(date, settings) {
  const { today, attendanceBackdateDays, weeklyOffDays, session } = settings;
  let code = null;
  if (date > today) code = 'FUTURE_DATE';
  else if (session && (date < session.startDate || date > session.endDate))
    code = 'OUTSIDE_SESSION';
  else if (isOffDay(date, weeklyOffDays)) code = 'OFF_DAY';
  else if (date < addDaysToKey(today, -attendanceBackdateDays)) code = 'BACKDATE_LIMIT';
  return code ? friendlyError({ code, details: { limitDays: attendanceBackdateDays } }) : null;
}

const countsText = ({ present, absent, late }) =>
  `${present} present · ${absent} absent · ${late} late`;

function AlreadyTaken({ label, dayLabel, recordsLink }) {
  return (
    <Card>
      <EmptyState
        icon={CircleCheckBig}
        title="Already taken — view or edit"
        description={`Attendance for ${label} on ${dayLabel} has been submitted. Changes are made record by record, with a reason.`}
        action={
          <Link to={recordsLink} className={buttonClasses()}>
            View or edit attendance
          </Link>
        }
      />
    </Card>
  );
}

function Saved({ result, label, dayLabel, recordsLink, next }) {
  return (
    <Card>
      <EmptyState
        icon={CircleCheckBig}
        title={`Saved for ${label}`}
        description={`${dayLabel}: ${countsText(result)}. ${
          result.absent ? 'Guardians of absent students are being notified.' : ''
        }`}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            {next && (
              <Link to={teacherPaths.takeAttendance(next)} className={buttonClasses()}>
                Next: {next.label}
              </Link>
            )}
            <Link to={recordsLink} className={buttonClasses({ variant: 'secondary' })}>
              View records
            </Link>
            <Link to={teacherPaths.dashboard()} className={buttonClasses({ variant: 'ghost' })}>
              Back to dashboard
            </Link>
          </div>
        }
      />
    </Card>
  );
}

/**
 * The roster for one class-section and day. Keyed by class-section + day, so switching starts
 * fresh (everyone Present).
 */
function AttendanceTaker({ sheet, classId, sectionId, date, dayLabel, label, next }) {
  const planned = sheet.subjects?.subjects ?? [];
  const available = sheet.subjects?.availableSubjects ?? [];
  const markedIds = new Set(sheet.records.map((r) => String(r.subject?._id ?? r.subject)));
  const needsChoice = planned.length === 0;
  const remaining = planned.filter((s) => !markedIds.has(String(s._id)));
  const choosable = available.filter((s) => !markedIds.has(String(s._id)));

  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(sheet.students.map((s) => [s.studentId, 'present'])),
  );
  const [chosen, setChosen] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [failure, setFailure] = useState(null);
  const submitting = useRef(false);
  const mark = useMarkAttendance();

  const setStatus = useCallback(
    (studentId, status) => setStatuses((prev) => ({ ...prev, [studentId]: status })),
    [],
  );
  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0 };
    for (const status of Object.values(statuses)) c[status] += 1;
    return c;
  }, [statuses]);

  const dirty = counts.absent + counts.late > 0 || chosen.length > 0;
  const { blocker } = useUnsavedChanges(dirty && !saved && !conflict);
  const recordsLink = teacherPaths.attendanceRecords({ classId, sectionId, date });

  if (saved) return <Saved {...{ result: saved, label, dayLabel, recordsLink, next }} />;
  if (conflict || (!needsChoice && !remaining.length) || (needsChoice && !choosable.length)) {
    return <AlreadyTaken label={label} dayLabel={dayLabel} recordsLink={recordsLink} />;
  }
  if (!sheet.students.length) {
    return (
      <Card>
        <EmptyState
          icon={UsersRound}
          title="No students in this class yet"
          description="Students appear here once they are enrolled in this class."
        />
      </Card>
    );
  }

  const subjects = needsChoice
    ? choosable.filter((s) => chosen.includes(String(s._id)))
    : remaining;
  const partlyTaken = !needsChoice && remaining.length < planned.length;
  const exceptions = sheet.students.filter((s) => statuses[s.studentId] !== 'present');

  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setFailure(null);
    try {
      await mark.mutateAsync({
        classId,
        sectionId,
        date,
        defaultStatus: 'present',
        entries: exceptions.map((s) => ({ studentId: s.studentId, status: statuses[s.studentId] })),
        ...((needsChoice || partlyTaken) && { subjectIds: subjects.map((s) => String(s._id)) }),
      });
      setSaved(counts);
      toast.success(`Attendance saved for ${label}`);
      window.scrollTo({ top: 0 });
    } catch (error) {
      if (error.code === 'ALREADY_MARKED') setConflict(true);
      else setFailure(error);
    } finally {
      submitting.current = false;
      setConfirming(false);
    }
  };

  return (
    <>
      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">
              {label} · {dayLabel}
            </h2>
            {!needsChoice && (
              <p className="text-sm text-muted">Records {subjects.map((s) => s.name).join(', ')}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            disabled={!dirty}
            onClick={() =>
              setStatuses(Object.fromEntries(sheet.students.map((s) => [s.studentId, 'present'])))
            }
          >
            All present
          </Button>
        </div>

        {partlyTaken && (
          <Alert tone="info" className="m-4 mb-0">
            {planned
              .filter((s) => markedIds.has(String(s._id)))
              .map((s) => s.name)
              .join(', ')}{' '}
            already taken for this day. This records the rest.
          </Alert>
        )}

        {needsChoice && (
          <fieldset className="border-b border-line px-4 py-3">
            <legend className="sr-only">Subjects</legend>
            <Alert tone="info" className="mb-2">
              Nothing is scheduled for {label} on this day. Choose the subjects you taught.
            </Alert>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {choosable.map((s) => {
                const id = String(s._id);
                return (
                  <Checkbox
                    key={id}
                    label={s.name}
                    checked={chosen.includes(id)}
                    onChange={(event) =>
                      setChosen((prev) =>
                        event.target.checked ? [...prev, id] : prev.filter((x) => x !== id),
                      )
                    }
                  />
                );
              })}
            </div>
          </fieldset>
        )}

        <ul aria-label={`${label} students`} className="divide-y divide-line">
          {sheet.students.map((student) => (
            <AttendanceRosterRow
              key={student.studentId}
              student={student}
              status={statuses[student.studentId]}
              onChange={setStatus}
            />
          ))}
        </ul>
      </Card>

      {/* Sticky summary: above the bottom navigation on phones, at the bottom on desktop. */}
      <div className="sticky bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 border-t border-line bg-surface/95 px-4 py-3 shadow-raised backdrop-blur sm:mx-0 sm:rounded-card sm:border lg:bottom-4">
        {failure && (
          <Alert tone="error" className="mb-3">
            {errorMessage(failure)}
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <p aria-live="polite" className="min-w-0 flex-1 font-semibold tabular-nums">
            <span className="text-present-ink">{counts.present} present</span>
            <span className="text-sand-400"> · </span>
            <span className="text-absent-ink">{counts.absent} absent</span>
            <span className="text-sand-400"> · </span>
            <span className="text-late-ink">{counts.late} late</span>
          </p>
          <Button
            size="lg"
            icon={Send}
            loading={mark.isPending}
            disabled={!subjects.length}
            onClick={() => setConfirming(true)}
            className="w-full sm:w-auto"
          >
            Submit
          </Button>
        </div>
        {!subjects.length && (
          <p className="mt-2 text-sm text-muted">Choose at least one subject to submit.</p>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        loading={mark.isPending}
        tone="primary"
        title={`Submit attendance for ${label}?`}
        confirmLabel="Submit attendance"
        cancelLabel="Keep editing"
        message={
          <div className="flex flex-col gap-3">
            <p>
              {dayLabel} · {subjects.map((s) => s.name).join(', ')}
            </p>
            <p className="font-semibold tabular-nums">{countsText(counts)}</p>
            {exceptions.length ? (
              <ul className="flex flex-col gap-2">
                {exceptions.map((s) => (
                  <li key={s.studentId} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {s.name} <span className="text-sm text-muted">· Roll {s.rollNo}</span>
                    </span>
                    <StatusBadge group="attendance" value={statuses[s.studentId]} size="sm" />
                  </li>
                ))}
              </ul>
            ) : (
              <p>Everyone is present.</p>
            )}
            {counts.absent > 0 && (
              <p className="text-sm text-muted">Guardians of absent students will be notified.</p>
            )}
          </div>
        }
      />
      <UnsavedChangesDialog
        blocker={blocker}
        message="The statuses you set have not been submitted."
      />
    </>
  );
}

export default function TakeAttendancePage() {
  const [params, setParams] = useSearchParams();
  const settings = useSchoolSettings();
  const mine = useMyAssignments();
  const today = useAttendanceToday();

  const classSections = mine.data?.classSections ?? [];
  const pendingToday = today.data?.classSections?.find((cs) => cs.status !== 'marked');
  const fallback = pendingToday ?? classSections[0];
  const classId = params.get('classId') ?? fallback?.classId;
  const sectionId = params.get('sectionId') ?? fallback?.sectionId;
  const current = findClassSection(mine.data, classId, sectionId);

  const s = settings.data;
  const days = s
    ? markableSchoolDays({
        today: s.today,
        backdateDays: s.attendanceBackdateDays,
        offDays: s.weeklyOffDays,
        sessionStart: s.session?.startDate,
        sessionEnd: s.session?.endDate,
      })
    : [];
  const date = params.get('date') ?? days[0];
  const problem = s && date && !days.includes(date) ? dateProblem(date, s) : null;
  const sheet = useAttendanceSheet({
    classId: current && classId,
    sectionId: current && sectionId,
    date: problem ? undefined : date,
  });

  const select = (next) =>
    setParams(
      Object.fromEntries(
        Object.entries({ classId, sectionId, date, ...next }).filter(([, v]) => v),
      ),
      { replace: true },
    );
  const dayLabel = date ? formatSchoolDate(date, { weekday: true, year: false }) : '';
  const nextPending = today.data?.classSections
    ?.filter((cs) => cs.status !== 'marked')
    .find(
      (cs) =>
        !(String(cs.classId) === String(classId) && String(cs.sectionId) === String(sectionId)),
    );

  // The first of the page's lookups that failed (or is still loading) decides what to show.
  const blocking =
    [settings, mine].find((q) => q.isError) ?? [settings, mine].find((q) => q.isPending);
  return (
    <>
      <PageHeader title="Take attendance" />
      <AttendanceNav classId={classId} sectionId={sectionId} date={date} />

      {blocking ? (
        <QueryState query={blocking} loading={<RosterSkeleton />}>
          {() => null}
        </QueryState>
      ) : !classSections.length ? (
        <Card>
          <EmptyState
            icon={UsersRound}
            title="No classes assigned to you"
            description="An administrator assigns classes and subjects to teachers."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex flex-col gap-4">
              <ClassSectionSelect
                classSections={classSections}
                value={classSectionValue(current)}
                onChange={(cs) => cs && select(cs)}
                placeholder={current ? undefined : 'Choose a class'}
                className="sm:max-w-xs"
              />
              <DateChips
                label="Day"
                days={days}
                today={s.today}
                value={date}
                onChange={(day) => select({ date: day })}
              />
              {problem && (
                <Alert tone="warning" title={problem.title}>
                  {problem.message}
                </Alert>
              )}
            </div>
          </Card>

          {current && !problem && (
            <QueryState query={sheet} loading={<RosterSkeleton />}>
              {(data) => (
                <AttendanceTaker
                  key={`${classId}|${sectionId}|${date}`}
                  sheet={data}
                  classId={classId}
                  sectionId={sectionId}
                  date={date}
                  dayLabel={dayLabel}
                  label={current.label}
                  next={
                    nextPending && {
                      classId: nextPending.classId,
                      sectionId: nextPending.sectionId,
                      date: today.data.date,
                      label: nextPending.label,
                    }
                  }
                />
              )}
            </QueryState>
          )}
        </div>
      )}
    </>
  );
}
