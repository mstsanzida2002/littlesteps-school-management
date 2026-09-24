import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

import { CalendarHeatmap } from '../../../components/charts/CalendarHeatmap.jsx';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Skeleton, SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { StatCard } from '../../../components/ui/StatCard.jsx';
import { formatSchoolDate } from '../../../utils/date.js';
import { formatPercent, plural } from '../../../utils/format.js';
import {
  useStudentAttendanceHistory,
  useStudentAttendanceSummary,
} from '../../attendance/hooks/useAttendance.js';
import { useSchoolSettings } from '../../school/hooks/useSchool.js';
import { dayStatuses } from '../../attendance/dayStatus.js';
import { WEEKDAY_NAMES } from '../../../utils/schoolDays.js';

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading attendance" className="flex flex-col gap-4">
      <SkeletonCard />
      <Skeleton className="h-80 rounded-card" />
    </div>
  );
}

export default function StudentAttendancePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const summary = useStudentAttendanceSummary(studentId);
  const history = useStudentAttendanceHistory(studentId);
  const settings = useSchoolSettings();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={ArrowLeft}
        onClick={() => navigate(-1)}
        className="-ml-2 mb-2"
      >
        Back
      </Button>
      <QueryState query={summary} loading={<Loading />}>
        {(data) => {
          const { student, overall } = data;
          const low = data.belowThreshold;
          return (
            <>
              <PageHeader
                title={student.name}
                description={`${student.classSection} · Roll ${student.rollNo} · ${data.session} session`}
              />
              <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
                <div className="flex flex-col gap-4">
                  <StatCard
                    label="Attendance this session"
                    value={
                      overall.percent == null
                        ? 'No records yet'
                        : `${overall.attended} of ${plural(overall.total, 'class', 'classes')}`
                    }
                    progress={overall.percent}
                    tone={overall.percent == null ? 'neutral' : low ? 'absent' : 'present'}
                    hint={
                      overall.percent == null
                        ? undefined
                        : low
                          ? `Below the ${data.threshold}% requirement`
                          : `At or above ${data.threshold}%`
                    }
                  />
                  <section aria-labelledby="by-subject">
                    <h2 id="by-subject" className="mb-2 text-lg font-bold">
                      By subject
                    </h2>
                    <DataTable
                      caption="Attendance by subject"
                      rowKey={(r) => r.subject._id}
                      columns={[
                        {
                          key: 'subject',
                          header: 'Subject',
                          mobile: 'title',
                          cell: (r) => r.subject.name,
                        },
                        { key: 'present', header: 'Present', align: 'right' },
                        { key: 'absent', header: 'Absent', align: 'right' },
                        { key: 'late', header: 'Late', align: 'right' },
                        {
                          key: 'percent',
                          header: '%',
                          align: 'right',
                          cell: (r) => (
                            <span className="font-semibold tabular-nums">
                              {formatPercent(r.percent)}
                            </span>
                          ),
                        },
                      ]}
                      rows={data.bySubject}
                      empty={<EmptyState compact title="No records yet" />}
                    />
                  </section>
                </div>
                <Card title="Calendar">
                  <QueryState
                    query={history}
                    compact
                    loading={<Skeleton className="h-72 rounded-card" />}
                  >
                    {(records) => (
                      <CalendarHeatmap
                        title=""
                        days={dayStatuses(records)}
                        offDays={(settings.data?.weeklyOffDays ?? ['friday', 'saturday']).map((d) =>
                          WEEKDAY_NAMES.indexOf(d),
                        )}
                      />
                    )}
                  </QueryState>
                </Card>
              </div>

              <Card title="Recent days" className="mt-4">
                <QueryState
                  query={history}
                  compact
                  loading={<Skeleton className="h-40 rounded-card" />}
                >
                  {(records) => {
                    const days = [...new Set(records.map((r) => r.date))].slice(0, 10);
                    if (!days.length) return <EmptyState compact title="No records yet" />;
                    return (
                      <ul className="flex flex-col divide-y divide-line">
                        {days.map((day) => (
                          <li
                            key={day}
                            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
                          >
                            <p className="w-36 shrink-0 font-semibold">
                              {formatSchoolDate(day, { weekday: true, year: false })}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {records
                                .filter((r) => r.date === day)
                                .map((r) => (
                                  <span
                                    key={r._id}
                                    className="inline-flex items-center gap-1.5 text-sm"
                                  >
                                    <span className="text-muted">{r.subject}</span>
                                    <StatusBadge group="attendance" value={r.status} size="sm" />
                                  </span>
                                ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    );
                  }}
                </QueryState>
              </Card>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
