import { Pencil } from 'lucide-react';
import { Link } from 'react-router';

import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { useIsDesktop } from '../../../hooks/useMediaQuery.js';

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

function StudentName({ student, href, className = '' }) {
  return href ? (
    <Link to={href} className={`${className} hover:underline`}>
      {student.name}
    </Link>
  ) : (
    <span className={className}>{student.name}</span>
  );
}

/**
 * A class-section's day: students × subjects, each record a button when editable, and a
 * "Whole day" action per student. Teachers edit their own subjects within the backdate limit;
 * admins edit everything (overrides). A table on desktop, cards on phones.
 *
 * canEditSubject(subjectId) → boolean; wholeDay: show "Whole day"; studentHref(studentId) → url
 * (or null for no link). onEdit(target) opens EditAttendanceDialog.
 */
export function DayRecords({
  sheet,
  canEditSubject,
  wholeDay,
  studentHref,
  dayLabel,
  date,
  onEdit,
}) {
  const desktop = useIsDesktop();
  const { subjects, byStudent } = buildGrid(sheet);
  const canEdit = canEditSubject;
  const editable = wholeDay;

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
      canEditSubject(String(r.subject?._id)),
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
                    <StudentName student={student} href={studentHref?.(student.studentId)} />
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
                <StudentName
                  student={student}
                  href={studentHref?.(student.studentId)}
                  className="font-bold"
                />
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
