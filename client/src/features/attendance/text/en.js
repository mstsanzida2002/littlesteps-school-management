/** Guardian-facing attendance text (the calendar, day details, warnings, absence alerts). */
export default {
  title: 'Attendance',
  description: (name, schoolYear) => `${name}'s classes in the ${schoolYear} school year.`,
  loading: 'Loading attendance',
  summaryTitle: 'This school year',
  attended: (name, percent, threshold) =>
    `${name} attended ${percent} of classes. The school expects at least ${threshold}%.`,
  noClassesYet: (name) =>
    `No classes have been recorded for ${name} yet. Attendance will show here after the first school day.`,
  counts: { present: 'Present', absent: 'Absent', late: 'Late' },
  countsHint: 'Counted per class: each subject on a school day is one class.',
  lateCounts: 'Late arrivals count as attended.',
  lateDoesNotCount: 'Late arrivals do not count as attended.',
  below: {
    title: (name, threshold) => `${name}'s attendance is below ${threshold}%`,
    body: (name, percent, threshold) =>
      `${name} attended ${percent} of classes so far. The school expects at least ${threshold}%. ` +
      'Coming to school regularly helps young children settle in and keep up with friends. ' +
      `If something is keeping ${name} at home, please talk to the class teacher. They are happy to help.`,
  },
  // Calendar day statuses (config/statuses.js group "day" gives the icon and tone).
  dayStatus: {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    partial: 'Part of the day',
    no_class: 'No class',
    off_day: 'Off day',
  },
  // One subject's record on a day.
  recordStatus: { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' },
  thresholdLegend: (threshold) => `${threshold}% expected`,
  calendarTitle: 'Calendar',
  weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  // counts: { present, late, partial, absent } school days in the month
  monthSummary: (month, counts) => {
    const days = (n) => (n === 1 ? '1 day' : `${n} days`);
    const parts = [
      counts.present && `${days(counts.present)} present`,
      counts.late && `${days(counts.late)} late`,
      counts.partial && `${days(counts.partial)} absent for part of the day`,
      counts.absent && `${days(counts.absent)} absent`,
    ].filter(Boolean);
    return parts.length ? `${month}: ${parts.join(', ')}.` : `${month}: nothing recorded.`;
  },
  dayLabel: (date, status) => `${date}: ${status}`,
  noStatus: 'No school day',
  legendTitle: 'What the colours and icons mean',
  day: {
    title: (date) => date,
    subjects: 'Classes',
    by: (teacher) => `with ${teacher}`,
    noClass: 'No classes were recorded on this day.',
    offDay: 'Off day: there is no school on this day of the week.',
    future: 'This day has not happened yet.',
    close: 'Close',
  },
  bySubjectTitle: 'By subject',
  bySubjectEmpty: 'Nothing recorded yet.',
  columns: {
    subject: 'Subject',
    attended: 'Attended',
    absent: 'Absent',
    late: 'Late',
    percent: 'Attendance',
    month: 'Month',
  },
  attendedOf: (attended, total) => `${attended} of ${total}`,
  monthlyTitle: 'Month by month',
  monthlyEmpty: 'Nothing recorded yet.',
  monthlySummary: (parts) => parts.join(' '),
  rateLine: (label, percent) => `${label}: ${percent}.`,
  // Absence alerts (dashboard), from absence notifications.
  alert: {
    absent: (name, date) => `${name} was absent on ${date}`,
    subjects: (list) => `Missed: ${list}`,
    corrected: (name, date) => `${name} was marked present on ${date} after a correction`,
    unread: 'New',
  },
};
