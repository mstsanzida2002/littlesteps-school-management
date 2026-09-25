import { CalendarX } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { DatePicker } from '../../../components/ui/DatePicker.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { adminPaths } from '../../../config/paths.js';
import { formatSchoolDate } from '../../../utils/date.js';
import { markableSchoolDays } from '../../../utils/schoolDays.js';
import { DayRecords } from '../../attendance/components/DayRecords.jsx';
import { EditAttendanceDialog } from '../../attendance/components/EditAttendanceDialog.jsx';
import { useAttendanceSheet } from '../../attendance/hooks/useAttendance.js';
import { useSchoolSettings } from '../../school/hooks/useSchool.js';
import { useClassSectionScope } from '../../school/hooks/useScope.js';
import { classSectionValue } from '../../teacher/classSection.js';
import { ClassSectionSelect } from '../../teacher/components/ClassSectionSelect.jsx';

/**
 * Admin attendance override (FR-ADM-09): any class-section, any day of the school year (no
 * backdate limit). The teacher's records view, with every record and whole day editable as an
 * override with a required reason (audited as attendance.override).
 */
export default function AdminAttendancePage() {
  const [params, setParams] = useSearchParams();
  const scope = useClassSectionScope();
  const settings = useSchoolSettings();
  const [editing, setEditing] = useState(null);

  const classSections = scope.data?.classSections ?? [];
  const classId = params.get('classId') ?? classSections[0]?.classId;
  const sectionId = params.get('sectionId') ?? classSections[0]?.sectionId;
  const current = classSections.find(
    (cs) => String(cs.classId) === String(classId) && String(cs.sectionId) === String(sectionId),
  );
  const s = settings.data;
  // Default: the latest school day (today, or the last one before an off day).
  const latestSchoolDay = s
    ? markableSchoolDays({
        today: s.today,
        backdateDays: 14,
        offDays: s.weeklyOffDays,
        sessionStart: s.session?.startDate,
        sessionEnd: s.session?.endDate,
      })[0]
    : undefined;
  const date = params.get('date') ?? latestSchoolDay;
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
  const dayLabel = date ? formatSchoolDate(date, { weekday: true }) : '';

  return (
    <>
      <PageHeader
        title="Attendance override"
        description="Correct any record, on any day of the school year. Every change needs a reason and is kept in the audit log."
      />
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
              <>
                <Alert tone="info" className="mb-3">
                  Choose a status to change it. Teachers of {data.classSection} see the change at
                  once; the guardian is told about corrections.
                </Alert>
                <DayRecords
                  sheet={data}
                  canEditSubject={() => true}
                  wholeDay
                  studentHref={adminPaths.studentAttendance}
                  dayLabel={dayLabel}
                  date={date}
                  onEdit={setEditing}
                />
              </>
            ) : (
              <Card>
                <EmptyState
                  icon={CalendarX}
                  title="Nothing recorded"
                  description={`No attendance was taken for ${data.classSection} on ${dayLabel}. Teachers take attendance; admins correct it here.`}
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
          override
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
