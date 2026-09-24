import { CalendarPlus, CalendarX, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { DatePicker } from '../../../components/ui/DatePicker.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { teacherPaths } from '../../../config/paths.js';
import { useIsDesktop } from '../../../hooks/useMediaQuery.js';
import { friendlyError } from '../../../lib/errorMessages.js';
import { formatSchoolDate } from '../../../utils/date.js';
import { markableSchoolDays } from '../../../utils/schoolDays.js';
import { EditAttendanceDialog } from '../../attendance/components/EditAttendanceDialog.jsx';
import { useAttendanceSheet } from '../../attendance/hooks/useAttendance.js';
import {
  findClassSection,
  useMyAssignments,
  useSchoolSettings,
} from '../../school/hooks/useSchool.js';
import { AttendanceNav } from '../components/AttendanceNav.jsx';
import { classSectionValue } from '../classSection.js';
import { ClassSectionSelect } from '../components/ClassSectionSelect.jsx';

/** students × subjects from the sheet's records. */
function buildGrid(sheet) {
  const subjects = new Map();
  const byStudent = new Map();
  for (const r of sheet.records) {
    const subjectId = String(r.subject?._id ?? r.subject);
    subjects.set(subjectId, r.subject?.name ?? 'Subject');
    if (!byStudent.has(String(r.studentId))) byStudent.set(String(r.studentId), new Map());
    byStudent.get(String(r.studentId)).set(subjectId, r);
  }
  const subjectList = [...subjects.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { subjects: subjectList, byStudent };
}

function RecordButton({ record, editable, onEdit }) {
  if (!record) return <span className="text-sm text-sand-400">—</span>;
  const badge = <StatusBadge group="attendance" value={record.status} size="sm" />;
  if (!editable) return badge;
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Change ${record.subject?.name}: ${record.status}`}
      className="-m-1.5 inline-flex min-h-11 items-center gap-1 rounded-control p-1.5 hover:bg-blush-100"
    >
      {badge}
      <Pencil aria-hidden="true" className="size-3.5 text-sand-500" />
    </button>
  );
}

function DayRecords({ sheet, ownSubjectIds, editable, dayLabel, date, onEdit }) {
  const desktop = useIsDesktop();
  const { subjects, byStudent } = buildGrid(sheet);
  const canEdit = (subjectId) => editable && ownSubjectIds.has(subjectId);

  const editRecord = (student, record) =>
    onEdit({
      kind: 'record',
      id: record._id,
      status: record.status,
      studentName: student.name,
      subjectName: record.subject?.name,
      dayLabel,
    });
  const editDay = (student) => {
    const own = [...(byStudent.get(String(student.studentId))?.values() ?? [])].filter((r) =>
      ownSubjectIds.has(String(r.subject?._id)),
    );
    onEdit({
      kind: 'day',
      studentId: student.studentId,
      date,
      status: own[0]?.status ?? 'present',
      studentName: student.name,
      dayLabel,
    });
  };

  if (desktop) {
    return (
      <Card padded={false} className="overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">
            Attendance for {sheet.classSection}, {dayLabel}
          </caption>
          <thead className="bg-blush-50 text-sm text-sand-700">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                Roll
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Student
              </th>
              {subjects.map((s) => (
                <th key={s.id} scope="col" className="px-3 py-2.5 font-semibold">
                  {s.name}
                </th>
              ))}
              {editable && (
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Whole day</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sheet.students.map((student) => {
              const records = byStudent.get(String(student.studentId));
              return (
                <tr key={student.studentId} className="border-t border-line">
                  <td className="px-4 py-2 text-right tabular-nums">{student.rollNo}</td>
                  <td className="min-w-44 px-4 py-2 font-semibold">
                    <Link
                      to={teacherPaths.studentAttendance(student.studentId)}
                      className="hover:underline"
                    >
                      {student.name}
                    </Link>
                  </td>
                  {subjects.map((s) => (
                    <td key={s.id} className="px-3 py-2">
                      <RecordButton
                        record={records?.get(s.id)}
                        editable={canEdit(s.id)}
                        onEdit={() => editRecord(student, records.get(s.id))}
                      />
                    </td>
                  ))}
                  {editable && (
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => editDay(student)}>
                        Whole day
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    );
  }

  return (
    <ul aria-label={`Attendance for ${sheet.classSection}`} className="flex flex-col gap-3">
      {sheet.students.map((student) => {
        const records = byStudent.get(String(student.studentId));
        return (
          <li
            key={student.studentId}
            className="rounded-card border border-line bg-surface p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  to={teacherPaths.studentAttendance(student.studentId)}
                  className="font-bold hover:underline"
                >
                  {student.name}
                </Link>
                <p className="text-sm text-muted">Roll {student.rollNo}</p>
              </div>
              {editable && (
                <Button variant="secondary" size="sm" onClick={() => editDay(student)}>
                  Whole day
                </Button>
              )}
            </div>
            <dl className="mt-2 flex flex-col">
              {subjects.map((s) => (
                <div
                  key={s.id}
                  className="flex min-h-11 items-center justify-between gap-3 border-t border-line"
                >
                  <dt className="text-sm text-muted">{s.name}</dt>
                  <dd>
                    <RecordButton
                      record={records?.get(s.id)}
                      editable={canEdit(s.id)}
                      onEdit={() => editRecord(student, records.get(s.id))}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export default function AttendanceRecordsPage() {
  const [params, setParams] = useSearchParams();
  const settings = useSchoolSettings();
  const mine = useMyAssignments();
  const [editing, setEditing] = useState(null);

  const classSections = mine.data?.classSections ?? [];
  const classId = params.get('classId') ?? classSections[0]?.classId;
  const sectionId = params.get('sectionId') ?? classSections[0]?.sectionId;
  const current = findClassSection(mine.data, classId, sectionId);
  const s = settings.data;
  const markable = s
    ? markableSchoolDays({
        today: s.today,
        backdateDays: s.attendanceBackdateDays,
        offDays: s.weeklyOffDays,
        sessionStart: s.session?.startDate,
        sessionEnd: s.session?.endDate,
      })
    : [];
  const date = params.get('date') ?? markable[0];
  const sheet = useAttendanceSheet({
    classId: current && classId,
    sectionId: current && sectionId,
    date,
  });
  const select = (next) =>
    setParams(
      Object.fromEntries(
        Object.entries({ classId, sectionId, date, ...next }).filter(([, v]) => v),
      ),
      { replace: true },
    );

  const editable = markable.includes(date);
  const ownSubjectIds = new Set((current?.subjects ?? []).map((sub) => String(sub._id)));
  const dayLabel = date ? formatSchoolDate(date, { weekday: true }) : '';
  const tooOld = s && date && date < markable.at(-1);

  return (
    <>
      <PageHeader title="Attendance records" />
      <AttendanceNav classId={classId} sectionId={sectionId} date={date} />

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <ClassSectionSelect
            classSections={classSections}
            value={classSectionValue(current)}
            onChange={(cs) => cs && select(cs)}
          />
          <FormField label="Day">
            <DatePicker
              value={date}
              onChange={(day) => day && select({ date: day })}
              min={s?.session?.startDate}
              max={s?.today}
              showToday
            />
          </FormField>
        </div>
        {tooOld && (
          <Alert tone="info" className="mt-4" title="View only">
            {
              friendlyError({
                code: 'BACKDATE_LIMIT',
                details: { limitDays: s.attendanceBackdateDays },
              }).message
            }
          </Alert>
        )}
      </Card>

      {current && date && (
        <QueryState
          query={sheet}
          loading={
            <div aria-busy="true" aria-label="Loading records" className="flex flex-col gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 rounded-card" />
              ))}
            </div>
          }
        >
          {(data) =>
            data.records.length ? (
              <DayRecords
                sheet={data}
                ownSubjectIds={ownSubjectIds}
                editable={editable}
                dayLabel={dayLabel}
                date={date}
                onEdit={setEditing}
              />
            ) : (
              <Card>
                <EmptyState
                  icon={editable ? CalendarPlus : CalendarX}
                  title="Attendance not taken"
                  description={`Nothing was recorded for ${data.classSection} on ${dayLabel}.`}
                  action={
                    editable && (
                      <Link
                        to={teacherPaths.takeAttendance({ classId, sectionId, date })}
                        className={buttonClasses()}
                      >
                        Take attendance
                      </Link>
                    )
                  }
                />
              </Card>
            )
          }
        </QueryState>
      )}

      {editing && (
        <EditAttendanceDialog
          key={editing.id ?? editing.studentId}
          target={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
