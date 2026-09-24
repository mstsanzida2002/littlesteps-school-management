import {
  AcademicSession,
  Attendance,
  Settings,
  StudentProfile,
  TeacherAssignment,
} from '../../src/models/index.js';
import { addDays, toDateKey, todaySchoolDate, weekdayOf } from '../../src/utils/date.js';
import { createUser } from './factories.js';
import { createSchool, guardian } from './school.js';

const OFF_DAYS = ['friday', 'saturday'];
export const isSchoolDay = (date) => !OFF_DAYS.includes(weekdayOf(date));

/** The n most recent school days up to and including today (newest first). */
export function recentSchoolDays(n, { from = todaySchoolDate() } = {}) {
  const days = [];
  for (let d = from; days.length < n; d = addDays(d, -1)) if (isSchoolDay(d)) days.push(d);
  return days;
}

/** The most recent off day (Friday/Saturday) on or before today. */
export function recentOffDay() {
  for (let d = todaySchoolDate(); ; d = addDays(d, -1)) if (!isSchoolDay(d)) return d;
}

/**
 * createSchool() plus: the active session spans today ±90 days, three students enrolled in
 * Playgroup-A (rolls 1–3, admitted 90 days ago, guardian email on the first only), a second
 * teacher, and the chosen marking day (the most recent school day).
 */
export async function createAttendanceSchool() {
  const school = await createSchool();
  const today = todaySchoolDate();
  await AcademicSession.updateOne(
    { _id: school.session._id },
    { startDate: addDays(today, -90), endDate: addDays(today, 90) },
  );
  school.session = await AcademicSession.findById(school.session._id);
  await Settings.get();

  const names = ['Ayaan Rahman', 'Nusrat Jahan', 'Arham Hossain'];
  const students = [];
  for (const [i, name] of names.entries()) {
    const user = await createUser({ role: 'student', name });
    await StudentProfile.create({
      userId: user._id,
      rollNo: i + 1,
      classId: school.classes.playgroup._id,
      sectionId: school.sections.pgA._id,
      sessionId: school.session._id,
      dateOfBirth: '2022-01-01',
      admissionDate: toDateKey(addDays(today, -90)),
      guardian: i === 0 ? { ...guardian, email: 'sharmin@example.com' } : guardian,
    });
    students.push(user);
  }
  const secondTeacher = await createUser({ role: 'teacher', name: 'Nasrin Sultana' });
  const [day] = recentSchoolDays(1);
  return {
    ...school,
    students,
    secondTeacher,
    day,
    dayKey: toDateKey(day),
    weekday: weekdayOf(day),
  };
}

/** Assign a teacher to Playgroup-A for a subject, scheduled on the given weekdays. */
export function assign(
  school,
  { teacher = school.teacher, subject, days = [], start = '08:00', end = '08:30' },
) {
  return TeacherAssignment.create({
    teacherId: teacher._id,
    classId: school.classes.playgroup._id,
    sectionId: school.sections.pgA._id,
    subjectId: school.subjects[subject]._id,
    sessionId: school.session._id,
    schedule: days.map((day) => ({ day, startTime: start, endTime: end })),
  });
}

/** Insert raw attendance history (bypasses the API) for summary / warning set-ups. */
export function insertAttendance(school, rows) {
  return Attendance.insertMany(
    rows.map(({ student, subject = 'english', date, status, teacher = school.teacher }) => ({
      studentId: student._id,
      classId: school.classes.playgroup._id,
      sectionId: school.sections.pgA._id,
      subjectId: school.subjects[subject]._id,
      sessionId: school.session._id,
      teacherId: teacher._id,
      date,
      status,
    })),
  );
}

export const markBody = (school, overrides = {}) => ({
  classId: String(school.classes.playgroup._id),
  sectionId: String(school.sections.pgA._id),
  date: school.dayKey,
  ...overrides,
});
