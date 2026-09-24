import { useSearchParams } from 'react-router';

import { MonthBars } from '../../../components/charts/MonthBars.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Skeleton, SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import {
  addMonthsToKey,
  formatMonth,
  isDateKey,
  isMonthKey,
  monthBounds,
  monthKeyOf,
} from '../../../utils/date.js';
import { formatNumber, formatPercent } from '../../../utils/format.js';
import { AttendanceOverview } from '../../attendance/components/AttendanceOverview.jsx';
import { DaySheet, MonthCalendar } from '../../attendance/components/MonthCalendar.jsx';
import { monthDays } from '../../attendance/guardianDays.js';
import {
  useStudentAttendanceHistory,
  useStudentAttendanceSummary,
} from '../../attendance/hooks/useAttendance.js';
import { text } from '../../attendance/text/index.js';
import { useSchoolSettings } from '../../school/hooks/useSchool.js';
import { ChildQuery } from '../components/ChildNotFound.jsx';
import { useChild } from '../hooks/useStudent.js';

function Loading() {
  return (
    <div aria-busy="true" aria-label={text.loading} className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <Skeleton className="h-[26rem] rounded-card" />
      <div className="flex flex-col gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

const maxKey = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
const minKey = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

/** The month calendar and the day sheet; the month and the open day live in the URL. */
function CalendarCard({ childId, settings, admissionDate }) {
  const [params, setParams] = useSearchParams();
  const today = settings.today;
  const from = maxKey(settings.session?.startDate, admissionDate);
  const to = settings.session?.endDate;
  const firstMonth = from ? monthKeyOf(from) : monthKeyOf(today);
  const lastMonth = monthKeyOf(minKey(today, to) ?? today);

  const wanted = params.get('month');
  let month = isMonthKey(wanted) ? wanted : lastMonth;
  if (month < firstMonth) month = firstMonth;
  if (month > lastMonth) month = lastMonth;
  const dayParam = params.get('day');
  const day = isDateKey(dayParam) && monthKeyOf(dayParam) === month ? dayParam : null;

  const history = useStudentAttendanceHistory(childId, monthBounds(month));
  const days = monthDays({
    month,
    history: history.data ?? [],
    offDays: settings.weeklyOffDays,
    today,
    from,
    to,
  });
  const openDay = day ? days.find((d) => d.date === day) : null;

  const go = (next) => setParams({ month: next }, { replace: true });
  return (
    <Card title={text.calendarTitle} className="order-2 lg:order-none">
      {history.isPending ? (
        <Skeleton className="h-80 rounded-card" />
      ) : (
        <MonthCalendar
          month={month}
          days={days}
          today={today}
          selected={day}
          onSelect={(date) => setParams({ month, day: date })}
          onPrev={month > firstMonth ? () => go(addMonthsToKey(month, -1)) : undefined}
          onNext={month < lastMonth ? () => go(addMonthsToKey(month, 1)) : undefined}
        />
      )}
      <DaySheet
        day={openDay}
        today={today}
        onClose={() => setParams({ month }, { replace: true })}
      />
    </Card>
  );
}

export default function ChildAttendancePage() {
  const child = useChild();
  const name = child.displayName;
  const summary = useStudentAttendanceSummary(child.id);
  const settings = useSchoolSettings();

  return (
    <ChildQuery
      query={summary}
      loading={
        <>
          <PageHeader title={text.title} />
          <Loading />
        </>
      }
    >
      {(data) => {
        const overview = {
          percent: data.overall.percent,
          present: data.overall.present,
          absent: data.overall.absent,
          late: data.overall.late,
          threshold: data.threshold,
          belowThreshold: data.belowThreshold,
        };
        const months = data.byMonth.map((m) => ({
          key: m.month,
          label: formatMonth(m.month, { short: true }),
          value: m.percent,
        }));
        return (
          <>
            <PageHeader title={text.title} description={text.description(name, data.session)} />
            {data.belowThreshold && (
              <Alert tone="warning" className="mb-4" title={text.below.title(name, data.threshold)}>
                {text.below.body(name, formatPercent(data.overall.percent), data.threshold)}
              </Alert>
            )}
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[3fr_2fr] lg:items-start">
              {settings.data ? (
                <CalendarCard
                  childId={child.id}
                  settings={settings.data}
                  admissionDate={data.student.admissionDate}
                />
              ) : (
                <Skeleton className="order-2 h-[26rem] rounded-card lg:order-none" />
              )}

              <div className="contents lg:flex lg:flex-col lg:gap-4">
                <Card title={text.summaryTitle} className="order-1 lg:order-none">
                  <AttendanceOverview name={name} attendance={overview} />
                  {data.overall.percent != null && (
                    <p className="mt-3 text-sm text-muted">
                      {text.countsHint}{' '}
                      {data.lateCountsAsPresent ? text.lateCounts : text.lateDoesNotCount}
                    </p>
                  )}
                </Card>

                <Card title={text.bySubjectTitle} className="order-3 lg:order-none">
                  <MonthBars
                    wideLabels
                    items={data.bySubject.map((r) => ({
                      key: r.subject._id,
                      label: r.subject.name,
                      value: r.percent,
                    }))}
                    threshold={data.threshold}
                    thresholdLabel={text.thresholdLegend(data.threshold)}
                    summary={
                      data.bySubject
                        .filter((r) => r.percent != null)
                        .map((r) => text.rateLine(r.subject.name, formatPercent(r.percent)))
                        .join(' ') || text.bySubjectEmpty
                    }
                    table={{
                      columns: [
                        text.columns.subject,
                        text.columns.attended,
                        text.columns.absent,
                        text.columns.late,
                        text.columns.percent,
                      ],
                      rows: data.bySubject.map((r) => [
                        r.subject.name,
                        text.attendedOf(formatNumber(r.attended), formatNumber(r.total)),
                        r.absent,
                        r.late,
                        formatPercent(r.percent),
                      ]),
                    }}
                  />
                </Card>

                <Card title={text.monthlyTitle} className="order-4 lg:order-none">
                  <MonthBars
                    items={months}
                    threshold={data.threshold}
                    thresholdLabel={text.thresholdLegend(data.threshold)}
                    summary={
                      months
                        .filter((m) => m.value != null)
                        .map((m) => text.rateLine(formatMonth(m.key), formatPercent(m.value)))
                        .join(' ') || text.monthlyEmpty
                    }
                    table={{
                      columns: [
                        text.columns.month,
                        text.columns.attended,
                        text.columns.absent,
                        text.columns.late,
                        text.columns.percent,
                      ],
                      rows: data.byMonth.map((m) => [
                        formatMonth(m.month),
                        text.attendedOf(m.attended, m.total),
                        m.absent,
                        m.late,
                        formatPercent(m.percent),
                      ]),
                    }}
                  />
                </Card>
              </div>
            </div>
          </>
        );
      }}
    </ChildQuery>
  );
}
