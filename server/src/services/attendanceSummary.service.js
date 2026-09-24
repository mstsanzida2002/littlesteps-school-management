/**
 * Attendance summaries (FR-TCH-07, FR-STU-02/03, SRS 3.6) via aggregation pipelines.
 * Only recorded classes count; `lateCountsAsPresent` comes from Settings; zero recorded classes
 * give percent: null. Months use $dateToString in UTC, which is the school calendar month
 * because dates are stored as UTC midnight of the Asia/Dhaka date.
 */
import mongoose from 'mongoose';

import { Attendance, Settings, StudentProfile } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { toDateKey, toSchoolDate } from '../utils/date.js';
import {
  attendanceRate,
  MIN_RECORDED_DAYS_FOR_WARNING,
  statusCounters,
} from './attendanceRules.js';
import { requireActiveSession } from './lookup.service.js';

const oid = (id) => new mongoose.Types.ObjectId(String(id));

function dateRange({ from, to }) {
  if (!from && !to) return {};
  const date = {};
  if (from) date.$gte = toSchoolDate(from);
  if (to) date.$lte = toSchoolDate(to);
  return { date };
}

const withRate = (row, late) => {
  const { _id, ...counts } = row;
  const base = { total: 0, present: 0, absent: 0, late: 0, ...counts };
  return { ...base, ...attendanceRate(base, late) };
};

/** GET /api/attendance/student/:studentId/summary */
export async function studentSummary(studentId, query = {}) {
  const [settings, activeSession] = await Promise.all([Settings.get(), requireActiveSession()]);
  const profile = await StudentProfile.findOne({ userId: studentId, sessionId: activeSession._id })
    .populate('userId', 'name')
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .lean();
  if (!profile) throw ApiError.notFound('Student is not enrolled in the active session');

  const late = settings.lateCountsAsPresent;
  const [facets] = await Attendance.aggregate([
    { $match: { studentId: oid(studentId), sessionId: activeSession._id, ...dateRange(query) } },
    {
      $facet: {
        overall: [{ $group: { _id: null, ...statusCounters, days: { $addToSet: '$date' } } }],
        bySubject: [
          { $group: { _id: '$subjectId', ...statusCounters } },
          { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subject' } },
          { $set: { subject: { $first: '$subject' } } },
          { $sort: { 'subject.name': 1 } },
        ],
        byMonth: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'UTC' } },
              ...statusCounters,
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const { days = [], ...overallCounts } = facets.overall[0] ?? {};
  const recordedDays = days.length;
  const overall = withRate(overallCounts, late);
  const belowThreshold =
    recordedDays >= MIN_RECORDED_DAYS_FOR_WARNING &&
    overall.percent !== null &&
    overall.percent < settings.attendanceThreshold;

  return {
    student: {
      id: studentId,
      name: profile.userId.name,
      classSection: `${profile.classId.name}-${profile.sectionId.name}`,
      rollNo: profile.rollNo,
    },
    session: activeSession.name,
    range: { from: query.from ?? null, to: query.to ?? null },
    lateCountsAsPresent: late,
    threshold: settings.attendanceThreshold,
    recordedDays,
    belowThreshold,
    overall,
    bySubject: facets.bySubject.map(({ subject, ...row }) => ({
      subject: { _id: subject?._id, name: subject?.name },
      ...withRate(row, late),
    })),
    byMonth: facets.byMonth.map((row) => ({ month: row._id, ...withRate(row, late) })),
  };
}

/** GET /api/attendance/student/:studentId/history — records for the calendar view. */
export async function studentHistory(studentId, query = {}) {
  const activeSession = await requireActiveSession();
  const records = await Attendance.find({
    studentId,
    sessionId: activeSession._id,
    ...dateRange(query),
  })
    .populate('subjectId', 'name')
    .populate('teacherId', 'name')
    .sort({ date: -1, markedAt: 1 })
    .lean();
  return records.map((r) => ({
    _id: r._id,
    date: toDateKey(r.date),
    subject: r.subjectId?.name,
    teacher: r.teacherId?.name,
    status: r.status,
  }));
}

/** GET /api/attendance/class-sections/:classId/:sectionId/summary */
export async function classSectionSummary({ classId, sectionId, subjectId, ...range }) {
  const [settings, activeSession] = await Promise.all([Settings.get(), requireActiveSession()]);
  const late = settings.lateCountsAsPresent;
  const match = {
    classId: oid(classId),
    sectionId: oid(sectionId),
    sessionId: activeSession._id,
    ...dateRange(range),
    ...(subjectId && { subjectId: oid(subjectId) }),
  };

  const [facets] = await Attendance.aggregate([
    { $match: match },
    {
      $facet: {
        daily: [{ $group: { _id: '$date', ...statusCounters } }, { $sort: { _id: 1 } }],
        students: [{ $group: { _id: '$studentId', ...statusCounters } }],
      },
    },
  ]);

  const profiles = await StudentProfile.find({ classId, sectionId, sessionId: activeSession._id })
    .populate('userId', 'name')
    .sort({ rollNo: 1 })
    .lean();
  const perStudent = new Map(facets.students.map((row) => [String(row._id), row]));

  return {
    session: activeSession.name,
    lateCountsAsPresent: late,
    threshold: settings.attendanceThreshold,
    daily: facets.daily.map((row) => ({ date: toDateKey(row._id), ...withRate(row, late) })),
    // Every enrolled student appears, including those with no recorded classes (percent null).
    students: profiles.map((p) => {
      const stats = withRate(perStudent.get(String(p.userId._id)) ?? {}, late);
      return {
        studentId: p.userId._id,
        name: p.userId.name,
        rollNo: p.rollNo,
        ...stats,
        belowThreshold: stats.percent !== null && stats.percent < settings.attendanceThreshold,
        warned: Boolean(p.attendanceAlert?.belowThreshold),
      };
    }),
  };
}
