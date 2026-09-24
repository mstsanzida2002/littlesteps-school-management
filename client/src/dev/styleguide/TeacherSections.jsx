import { useCallback, useState } from 'react';

import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { DateChips } from '../../components/ui/DateChips.jsx';
import { QueryState } from '../../components/ui/QueryState.jsx';
import { SkeletonCard } from '../../components/ui/Skeleton.jsx';
import { AttendanceRosterRow } from '../../features/attendance/components/AttendanceRosterRow.jsx';
import { markableSchoolDays } from '../../utils/schoolDays.js';
import { Example, Section } from './Section.jsx';

const TODAY = '2026-09-24';
const DAYS = markableSchoolDays({ today: TODAY, backdateDays: 7, offDays: ['friday', 'saturday'] });
const STUDENTS = [
  { studentId: 's1', name: 'Ayaan Rahman', rollNo: 1 },
  { studentId: 's2', name: 'নুসরাত জাহান', rollNo: 2 },
  { studentId: 's3', name: 'Arham Hossain', rollNo: 3 },
];

export function TeacherSection() {
  const [day, setDay] = useState(TODAY);
  const [statuses, setStatuses] = useState({ s1: 'present', s2: 'absent', s3: 'late' });
  const setStatus = useCallback(
    (studentId, status) => setStatuses((prev) => ({ ...prev, [studentId]: status })),
    [],
  );

  return (
    <Section
      id="teacher"
      title="Teacher building blocks"
      description="Day chips (today and earlier school days within the backdate limit, off days skipped), the take-attendance row, marking badges and the loading / error wrapper every screen uses."
    >
      <Example title="Day chips">
        <DateChips label="Day" days={DAYS} today={TODAY} value={day} onChange={setDay} />
      </Example>
      <Example title="Take-attendance rows (one tap per student)">
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-line">
            {STUDENTS.map((s) => (
              <AttendanceRosterRow
                key={s.studentId}
                student={s}
                status={statuses[s.studentId]}
                onChange={setStatus}
              />
            ))}
          </ul>
        </Card>
      </Example>
      <Example title="Today's classes" className="flex flex-wrap gap-2">
        <StatusBadge group="marking" value="pending" />
        <StatusBadge group="marking" value="partial" />
        <StatusBadge group="marking" value="marked" />
      </Example>
      <Example title="QueryState: loading and error" className="grid gap-4 md:grid-cols-2">
        <QueryState query={{ isPending: true }} loading={<SkeletonCard />}>
          {() => null}
        </QueryState>
        <Card padded={false}>
          <QueryState
            compact
            query={{
              isPending: false,
              isError: true,
              error: { status: 422, code: 'BACKDATE_LIMIT', details: { limitDays: 7 } },
              refetch: () => {},
            }}
          >
            {() => null}
          </QueryState>
        </Card>
      </Example>
    </Section>
  );
}
