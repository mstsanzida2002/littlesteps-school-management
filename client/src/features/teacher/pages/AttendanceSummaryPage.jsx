import { TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { TrendLineChart } from '../../../components/charts/TrendLineChart.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { DatePicker } from '../../../components/ui/DatePicker.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { teacherPaths } from '../../../config/paths.js';
import { addDaysToKey } from '../../../utils/date.js';
import { formatPercent } from '../../../utils/format.js';
import { useClassAttendanceSummary } from '../../attendance/hooks/useAttendance.js';
import {
  findClassSection,
  useMyAssignments,
  useSchoolSettings,
} from '../../school/hooks/useSchool.js';
import { AttendanceNav } from '../components/AttendanceNav.jsx';
import { classSectionValue } from '../classSection.js';
import { ClassSectionSelect } from '../components/ClassSectionSelect.jsx';

/** Lowest first (they need attention), students with no records last. */
const byPercent = (a, b) => (a.percent ?? 101) - (b.percent ?? 101) || a.rollNo - b.rollNo;

function SummaryBody({ data, sort, onSortChange }) {
  const students = useMemo(() => {
    const field = sort.replace(/^-/, '');
    const dir = sort.startsWith('-') ? -1 : 1;
    const list = [...data.students];
    if (field === 'percent') list.sort((a, b) => dir * byPercent(a, b));
    else
      list.sort(
        (a, b) =>
          dir * String(a[field]).localeCompare(String(b[field]), undefined, { numeric: true }),
      );
    return list;
  }, [data.students, sort]);
  const below = data.students.filter((s) => s.belowThreshold);

  const columns = [
    { key: 'rollNo', header: 'Roll', sortable: true, align: 'right', mobile: 'hidden' },
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      mobile: 'title',
      cell: (s) => (
        <Link
          to={teacherPaths.studentAttendance(s.studentId)}
          className="font-semibold hover:underline"
        >
          {s.name}
        </Link>
      ),
    },
    { key: 'present', header: 'Present', align: 'right' },
    { key: 'absent', header: 'Absent', align: 'right' },
    { key: 'late', header: 'Late', align: 'right' },
    {
      key: 'percent',
      header: 'Attendance',
      sortable: true,
      align: 'right',
      cell: (s) =>
        s.belowThreshold ? (
          <Badge tone="absent" icon={TriangleAlert} size="sm">
            {formatPercent(s.percent)} · below {data.threshold}%
          </Badge>
        ) : (
          <span className="font-semibold tabular-nums">{formatPercent(s.percent)}</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card title="Daily attendance rate">
        <TrendLineChart
          data={data.daily.map((d) => ({ date: d.date, value: d.percent }))}
          threshold={data.threshold}
        />
      </Card>
      <section aria-labelledby="students-heading">
        <h2 id="students-heading" className="text-lg font-bold">
          Students
        </h2>
        <p className="mb-3 text-sm text-muted">
          {below.length
            ? `${below.length} below the ${data.threshold}% requirement, listed first`
            : `Everyone is at or above ${data.threshold}%`}
        </p>
        <DataTable
          caption="Students by attendance"
          columns={columns}
          rows={students}
          rowKey="studentId"
          sort={sort}
          onSortChange={onSortChange}
          rowClassName={(s) => (s.belowThreshold ? 'bg-absent-soft/40' : undefined)}
          empty={<EmptyState compact title="No students yet" />}
        />
      </section>
    </div>
  );
}

export default function AttendanceSummaryPage() {
  const [params, setParams] = useSearchParams();
  const settings = useSchoolSettings();
  const mine = useMyAssignments();
  const [sort, setSort] = useState('percent');

  const classSections = mine.data?.classSections ?? [];
  const classId = params.get('classId') ?? classSections[0]?.classId;
  const sectionId = params.get('sectionId') ?? classSections[0]?.sectionId;
  const current = findClassSection(mine.data, classId, sectionId);
  const today = settings.data?.today;
  const from = params.get('from') ?? (today && addDaysToKey(today, -29));
  const to = params.get('to') ?? today;
  const subjectId = params.get('subjectId') ?? '';
  const summary = useClassAttendanceSummary({
    classId: current && classId,
    sectionId: current && sectionId,
    from,
    to,
    subjectId: subjectId || undefined,
  });

  const select = (next) =>
    setParams(
      Object.fromEntries(
        Object.entries({ classId, sectionId, from, to, subjectId, ...next }).filter(([, v]) => v),
      ),
      { replace: true },
    );

  return (
    <>
      <PageHeader title="Attendance summary" />
      <AttendanceNav classId={classId} sectionId={sectionId} />

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ClassSectionSelect
            classSections={classSections}
            value={classSectionValue(current)}
            onChange={(cs) => cs && select({ ...cs, subjectId: '' })}
          />
          <FormField label="Subject">
            <Select
              value={subjectId}
              onChange={(event) => select({ subjectId: event.target.value })}
              options={[
                { value: '', label: 'All subjects' },
                ...(current?.subjects ?? []).map((s) => ({ value: String(s._id), label: s.name })),
              ]}
            />
          </FormField>
          <FormField label="From">
            <DatePicker
              value={from}
              onChange={(day) => day && select({ from: day })}
              min={settings.data?.session?.startDate}
              max={to}
            />
          </FormField>
          <FormField label="To">
            <DatePicker
              value={to}
              onChange={(day) => day && select({ to: day })}
              min={from}
              max={today}
            />
          </FormField>
        </div>
      </Card>

      {current && from && (
        <QueryState
          query={summary}
          loading={
            <div aria-busy="true" aria-label="Loading summary" className="flex flex-col gap-4">
              <Skeleton className="h-72 rounded-card" />
              <Skeleton className="h-64 rounded-card" />
            </div>
          }
        >
          {(data) => <SummaryBody data={data} sort={sort} onSortChange={setSort} />}
        </QueryState>
      )}
    </>
  );
}
