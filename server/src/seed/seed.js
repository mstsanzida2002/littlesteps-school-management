/**
 * Development seed.
 *
 *   npm run seed             # refuses if the database already has data
 *   npm run seed -- --reset  # clears LittleSteps collections first (re-runnable)
 *   npm run seed -- --reset --large   # ~500 students, for performance testing
 *
 * Safety: never runs with NODE_ENV=production, and only writes to databases whose name
 * ends in _dev or _test.
 */
import mongoose from 'mongoose';

import { ACCOUNT_STATUS, ATTENDANCE_STATUS, ROLES } from '../config/constants.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import * as models from '../models/index.js';
import { addDays, atSchoolTime, toDateKey, todaySchoolDate, weekdayOf } from '../utils/date.js';
import { markAllApplied } from '../migrations/runner.js';
import { hashPassword } from '../utils/password.js';
import { insertInBatches, seedDemoContent } from './demoContent.js';
import {
  ADMIN,
  AREAS,
  BOY_NAMES,
  CLASSES,
  FATHER_NAMES,
  GIRL_NAMES,
  LARGE_STUDENTS_PER_SECTION,
  LOW_ATTENDANCE,
  MOTHER_NAMES,
  SURNAMES,
  PASSWORDS,
  PERIOD_MINUTES,
  SCHOOL_DAYS,
  SECTION_NAMES,
  SHIFT_START,
  SIBLING_OF,
  STUDENTS,
  SUBJECTS,
  TEACHERS,
} from './seedData.js';

const {
  AcademicSession,
  Attendance,
  Class,
  Section,
  Settings,
  StudentProfile,
  Subject,
  TeacherAssignment,
  TeacherProfile,
  User,
} = models;

const SAFE_DB_NAME = /_(dev|test)$/;
const ATTENDANCE_DAYS_BACK = 30;
const LARGE = process.argv.includes('--large');
const STUDENTS_PER_SECTION = LARGE ? LARGE_STUDENTS_PER_SECTION : 5;

// Deterministic PRNG (mulberry32) so every run produces the same data for the same dates.
function createRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = createRandom(20260101);
const randomInt = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (list) => list[Math.floor(random() * list.length)];
const pad = (n, width = 2) => String(n).padStart(width, '0');

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function addMinutesToTime(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function bdMobile() {
  return `01${pick(['3', '5', '6', '7', '8', '9'])}${pad(randomInt(0, 99_999_999), 8)}`;
}

/** insertMany in batches of 5,000, returning the inserted documents in order. */
async function insertManyReturning(Model, docs) {
  const inserted = [];
  for (let i = 0; i < docs.length; i += 5_000) {
    inserted.push(...(await Model.insertMany(docs.slice(i, i + 5_000))));
  }
  return inserted;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------

async function main() {
  const reset = process.argv.includes('--reset');

  if (env.isProd) return fail('Refusing to seed: NODE_ENV=production.');
  if (!env.MONGODB_URI) return fail('MONGODB_URI is not set (see server/.env.example).');

  await connectDB();
  const dbName = mongoose.connection.name;
  console.log(`\nConnected database: "${dbName}" on ${mongoose.connection.host}`);

  if (!SAFE_DB_NAME.test(dbName)) {
    return fail(
      `Refusing to seed "${dbName}": the database name must end in _dev or _test. ` +
        'Put the name in MONGODB_URI, e.g. .../littlesteps_dev?retryWrites=true',
    );
  }

  if (reset) {
    console.log('--reset: clearing LittleSteps collections…');
    // Sequential on purpose: the free Atlas tier (M0) throttles bursts of parallel operations.
    for (const model of Object.values(models)) await model.deleteMany({});
  } else if (await User.exists({})) {
    return fail(`"${dbName}" already has data. Re-run with --reset to clear and reseed.`);
  }

  for (const model of Object.values(models)) await model.syncIndexes();
  // Fresh data already has the current schema: record every migration as applied.
  const baseline = await markAllApplied();
  console.log(`Migrations marked as applied (baseline): ${baseline.join(', ') || 'none'}`);

  const [adminHash, teacherHash, studentHash] = await Promise.all([
    hashPassword(PASSWORDS.admin),
    hashPassword(PASSWORDS.teacher),
    hashPassword(PASSWORDS.student),
  ]);

  // --- Settings & session ---------------------------------------------------
  const settings = await Settings.get();
  const today = todaySchoolDate();
  const firstDay = addDays(today, -ATTENDANCE_DAYS_BACK);
  const startYear = Number(toDateKey(firstDay).slice(0, 4));
  const endYear = Number(toDateKey(today).slice(0, 4));
  const session = await AcademicSession.create({
    name: startYear === endYear ? String(endYear) : `${startYear}-${endYear}`,
    startDate: `${startYear}-01-01`,
    endDate: `${endYear}-12-31`,
    isActive: true,
  });

  // --- Admin ----------------------------------------------------------------
  const admin = await User.create({
    ...ADMIN,
    passwordHash: adminHash,
    role: ROLES.ADMIN,
    status: ACCOUNT_STATUS.ACTIVE,
  });

  // --- Academic structure ---------------------------------------------------
  const classes = await Class.insertMany(
    CLASSES.map(({ name, order }) => ({ name, order, description: `${name} class` })),
  );
  const subjects = await Subject.insertMany(SUBJECTS);
  const sections = await Section.insertMany(
    classes.flatMap((cls) =>
      SECTION_NAMES.map((name) => ({ classId: cls._id, name, capacity: LARGE ? 70 : 25 })),
    ),
  );
  const sectionOf = (classIdx, sectionName) =>
    sections.find((s) => s.classId.equals(classes[classIdx]._id) && s.name === sectionName);

  // --- Teachers & assignments -----------------------------------------------
  const teachers = await User.insertMany(
    TEACHERS.map(({ name, username, phone }) => ({
      name,
      username,
      phone,
      email: `${username}@littlesteps.test`,
      passwordHash: teacherHash,
      role: ROLES.TEACHER,
      status: ACCOUNT_STATUS.ACTIVE,
      createdBy: admin._id,
    })),
  );
  await TeacherProfile.insertMany(
    teachers.map((teacher, i) => ({
      userId: teacher._id,
      employeeId: `T-${pad(i + 1, 3)}`,
      qualification: TEACHERS[i].qualification,
      joiningDate: `${endYear - 1 - i}-01-${pad(10 + i)}`,
    })),
  );

  // Each teacher is class teacher for one class: both sections, every subject, Sun–Thu.
  const assignmentDocs = [];
  classes.forEach((cls, classIdx) => {
    for (const sectionName of SECTION_NAMES) {
      subjects.forEach((subject, period) => {
        const startTime = addMinutesToTime(SHIFT_START[sectionName], period * PERIOD_MINUTES);
        assignmentDocs.push({
          teacherId: teachers[classIdx]._id,
          classId: cls._id,
          sectionId: sectionOf(classIdx, sectionName)._id,
          subjectId: subject._id,
          sessionId: session._id,
          schedule: SCHOOL_DAYS.map((day) => ({
            day,
            startTime,
            endTime: addMinutesToTime(startTime, PERIOD_MINUTES),
          })),
        });
      });
    }
  });
  const assignments = await TeacherAssignment.insertMany(assignmentDocs);

  // --- Students --------------------------------------------------------------
  // Normal: the 40 named demo students. Large: synthetic names for 8 sections × 63 students,
  // with ~5% deliberately low attendance.
  const studentList = LARGE
    ? Array.from(
        { length: CLASSES.length * SECTION_NAMES.length * STUDENTS_PER_SECTION },
        (_, i) => {
          const girl = i % 2 === 1;
          const surname = SURNAMES[i % SURNAMES.length];
          const first = (girl ? GIRL_NAMES : BOY_NAMES)[Math.floor(i / 2) % BOY_NAMES.length];
          return {
            name: `${first} ${surname}`,
            gender: girl ? 'female' : 'male',
            father: `${FATHER_NAMES[i % FATHER_NAMES.length]} ${surname}`,
            mother: MOTHER_NAMES[i % MOTHER_NAMES.length],
            guardian: i % 3 === 0 ? 'father' : 'mother',
          };
        },
      )
    : STUDENTS;
  const lowAttendance = LARGE
    ? Object.fromEntries(
        studentList.flatMap((_, i) => (random() < 0.05 ? [[i, 0.55 + random() * 0.15]] : [])),
      )
    : LOW_ATTENDANCE;
  const guardianContacts = studentList.map((s) => ({
    phone: bdMobile(),
    email:
      random() < 0.6
        ? `${s.father
            .replace(/^Md\.\s*/, '')
            .split(' ')[0]
            .toLowerCase()}${randomInt(10, 99)}@gmail.com`
        : undefined,
    address: pick(AREAS),
  }));
  if (!LARGE) {
    for (const [studentIdx, siblingIdx] of Object.entries(SIBLING_OF)) {
      guardianContacts[studentIdx] = guardianContacts[siblingIdx];
    }
  }

  const studentRows = studentList.map((student, i) => {
    const classIdx = Math.floor(i / (STUDENTS_PER_SECTION * SECTION_NAMES.length));
    const sectionName = SECTION_NAMES[Math.floor(i / STUDENTS_PER_SECTION) % SECTION_NAMES.length];
    const rollNo = (i % STUDENTS_PER_SECTION) + 1;
    const { code, age } = CLASSES[classIdx];
    return {
      student,
      classIdx,
      sectionName,
      rollNo,
      username: `${code}-${sectionName.toLowerCase()}-${pad(rollNo)}`,
      birthYear: endYear - age - (random() < 0.4 ? 1 : 0),
      contact: guardianContacts[i],
    };
  });

  const studentUsers = await insertManyReturning(
    User,
    studentRows.map(({ student, username, contact }) => ({
      name: student.name,
      username,
      phone: contact.phone,
      passwordHash: studentHash,
      role: ROLES.STUDENT,
      status: ACCOUNT_STATUS.ACTIVE,
      createdBy: admin._id,
    })),
  );

  await insertInBatches(
    StudentProfile,
    studentRows.map((row, i) => ({
      userId: studentUsers[i]._id,
      rollNo: row.rollNo,
      classId: classes[row.classIdx]._id,
      sectionId: sectionOf(row.classIdx, row.sectionName)._id,
      sessionId: session._id,
      dateOfBirth: `${row.birthYear}-${pad(randomInt(1, 12))}-${pad(randomInt(1, 28))}`,
      gender: row.student.gender,
      admissionDate: `${endYear - row.classIdx}-01-${pad(randomInt(2, 12))}`,
      guardian: {
        name: row.student[row.student.guardian],
        relation: row.student.guardian,
        phone: row.contact.phone,
        email: row.contact.email,
        address: row.contact.address,
      },
    })),
  );

  // --- Attendance: last 30 calendar days before today, school days only -------
  const schoolDays = [];
  for (let d = ATTENDANCE_DAYS_BACK; d >= 1; d -= 1) {
    const date = addDays(today, -d);
    if (!settings.weeklyOffDays.includes(weekdayOf(date))) schoolDays.push(date);
  }

  const attendanceDocs = [];
  const summary = [];
  studentRows.forEach((row, i) => {
    const sectionId = sectionOf(row.classIdx, row.sectionName)._id;
    const sectionAssignments = assignments
      .filter((a) => a.sectionId.equals(sectionId))
      .sort((a, b) => a.schedule[0].startTime.localeCompare(b.schedule[0].startTime));

    // Whole-day absences, placed at random school days.
    const targetRatio = lowAttendance[i];
    const absentCount =
      targetRatio !== undefined
        ? Math.ceil(schoolDays.length * (1 - targetRatio))
        : randomInt(0, 2);
    const absentDays = new Set(shuffle(schoolDays.map((_, idx) => idx)).slice(0, absentCount));

    let attended = 0;
    schoolDays.forEach((date, dayIdx) => {
      const absent = absentDays.has(dayIdx);
      const lateToday = !absent && random() < 0.06;
      if (!absent) attended += 1;

      sectionAssignments.forEach((assignment, period) => {
        let status = ATTENDANCE_STATUS.PRESENT;
        if (absent) status = ATTENDANCE_STATUS.ABSENT;
        else if (lateToday && period === 0) status = ATTENDANCE_STATUS.LATE;

        attendanceDocs.push({
          studentId: studentUsers[i]._id,
          classId: assignment.classId,
          sectionId,
          subjectId: assignment.subjectId,
          sessionId: session._id,
          teacherId: assignment.teacherId,
          date,
          status,
          markedAt: atSchoolTime(date, addMinutesToTime(assignment.schedule[0].startTime, 5)),
        });
      });
    });
    summary.push({ row, percent: schoolDays.length ? (attended / schoolDays.length) * 100 : 0 });
  });
  await insertInBatches(Attendance, attendanceDocs);

  // --- Demo results, meetings, notices ------------------------------------------
  const demo = await seedDemoContent({
    admin,
    teachers,
    classes,
    sections,
    subjects,
    session,
    settings,
    schoolDays,
    random,
    large: LARGE,
    students: studentRows.map((row, i) => ({
      user: studentUsers[i],
      classId: classes[row.classIdx]._id,
      sectionId: sectionOf(row.classIdx, row.sectionName)._id,
    })),
  });

  // --- Report ----------------------------------------------------------------
  const below = summary.filter((s) => s.percent < settings.attendanceThreshold);

  console.log('\n✔ Seed complete');
  console.log(`  Session            ${session.name} (active)`);
  console.log(`  Classes/sections   ${classes.length} / ${sections.length}`);
  console.log(`  Subjects           ${subjects.map((s) => s.name).join(', ')}`);
  console.log(`  Teacher assignments ${assignments.length}`);
  console.log(`  Students           ${studentUsers.length}`);
  console.log(
    `  Attendance         ${attendanceDocs.length} records over ${schoolDays.length} school days ` +
      `(${toDateKey(schoolDays[0])} → ${toDateKey(schoolDays.at(-1))}, off: ${settings.weeklyOffDays.join('/')}; today left unmarked)`,
  );
  console.log(
    `  Demo content       ${demo.assessments} assessments (${demo.results} results), ` +
      `${demo.meetings} meetings, ${demo.notices} notices, ${demo.notifications} notifications`,
  );
  console.log(`\n  Below ${settings.attendanceThreshold}% attendance: ${below.length} students`);
  for (const { row, percent } of below.slice(0, 10)) {
    console.log(
      `    ${row.student.name.padEnd(22)} ${CLASSES[row.classIdx].name}-${row.sectionName}  ${percent.toFixed(1)}%`,
    );
  }

  const credentialRows = [
    ['admin', ADMIN.name, ADMIN.username, PASSWORDS.admin, ''],
    ...teachers.map((t, i) => ['teacher', t.name, t.username, PASSWORDS.teacher, CLASSES[i].name]),
    // Large seed: only rolls 1–2 of each section are listed (the pattern covers the rest).
    ...(LARGE ? studentRows.filter((r) => r.rollNo <= 2) : studentRows).map((r) => [
      'student',
      r.student.name,
      r.username,
      PASSWORDS.student,
      `${CLASSES[r.classIdx].name}-${r.sectionName} #${r.rollNo}`,
    ]),
  ];
  console.log('\n  Login credentials (development only)');
  console.log(
    `  ${'ROLE'.padEnd(8)} ${'NAME'.padEnd(24)} ${'USERNAME'.padEnd(16)} ${'PASSWORD'.padEnd(13)} CLASS`,
  );
  for (const [role, name, username, password, cls] of credentialRows) {
    console.log(
      `  ${role.padEnd(8)} ${name.padEnd(24)} ${username.padEnd(16)} ${password.padEnd(13)} ${cls}`,
    );
  }
  if (LARGE) {
    console.log(
      `  … every other student follows <class>-<section>-01…${STUDENTS_PER_SECTION} / ${PASSWORDS.student}`,
    );
  }
  console.log(
    `\n  Teachers and the admin can also log in by email (<username>@littlesteps.test / ${ADMIN.email}).\n`,
  );
}

main()
  .catch((err) => {
    console.error('\n✖ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
