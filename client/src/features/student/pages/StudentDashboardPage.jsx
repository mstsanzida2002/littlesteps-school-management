import { ArrowRight, Bell, CalendarClock, Pin } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { MonthBars } from '../../../components/charts/MonthBars.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Skeleton, SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { toast } from '../../../components/ui/toast.js';
import { ROLES } from '../../../config/constants.js';
import { notificationLink, studentPaths } from '../../../config/paths.js';
import { errorMessage } from '../../../lib/errorMessages.js';
import { cn } from '../../../utils/cn.js';
import { formatDateTime, formatMonth, formatSchoolDate } from '../../../utils/date.js';
import { formatPercent } from '../../../utils/format.js';
import { AbsenceAlerts } from '../../attendance/components/AbsenceAlerts.jsx';
import { AttendanceOverview } from '../../attendance/components/AttendanceOverview.jsx';
import { text as attendanceText } from '../../attendance/text/index.js';
import { useDashboard } from '../../dashboard/hooks/useDashboard.js';
import { GuardianMeetingCard } from '../../meetings/components/GuardianMeeting.jsx';
import { useMarkNotificationRead } from '../../notifications/hooks/useNotifications.js';
import { NOTIFICATION_ICONS } from '../../notifications/icons.js';
import { ResultCard } from '../../results/components/GuardianResult.jsx';
import { useChild } from '../hooks/useStudent.js';
import { text } from '../text/index.js';

const t = text.dashboard;
const linkClass =
  'inline-flex min-h-11 items-center gap-1 font-semibold text-brand-700 hover:underline';

function MoreLink({ to, children }) {
  return (
    <Link to={to} className={linkClass}>
      {children}
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={t.loading}
      className="grid gap-4 lg:grid-cols-2 lg:items-start"
    >
      <div className="flex flex-col gap-4">
        <Skeleton className="h-60 rounded-card" />
        <SkeletonCard />
      </div>
      <div className="flex flex-col gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

/** Unread notifications; opening one marks it read and goes to its screen. */
function NewForYou({ notifications }) {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const open = async (n) => {
    try {
      await markRead.mutateAsync(n._id);
    } catch (error) {
      toast.error(errorMessage(error));
    }
    navigate(notificationLink(n, ROLES.STUDENT));
  };
  if (!notifications.length) return <p className="text-muted">{t.notificationsEmpty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {notifications.map((n) => {
        const { icon: Icon = Bell, className } = NOTIFICATION_ICONS[n.type] ?? {};
        return (
          <li key={n._id}>
            <button
              type="button"
              onClick={() => open(n)}
              className="flex min-h-14 w-full items-start gap-3 py-2.5 text-left hover:bg-blush-50"
            >
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-full',
                  className ?? 'bg-sand-100',
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{n.title}</span>
                <span className="block text-sm text-muted">{formatDateTime(n.createdAt)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Dashboard({ data, name }) {
  const attendance = data.attendance;
  const overview = attendance && {
    percent: attendance.percent,
    ...attendance.counts,
    threshold: attendance.threshold,
    belowThreshold: attendance.belowThreshold,
  };
  const pinned = data.notices.filter((n) => n.isPinned);
  const months = (attendance?.monthly ?? []).map((m) => ({
    key: m.month,
    label: formatMonth(m.month, { short: true }),
    value: m.percent,
  }));
  const monthSummary = months
    .filter((m) => m.value != null)
    .map((m) => attendanceText.rateLine(formatMonth(m.key), formatPercent(m.value)))
    .join(' ');

  // One column on phones (ordered by importance), two from lg.
  const left = 'contents lg:flex lg:flex-col lg:gap-4';
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      <div className={left}>
        <Card
          title={t.attendanceTitle}
          className="order-1 lg:order-none"
          actions={<MoreLink to={studentPaths.attendance()}>{t.seeCalendar}</MoreLink>}
        >
          {overview ? (
            <AttendanceOverview name={name} attendance={overview} />
          ) : (
            <p className="text-muted">{attendanceText.noClassesYet(name)}</p>
          )}
          {overview?.belowThreshold && (
            <Alert
              tone="warning"
              className="mt-4"
              title={attendanceText.below.title(name, overview.threshold)}
            >
              {attendanceText.below.body(name, formatPercent(overview.percent), overview.threshold)}
            </Alert>
          )}
        </Card>

        <Card title={t.alertsTitle} className="order-2 lg:order-none">
          {data.absenceAlerts.length ? (
            <AbsenceAlerts name={name} alerts={data.absenceAlerts} />
          ) : (
            <p className="text-muted">{t.alertsEmpty(name)}</p>
          )}
        </Card>

        {/* Nothing to chart before the first recorded month. */}
        {months.length > 0 && (
          <Card title={t.monthlyTitle} className="order-5 lg:order-none">
            <MonthBars
              items={months}
              threshold={attendance?.threshold}
              thresholdLabel={attendanceText.thresholdLegend(attendance?.threshold)}
              summary={monthSummary || attendanceText.monthlyEmpty}
            />
          </Card>
        )}

        <Card
          title={t.notificationsTitle}
          description={
            data.unreadNotifications ? t.unreadCount(data.unreadNotifications) : undefined
          }
          className="order-6 lg:order-none"
          actions={<MoreLink to={studentPaths.notifications()}>{t.allNotifications}</MoreLink>}
        >
          <NewForYou notifications={data.recentNotifications ?? []} />
        </Card>
      </div>

      <div className={left}>
        <Card
          title={t.meetingsTitle}
          className="order-3 lg:order-none"
          actions={<MoreLink to={studentPaths.meetings()}>{t.allMeetings}</MoreLink>}
        >
          {data.upcomingMeetings.length ? (
            <ul className="flex flex-col gap-3">
              {data.upcomingMeetings.map((m) => (
                <GuardianMeetingCard key={m._id} meeting={m} quickReply />
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-muted">
              <CalendarClock aria-hidden="true" className="size-5" />
              {t.meetingsEmpty}
            </p>
          )}
        </Card>

        <Card
          title={t.resultsTitle}
          className="order-4 lg:order-none"
          actions={<MoreLink to={studentPaths.results()}>{t.allResults}</MoreLink>}
        >
          {data.recentResults.length ? (
            <ul className="flex flex-col gap-3">
              {data.recentResults.slice(0, 3).map((r) => (
                <ResultCard key={r._id} result={r} compact />
              ))}
            </ul>
          ) : (
            <p className="text-muted">{t.resultsEmpty(name)}</p>
          )}
        </Card>

        {pinned.length > 0 && (
          <Card
            title={t.noticesTitle}
            className="order-7 lg:order-none"
            actions={<MoreLink to={studentPaths.notices()}>{t.allNotices}</MoreLink>}
          >
            <ul className="flex flex-col divide-y divide-line">
              {pinned.map((n) => (
                <li key={n._id} className="flex gap-3 py-2.5">
                  <Pin aria-hidden="true" className="mt-1 size-4 shrink-0 text-cerise-600" />
                  <div className="min-w-0">
                    <p className="font-semibold">{n.title}</p>
                    <p className="line-clamp-2 text-sm text-muted">{n.body}</p>
                    <p className="text-xs text-muted">
                      {formatSchoolDate(n.publishedAt ?? n.createdAt, { weekday: true })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

/** The guardian's home page (SRS §4): one request, GET /api/dashboard/student. */
export default function StudentDashboardPage() {
  const child = useChild();
  const dashboard = useDashboard(ROLES.STUDENT);
  return (
    <>
      <PageHeader title={t.title(child.displayName)} description={t.description} />
      <QueryState query={dashboard} loading={<DashboardSkeleton />}>
        {(data) => <Dashboard data={data} name={child.displayName} />}
      </QueryState>
    </>
  );
}
