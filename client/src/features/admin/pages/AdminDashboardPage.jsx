import {
  CalendarClock,
  CalendarX2,
  CircleCheck,
  GraduationCap,
  School,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router';

import { ComparisonBarChart } from '../../../components/charts/ComparisonBarChart.jsx';
import { TrendLineChart } from '../../../components/charts/TrendLineChart.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Skeleton, SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { StatCard } from '../../../components/ui/StatCard.jsx';
import { adminPaths } from '../../../config/paths.js';
import { formatDateTime, formatSchoolDate, weekdayOfKey } from '../../../utils/date.js';
import { formatNumber, formatPercent, plural } from '../../../utils/format.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import { WEEKDAY_NAMES } from '../../../utils/schoolDays.js';
import { useDashboard } from '../../dashboard/hooks/useDashboard.js';
import { useSchoolSettings } from '../../school/hooks/useSchool.js';
import { actionLabel, isCritical } from '../auditLabels.js';

const linkClass = buttonClasses({ variant: 'ghost', size: 'sm' });

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}

function Dashboard({ data }) {
  const { counts, todayAttendance: today, threshold } = data;
  const low = today.percent != null && today.percent < threshold;
  const settings = useSchoolSettings();
  const offToday = settings.data?.weeklyOffDays?.includes(WEEKDAY_NAMES[weekdayOfKey(today.date)]);
  return (
    <div className="flex flex-col gap-5">
      {data.assignmentsWithoutSchedule.length > 0 && (
        <Alert
          tone="warning"
          title={`${plural(data.assignmentsWithoutSchedule.length, 'assignment has', 'assignments have')} no timetable`}
          action={
            <Link to={adminPaths.assignments({ view: 'teacher' })} className={linkClass}>
              Fix timetables
            </Link>
          }
        >
          Teachers can&apos;t see these in &quot;today&apos;s classes&quot; or take attendance for
          them on schedule:{' '}
          {data.assignmentsWithoutSchedule
            .slice(0, 4)
            .map((a) => `${a.teacher} (${a.subject}, ${a.classSection})`)
            .join('; ')}
          {data.assignmentsWithoutSchedule.length > 4 ? '…' : '.'}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance today"
          value={today.percent == null ? '—' : formatPercent(today.percent)}
          progress={today.percent}
          tone={today.percent == null ? 'neutral' : low ? 'absent' : 'present'}
          hint={
            today.percent == null
              ? `${offToday ? 'Off day' : 'Not taken yet'} · ${formatSchoolDate(today.date, { weekday: true, year: false })}`
              : low
                ? `Below the ${threshold}% requirement`
                : `${formatNumber(today.present + today.late)} of ${formatNumber(today.total)} classes attended`
          }
        />
        <StatCard
          label="Pending approvals"
          value={formatNumber(counts.pendingApprovals)}
          icon={UserPlus}
          tone={counts.pendingApprovals ? 'late' : 'present'}
          hint={counts.pendingApprovals ? 'Waiting for you' : 'All caught up'}
        />
        <StatCard
          label="Students"
          value={formatNumber(counts.students)}
          icon={GraduationCap}
          tone="info"
          hint={`${data.session} school year`}
        />
        <StatCard
          label="Teachers · classes"
          value={`${formatNumber(counts.teachers)} · ${formatNumber(counts.classes)}`}
          icon={School}
          tone="info"
          hint={plural(counts.sections, 'section')}
        />
      </div>

      {/* Phones: one column, approvals first; desktop: charts left, lists right. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[3fr_2fr] lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          <Card
            title="Attendance, last 30 days"
            description="Whole school, per school day"
            className="order-2 lg:order-none"
          >
            <TrendLineChart
              data={data.attendanceTrend.map((d) => ({ date: d.date, value: d.percent }))}
              threshold={threshold}
            />
          </Card>
          <Card
            title="Classes compared"
            description="Last 30 days"
            className="order-4 lg:order-none"
          >
            <ComparisonBarChart
              data={data.classComparison.map((c) => ({ label: c.class, value: c.percent }))}
              threshold={threshold}
            />
          </Card>
          <Card
            title="Below the threshold"
            description={`Under ${threshold}% this school year (5+ recorded days)`}
            className="order-3 lg:order-none"
          >
            {data.belowThreshold.items.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {data.belowThreshold.items.map((s) => (
                  <li key={s.studentId} className="flex items-center gap-3 py-2.5">
                    <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-late-ink" />
                    <Link
                      to={adminPaths.studentAttendance(s.studentId)}
                      className="min-w-0 flex-1 font-semibold hover:underline"
                    >
                      {s.name}
                      <span className="block text-sm font-normal text-muted">
                        {s.classSection} · roll {s.rollNo}
                      </span>
                    </Link>
                    <span className="font-bold text-absent-ink tabular-nums">
                      {formatPercent(s.percent)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No student is below {threshold}%.</p>
            )}
            {data.belowThreshold.total > data.belowThreshold.items.length && (
              <p className="mt-2 text-sm text-muted">
                Showing {data.belowThreshold.items.length} of {data.belowThreshold.total}.
              </p>
            )}
          </Card>
        </div>

        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          <Card
            title="Pending approvals"
            className="order-1 lg:order-none"
            actions={
              <Link to={adminPaths.approvals()} className={linkClass}>
                Review all
              </Link>
            }
          >
            {data.pendingApprovals.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {data.pendingApprovals.map((u) => (
                  <li key={u._id} className="py-2.5">
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-sm text-muted">
                      Guardian: {u.registration?.guardian?.name ?? '—'} · signed up{' '}
                      {formatSchoolDate(u.createdAt, { year: false })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={CircleCheck} title="No registrations waiting" />
            )}
          </Card>

          <Card
            title="Upcoming meetings"
            className="order-5 lg:order-none"
            actions={
              <Link to={adminPaths.meetings()} className={linkClass}>
                All meetings
              </Link>
            }
          >
            {data.upcomingMeetings.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {data.upcomingMeetings.map((m) => (
                  <li key={m._id} className="py-2.5">
                    <Link to={adminPaths.meeting(m._id)} className="font-semibold hover:underline">
                      {m.title}
                    </Link>
                    <p className="flex items-center gap-1.5 text-sm text-muted">
                      <CalendarClock aria-hidden="true" className="size-4" />
                      {formatDateTime(m.dateTime, { weekday: true })} · {m.responses} of{' '}
                      {plural(m.invitees, 'guardian')} replied
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={CalendarX2} title="No upcoming meetings" />
            )}
          </Card>

          <Card
            title="Recent activity"
            className="order-6 lg:order-none"
            actions={
              <Link to={adminPaths.auditLog()} className={linkClass}>
                Audit log
              </Link>
            }
          >
            {!data.recentActivity.length && (
              <p className="text-muted">
                Nothing recorded yet. Changes appear here as they happen.
              </p>
            )}
            <ul className="flex flex-col divide-y divide-line">
              {data.recentActivity.map((entry) => (
                <li key={entry._id} className="flex items-start gap-3 py-2.5">
                  <Users
                    aria-hidden="true"
                    className={`mt-0.5 size-4 shrink-0 ${isCritical(entry.action) ? 'text-absent-ink' : 'text-sand-500'}`}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold">{actionLabel(entry.action)}</p>
                    <p className="text-sm text-muted">
                      {entry.actorId?.name ?? 'System'} · {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** The admin's overview (SRS §4): one request, GET /api/dashboard/admin. */
export default function AdminDashboardPage() {
  const { user } = useAuth();
  const dashboard = useDashboard('admin');
  const firstName = user?.name?.split(/\s+/)[0];
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={firstName ? `Welcome back, ${firstName}.` : undefined}
      />
      <QueryState query={dashboard} loading={<Loading />}>
        {(data) => <Dashboard data={data} />}
      </QueryState>
    </>
  );
}
