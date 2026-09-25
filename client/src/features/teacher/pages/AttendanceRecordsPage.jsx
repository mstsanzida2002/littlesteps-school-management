import { CalendarPlus, CalendarX } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { DatePicker } from '../../../components/ui/DatePicker.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { teacherPaths } from '../../../config/paths.js';
import { friendlyError } from '../../../lib/errorMessages.js';
import { formatSchoolDate } from '../../../utils/date.js';
import { markableSchoolDays } from '../../../utils/schoolDays.js';
import { DayRecords } from '../../attendance/components/DayRecords.jsx';
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
                canEditSubject={(subjectId) => editable && ownSubjectIds.has(subjectId)}
                wholeDay={editable}
                studentHref={teacherPaths.studentAttendance}
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
