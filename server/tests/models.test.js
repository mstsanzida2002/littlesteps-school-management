import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  AcademicSession,
  Attendance,
  AuditLog,
  Meeting,
  Result,
  Section,
  Settings,
  StudentProfile,
  TeacherAssignment,
  User,
} from '../src/models/index.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

const oid = () => new mongoose.Types.ObjectId();
const DUPLICATE_KEY = { code: 11000 };

let counter = 0;
const userData = (overrides = {}) => {
  counter += 1;
  return {
    name: `User ${counter}`,
    username: `user${counter}`,
    passwordHash: 'hash',
    role: 'student',
    ...overrides,
  };
};

const studentProfileData = (overrides = {}) => ({
  userId: oid(),
  rollNo: 1,
  classId: oid(),
  sectionId: oid(),
  sessionId: oid(),
  dateOfBirth: '2021-03-14',
  admissionDate: '2026-01-05',
  guardian: { name: 'Rahima Begum', relation: 'mother', phone: '01712345678' },
  ...overrides,
});

describe('unique indexes reject duplicates', () => {
  it('Attendance (studentId, subjectId, date)', async () => {
    const base = {
      studentId: oid(),
      classId: oid(),
      sectionId: oid(),
      subjectId: oid(),
      sessionId: oid(),
      teacherId: oid(),
      date: '2026-09-23',
      status: 'present',
    };
    await Attendance.create(base);
    await expect(Attendance.create({ ...base, status: 'absent' })).rejects.toMatchObject(
      DUPLICATE_KEY,
    );
    // Same student + subject on another day, or another subject the same day, is fine.
    await Attendance.create({ ...base, date: '2026-09-24' });
    await Attendance.create({ ...base, subjectId: oid() });
  });

  it('TeacherAssignment (teacherId, classId, sectionId, subjectId, sessionId)', async () => {
    const base = {
      teacherId: oid(),
      classId: oid(),
      sectionId: oid(),
      subjectId: oid(),
      sessionId: oid(),
    };
    await TeacherAssignment.create(base);
    await expect(TeacherAssignment.create(base)).rejects.toMatchObject(DUPLICATE_KEY);
    await TeacherAssignment.create({ ...base, sessionId: oid() });
  });

  it('StudentProfile roll number per (classId, sectionId, sessionId)', async () => {
    const first = await StudentProfile.create(studentProfileData());
    const sameSlot = {
      classId: first.classId,
      sectionId: first.sectionId,
      sessionId: first.sessionId,
      rollNo: first.rollNo,
    };
    await expect(StudentProfile.create(studentProfileData(sameSlot))).rejects.toMatchObject(
      DUPLICATE_KEY,
    );
    // Same roll number in a different session is allowed.
    await StudentProfile.create(studentProfileData({ ...sameSlot, sessionId: oid() }));
  });

  it('StudentProfile userId (one profile per user)', async () => {
    const userId = oid();
    await StudentProfile.create(studentProfileData({ userId }));
    await expect(
      StudentProfile.create(studentProfileData({ userId, rollNo: 2 })),
    ).rejects.toMatchObject(DUPLICATE_KEY);
  });

  it('Section name per class', async () => {
    const classId = oid();
    await Section.create({ classId, name: 'A' });
    await expect(Section.create({ classId, name: 'a' })).rejects.toMatchObject(DUPLICATE_KEY);
    await Section.create({ classId: oid(), name: 'A' });
  });

  it('Result (assessmentId, studentId)', async () => {
    const base = { assessmentId: oid(), studentId: oid(), updatedBy: oid(), marksObtained: 8 };
    await Result.create(base);
    await expect(Result.create(base)).rejects.toMatchObject(DUPLICATE_KEY);
  });

  it('User username (case-insensitive) and email', async () => {
    await User.create(userData({ username: 'Farhana.Akter', email: 'Farhana@Example.com' }));
    await expect(User.create(userData({ username: 'farhana.akter' }))).rejects.toMatchObject(
      DUPLICATE_KEY,
    );
    await expect(User.create(userData({ email: 'farhana@example.com' }))).rejects.toMatchObject(
      DUPLICATE_KEY,
    );
  });

  it('Settings is a single document', async () => {
    await Settings.create({});
    await expect(Settings.create({})).rejects.toMatchObject(DUPLICATE_KEY);
  });
});

describe('User.email normalization', () => {
  it('lets many users have no email ("" / null / missing)', async () => {
    const a = await User.create(userData({ email: '' }));
    const b = await User.create(userData({ email: '' }));
    const c = await User.create(userData({ email: null }));
    const d = await User.create(userData({ email: '   ' }));
    await User.create(userData());

    for (const user of [a, b, c, d]) expect(user.email).toBeUndefined();
    const raw = await User.collection.find({ email: { $exists: true } }).toArray();
    expect(raw).toHaveLength(0);
  });
});

describe('User.passwordHash', () => {
  it('is hidden by default and only returned when explicitly selected', async () => {
    const { _id } = await User.create(userData({ passwordHash: 'secret-hash' }));

    const plain = await User.findById(_id);
    expect(plain.passwordHash).toBeUndefined();

    const lean = await User.findOne({ _id }).lean();
    expect(lean.passwordHash).toBeUndefined();

    const withHash = await User.findById(_id).select('+passwordHash');
    expect(withHash.passwordHash).toBe('secret-hash');
    // Never serialized to API responses, even when loaded.
    expect(withHash.toJSON().passwordHash).toBeUndefined();
  });
});

describe('AcademicSession', () => {
  const session = (name, isActive) => ({
    name,
    startDate: `${name}-01-01`,
    endDate: `${name}-12-31`,
    isActive,
  });

  it('allows only one active session', async () => {
    await AcademicSession.create(session('2026', true));
    await expect(AcademicSession.create(session('2027', true))).rejects.toMatchObject(
      DUPLICATE_KEY,
    );
  });

  it('allows any number of inactive sessions', async () => {
    await AcademicSession.create(session('2024', false));
    await AcademicSession.create(session('2025', false));
    await AcademicSession.create(session('2026', true));
    expect(await AcademicSession.countDocuments()).toBe(3);
  });

  it('rejects endDate before startDate', async () => {
    await expect(
      AcademicSession.create({ name: 'bad', startDate: '2026-12-31', endDate: '2026-01-01' }),
    ).rejects.toThrow(/endDate must be after startDate/);
  });
});

describe('Attendance.date (Asia/Dhaka calendar date)', () => {
  const base = () => ({
    studentId: oid(),
    classId: oid(),
    sectionId: oid(),
    subjectId: oid(),
    sessionId: oid(),
    teacherId: oid(),
    status: 'present',
  });

  it('normalizes an instant to its Dhaka calendar date at UTC midnight', async () => {
    // 20:30 UTC on the 22nd is 02:30 on the 23rd in Dhaka.
    const doc = await Attendance.create({ ...base(), date: new Date('2026-09-22T20:30:00Z') });
    expect(doc.date.toISOString()).toBe('2026-09-23T00:00:00.000Z');
  });

  it('matches date-key query filters through the same setter', async () => {
    await Attendance.create({ ...base(), date: '2026-09-23' });
    expect(await Attendance.countDocuments({ date: '2026-09-23' })).toBe(1);
  });

  it('rejects impossible calendar dates', async () => {
    await expect(Attendance.create({ ...base(), date: '2026-02-30' })).rejects.toThrow(
      mongoose.Error.ValidationError,
    );
  });
});

describe('Settings.get()', () => {
  it('creates the singleton with defaults once', async () => {
    const first = await Settings.get();
    const second = await Settings.get();

    expect(second._id.equals(first._id)).toBe(true);
    expect(await Settings.countDocuments()).toBe(1);
    expect(first.attendanceThreshold).toBe(75);
    expect(first.lateCountsAsPresent).toBe(true);
    expect(first.weeklyOffDays).toEqual(['friday', 'saturday']);
    expect(first.gradingScale[0]).toMatchObject({ grade: 'A+', minPercent: 80 });
  });

  it('rejects an invalid grading scale', async () => {
    await expect(
      Settings.create({ gradingScale: [{ grade: 'A', minPercent: 50 }] }),
    ).rejects.toThrow(/Grading scale/);
  });
});

describe('Meeting invite validation', () => {
  const meeting = (invite) => ({
    title: 'Parent-teacher meeting',
    type: 'parent_teacher',
    dateTime: new Date('2026-10-01T04:00:00Z'),
    venue: 'Nursery classroom',
    organizerId: oid(),
    sessionId: oid(),
    invite,
  });

  it('requires a selection for students/sections/classes targets', async () => {
    await expect(Meeting.create(meeting({ target: 'sections' }))).rejects.toThrow(/sectionIds/);
    await Meeting.create(meeting({ target: 'sections', sectionIds: [oid()] }));
    await Meeting.create(meeting({ target: 'all' }));
  });
});

describe('AuditLog', () => {
  it('is append-only', async () => {
    const log = await AuditLog.create({
      actorId: oid(),
      action: 'user.create',
      entityType: 'User',
    });
    await expect(AuditLog.updateOne({ _id: log._id }, { action: 'x' })).rejects.toThrow(
      /append-only/,
    );
    log.action = 'tampered';
    await expect(log.save()).rejects.toThrow(/append-only/);
  });
});
