import {
  ArrowRight,
  Award,
  CalendarCheck,
  CalendarClock,
  MapPin,
  Sun,
  UsersRound,
  Video,
} from 'lucide-react';
import { Link } from 'react-router';

import { TrendLineChart } from '../../../components/charts/TrendLineChart.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Badge, StatusBadge } from '../../../components/ui/Badge.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Skeleton, SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { StatCard } from '../../../components/ui/StatCard.jsx';
import { teacherPaths } from '../../../config/paths.js';
import { formatDateTime, formatSchoolDate } from '../../../utils/date.js';
import { formatPercent, plural } from '../../../utils/format.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import { useDashboard } from '../../dashboard/hooks/useDashboard.js';
import { useSchoolSettings } from '../../school/hooks/useSchool.js';

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr] lg:grid-rows-[auto_auto_1fr]">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  );
}

const timeRange = (subjects) =>
  subjects.length ? `${subjects[0].startTime}–${subjects.at(-1).endTime}` : '';

function TodaysClasses({ today }) {
  if (today.offDay) {
    return (
      <EmptyState
        icon={Sun}
        compact
        title="No classes today"
        description={`${formatSchoolDate(today.date, { weekday: true, year: false })} is a weekly holiday.`}
      />
    );
  }
  if (!today.classSections.length) {
    return (
      <EmptyState
        icon={CalendarCheck}
        compact
        title="Nothing on your timetable today"
        description="Classes you teach will appear here on the days they are scheduled."
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line">
      {today.classSections.map((cs) => {
        const params = { classId: cs.classId, sectionId: cs.sectionId, date: today.date };
        const marked = cs.status === 'marked';
        return (
          <li
            key={`${cs.classId}:${cs.sectionId}`}
            className="flex flex-wrap items-center gap-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-bold">
                {cs.label} <StatusBadge group="marking" value={cs.status} size="sm" />
              </p>
              <p className="text-sm text-muted">
                {timeRange(cs.subjects)} · {plural(cs.subjects.length, 'subject')}
              </p>
            </div>
            <Link
              to={
                marked
                  ? teacherPaths.attendanceRecords(params)
                  : teacherPaths.takeAttendance(params)
              }
              className={buttonClasses({
                variant: marked ? 'secondary' : 'primary',
                className: 'w-full sm:w-auto',
              })}
            >
              {marked ? 'View attendance' : 'Take attendance'}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ListLink({ to, children }) {
  return (
    <Link
      to={to}
      className="-mx-2 flex min-h-12 items-center gap-3 rounded-control px-2 py-2 hover:bg-blush-50"
    >
      {children}
      <ArrowRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-sand-400" />
    </Link>
  );
}

function Dashboard({ data, threshold }) {
  const { today, sections, frequentAbsentees, draftAssessments, upcomingMeetings } = data;
  const toMark = today.classSections.filter((cs) => cs.status !== 'marked').length;
  const totals = sections.reduce(
    (acc, s) => ({
      total: acc.total + s.last30Days.total,
      attended: acc.attended + s.last30Days.attended,
    }),
    { total: 0, attended: 0 },
  );
  const rate = totals.total ? Math.round((totals.attended / totals.total) * 1000) / 10 : null;
  const low = rate != null && rate < threshold;

  return (
    // Phones: today's classes first (the teacher's first job), then the numbers. Desktop: the
    // numbers across the top, today's classes and charts on the left, lists on the right.
    <div className="grid gap-5 lg:grid-cols-[3fr_2fr] lg:grid-rows-[auto_auto_1fr]">
      <Card
        title="Today's classes"
        description={formatSchoolDate(today.date, { weekday: true })}
        className="min-w-0 lg:col-start-1 lg:row-start-2"
      >
        <TodaysClasses today={today} />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:row-start-1 xl:grid-cols-4">
        <StatCard
          label="Classes to mark today"
          value={today.offDay ? 'Holiday' : `${toMark} of ${today.classSections.length}`}
          icon={CalendarCheck}
          tone={toMark ? 'late' : 'present'}
          hint={today.offDay ? 'No school today' : toMark ? 'Attendance still to take' : 'All done'}
        />
        <StatCard
          label="Attendance, last 30 days"
          value={formatPercent(rate)}
          progress={rate}
          tone={rate == null ? 'neutral' : low ? 'absent' : 'present'}
          hint={
            rate == null
              ? 'No records yet'
              : low
                ? `Below the ${threshold}% requirement`
                : `Above ${threshold}%`
          }
        />
        <StatCard
          label="Drafts to publish"
          value={draftAssessments.length}
          icon={Award}
          tone={draftAssessments.length ? 'late' : 'info'}
          hint={draftAssessments.length ? 'Results waiting' : 'Nothing waiting'}
        />
        <StatCard
          label="Upcoming meetings"
          value={upcomingMeetings.length}
          icon={UsersRound}
          tone="info"
          hint={
            upcomingMeetings[0]
              ? `Next: ${formatSchoolDate(upcomingMeetings[0].dateTime, { weekday: true, year: false })}`
              : 'None planned'
          }
        />
      </div>

      <div className="flex min-w-0 flex-col gap-5 self-start lg:col-start-1 lg:row-start-3">
        {sections.map((section) => (
          <Card
            key={`${section.classId}:${section.sectionId}`}
            title={`${section.label} · last 30 days`}
            actions={
              <Link
                to={teacherPaths.attendanceSummary({
                  classId: section.classId,
                  sectionId: section.sectionId,
                })}
                className={buttonClasses({ variant: 'ghost', size: 'sm' })}
              >
                Summary
              </Link>
            }
          >
            <TrendLineChart
              data={section.daily.map((d) => ({ date: d.date, value: d.percent }))}
              threshold={threshold}
              height={200}
            />
          </Card>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-span-2 lg:row-start-2">
        <Card title="Frequent absentees" description="3 or more absent days in the last 30">
          {frequentAbsentees.length ? (
            <ul className="flex flex-col">
              {frequentAbsentees.map((s) => (
                <li key={s.studentId}>
                  <ListLink to={teacherPaths.studentAttendance(s.studentId)}>
                    <Avatar name={s.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                    <Badge tone="absent" size="sm">
                      {plural(s.absentDays, 'day')} absent
                    </Badge>
                  </ListLink>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              title="No frequent absentees"
              description="Everyone is coming regularly."
            />
          )}
        </Card>

        <Card
          title="Drafts to publish"
          actions={
            <Link
              to={teacherPaths.assessments({ status: 'draft' })}
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              All
            </Link>
          }
        >
          {draftAssessments.length ? (
            <ul className="flex flex-col">
              {draftAssessments.map((a) => (
                <li key={a._id}>
                  <ListLink to={teacherPaths.assessment(a._id)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{a.name}</span>
                      <span className="block text-sm text-muted">
                        {a.subject} · {a.classSection} · {formatSchoolDate(a.date, { year: false })}
                      </span>
                    </span>
                    <Badge size="sm">{plural(a.entries, 'entry', 'entries')}</Badge>
                  </ListLink>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={Award}
              title="No drafts waiting"
              description="Assessments you create appear here until published."
            />
          )}
        </Card>

        <Card
          title="Upcoming meetings"
          actions={
            <Link
              to={teacherPaths.meetings()}
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              All
            </Link>
          }
        >
          {upcomingMeetings.length ? (
            <ul className="flex flex-col">
              {upcomingMeetings.map((m) => {
                const Where = m.onlineLink ? Video : MapPin;
                return (
                  <li key={m._id}>
                    <ListLink to={teacherPaths.meeting(m._id)}>
                      <span className="grid size-10 shrink-0 place-items-center rounded-control bg-info-soft text-info-ink">
                        <CalendarClock aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{m.title}</span>
                        <span className="flex items-center gap-1 text-sm text-muted">
                          <Where aria-hidden="true" className="size-3.5" />
                          {formatDateTime(m.dateTime, { weekday: true })}
                        </span>
                        <span className="block text-sm text-muted">
                          {m.responses} of {plural(m.invitees, 'invitee')} replied
                        </span>
                      </span>
                    </ListLink>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={UsersRound}
              title="No meetings planned"
              description="Meetings you organise or are invited to appear here."
            />
          )}
        </Card>
      </div>
    </div>
  );
}

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const dashboard = useDashboard('teacher');
  const settings = useSchoolSettings();
  const firstName = user?.name?.split(/\s+/)[0];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={firstName ? `Welcome back, ${firstName}.` : undefined}
      />
      <QueryState query={dashboard} loading={<DashboardSkeleton />}>
        {(data) => <Dashboard data={data} threshold={settings.data?.attendanceThreshold ?? 75} />}
      </QueryState>
    </>
  );
}
