import { useState } from 'react';

import { MonthBars } from '../../components/charts/MonthBars.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { AttendanceOverview } from '../../features/attendance/components/AttendanceOverview.jsx';
import { MonthCalendar } from '../../features/attendance/components/MonthCalendar.jsx';
import { monthDays } from '../../features/attendance/guardianDays.js';
import { text as attendanceText } from '../../features/attendance/text/index.js';
import { ReplyBadge } from '../../features/meetings/components/GuardianMeeting.jsx';
import { Remarks, ResultFigure } from '../../features/results/components/GuardianResult.jsx';
import { Example, Section } from './Section.jsx';

const TODAY = '2026-09-24';
const record = (date, subject, status) => ({ _id: `${date}-${subject}`, date, subject, status });
const HISTORY = [
  record('2026-09-22', 'English', 'present'),
  record('2026-09-22', 'Math', 'present'),
  record('2026-09-21', 'English', 'late'),
  record('2026-09-21', 'Math', 'present'),
  record('2026-09-20', 'English', 'absent'),
  record('2026-09-20', 'Math', 'present'),
  record('2026-09-17', 'English', 'absent'),
  record('2026-09-17', 'Math', 'absent'),
];
const DAYS = monthDays({
  month: '2026-09',
  history: HISTORY,
  offDays: ['friday', 'saturday'],
  today: TODAY,
  from: '2026-09-06',
  to: '2026-12-31',
});
const RESULT = {
  attendance: 'present',
  marksObtained: 18,
  percent: 90,
  grade: 'A+',
  remarks: 'খুব সুন্দর হাতের লেখা। Keep reading every night!',
  assessment: { mode: 'marks', totalMarks: 20 },
};

export function GuardianSection() {
  const [day, setDay] = useState('2026-09-20');
  return (
    <Section
      id="guardian"
      title="Guardian building blocks"
      description="Plain-language pieces for parents on phones: the attendance headline, the month calendar (a status per day, icon + label), CSS month bars (no chart library), results with remarks, and reply badges. Text comes from each feature's text module."
    >
      <Example
        title="Attendance headline (and nothing recorded yet)"
        className="grid gap-4 md:grid-cols-2"
      >
        <Card>
          <AttendanceOverview
            name="Oishi"
            attendance={{
              percent: 82,
              present: 60,
              absent: 12,
              late: 4,
              threshold: 75,
              belowThreshold: false,
            }}
          />
        </Card>
        <Card>
          <AttendanceOverview name="Nabil" attendance={{ percent: null, threshold: 75 }} />
        </Card>
      </Example>
      <Example title="Month calendar" className="max-w-md">
        <MonthCalendar month="2026-09" days={DAYS} today={TODAY} selected={day} onSelect={setDay} />
      </Example>
      <Example title="Day statuses" className="flex flex-wrap gap-2">
        {Object.keys(attendanceText.dayStatus).map((status) => (
          <StatusBadge
            key={status}
            group="day"
            value={status}
            label={attendanceText.dayStatus[status]}
          />
        ))}
      </Example>
      <Example title="Month bars" className="max-w-md">
        <MonthBars
          threshold={75}
          thresholdLabel={attendanceText.thresholdLegend(75)}
          items={[
            { key: '2026-07', label: 'Jul', value: 96 },
            { key: '2026-08', label: 'Aug', value: 68.4 },
            { key: '2026-09', label: 'Sep', value: 88 },
          ]}
        />
      </Example>
      <Example
        title="A result: grade, marks, remarks; absent"
        className="grid gap-4 md:grid-cols-2"
      >
        <Card className="flex flex-col gap-3">
          <ResultFigure result={RESULT} size="lg" />
          <Remarks remarks={RESULT.remarks} />
        </Card>
        <Card>
          <ResultFigure result={{ ...RESULT, attendance: 'absent' }} />
        </Card>
      </Example>
      <Example title="Meeting replies" className="flex flex-wrap gap-2">
        <ReplyBadge response="will_attend" />
        <ReplyBadge response="cannot_attend" />
        <ReplyBadge response={null} />
      </Example>
    </Section>
  );
}
