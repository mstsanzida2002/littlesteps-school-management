/**
 * Dashboards (SRS §4): one request per role, everything fetched in parallel (Promise.all) with
 * aggregation pipelines, scoped to the viewer. Rates follow the attendance rules (recorded classes
 * only, lateCountsAsPresent, percent null when nothing is recorded).
 */
import mongoose from 'mongoose';

import { ACCOUNT_STATUS, ASSIGNMENT_STATUS, ROLES } from '../config/constants.js';
import { ASSESSMENT_STATUS } from '../models/assessment.model.js';
import { MEETING_STATUS } from '../models/meeting.model.js';
import {
  Assessment,
  Attendance,
  AuditLog,
  Class,
  Meeting,
  Notification,
  Result,
  Section,
  Settings,
  StudentProfile,
  TeacherAssignment,
  User,
} from '../models/index.js';
import { addDays, toDateKey, todaySchoolDate } from '../utils/date.js';
import {
  attendanceRate,
  MIN_RECORDED_DAYS_FOR_WARNING,
  statusCounters,
} from './attendanceRules.js';
import { todayStatus } from './attendance.service.js';
import { studentSummary } from './attendanceSummary.service.js';
import { classSectionLabel, requireActiveSession } from './lookup.service.js';
import { countUnread } from './notification.service.js';
import { listNotices } from './notice.service.js';
import { studentResults } from './results.service.js';

const WINDOW_DAYS = 30;
const oid = (id) => new mongoose.Types.ObjectId(String(id));
/** Counts + attended/percent, without the aggregation _id. */
function rate(row = {}, late) {
  const { _id, ...counts } = row;
  const base = { total: 0, present: 0, absent: 0, late: 0, ...counts };
  return { ...base, ...attendanceRate(base, late) };
}

function windowRange() {
  const today = todaySchoolDate();
  return { today, from: addDays(today, -(WINDOW_DAYS - 1)) };
}

const upcomingMeetings = (filter, limit = 5) =>
  Meeting.find({ ...filter, status: MEETING_STATUS.SCHEDULED, dateTime: { $gt: new Date() } })
    .sort({ dateTime: 1 })
    .limit(limit)
    .populate('organizerId', 'name role')
    .select(
      'title type dateTime durationMinutes venue onlineLink organizerId inviteeStudentIds responses',
    )
    .lean();

/** Students at or below the warning rule (≥ MIN days, percent < threshold), lowest first. */
async function studentsBelowThreshold(match, settings, limit = 20) {
  const rows = await Attendance.aggregate([
    { $match: match },
    { $group: { _id: '$studentId', ...statusCounters, days: { $addToSet: '$date' } } },
    { $set: { days: { $size: '$days' } } },
    { $match: { days: { $gte: MIN_RECORDED_DAYS_FOR_WARNING } } },
    {
      $set: {
        attended: {
          $add: ['$present', settings.lateCountsAsPresent ? '$late' : 0],
        },
      },
    },
    {
      $set: {
        percent: { $round: [{ $multiply: [{ $divide: ['$attended', '$total'] }, 100] }, 1] },
      },
    },
    { $match: { percent: { $lt: settings.attendanceThreshold } } },
    { $sort: { percent: 1 } },
    {
      $facet: {
        total: [{ $count: 'n' }],
        items: [
          { $limit: limit },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
          {
            $lookup: {
              from: 'studentprofiles',
              let: { uid: '$_id' },
              pipeline: [
                { $match: { $expr: { $eq: ['$userId', '$$uid'] }, sessionId: match.sessionId } },
                { $project: { classId: 1, sectionId: 1, rollNo: 1 } },
              ],
              as: 'profile',
            },
          },
          { $set: { user: { $first: '$user' }, profile: { $first: '$profile' } } },
          {
            $lookup: {
              from: 'classes',
              localField: 'profile.classId',
              foreignField: '_id',
              as: 'cls',
            },
          },
          {
            $lookup: {
              from: 'sections',
              localField: 'profile.sectionId',
              foreignField: '_id',
              as: 'sec',
            },
          },
          {
            $project: {
              studentId: '$_id',
              _id: 0,
              name: '$user.name',
              rollNo: '$profile.rollNo',
              classSection: { $concat: [{ $first: '$cls.name' }, '-', { $first: '$sec.name' }] },
              percent: 1,
              total: 1,
              days: 1,
            },
          },
        ],
      },
    },
  ]);
  return { total: rows[0]?.total[0]?.n ?? 0, items: rows[0]?.items ?? [] };
}

// ---------------------------------------------------------------------------

export async function adminDashboard() {
  const [settings, activeSession] = await Promise.all([Settings.get(), requireActiveSession()]);
  const late = settings.lateCountsAsPresent;
  const { today, from } = windowRange();
  const inWindow = { sessionId: activeSession._id, date: { $gte: from, $lte: today } };

  const [
    students,
    teachers,
    classes,
    sections,
    pendingCount,
    pendingLatest,
    todayRow,
    trend,
    byClass,
    below,
    meetings,
    recentActivity,
    unscheduled,
  ] = await Promise.all([
    StudentProfile.countDocuments({ sessionId: activeSession._id }),
    User.countDocuments({ role: ROLES.TEACHER, status: ACCOUNT_STATUS.ACTIVE }),
    Class.countDocuments(),
    Section.countDocuments(),
    User.countDocuments({ status: ACCOUNT_STATUS.PENDING }),
    User.find({ status: ACCOUNT_STATUS.PENDING })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name username createdAt registration.guardian.name')
      .lean(),
    Attendance.aggregate([
      { $match: { sessionId: activeSession._id, date: today } },
      { $group: { _id: null, ...statusCounters } },
    ]),
    Attendance.aggregate([
      { $match: inWindow },
      { $group: { _id: '$date', ...statusCounters } },
      { $sort: { _id: 1 } },
    ]),
    Attendance.aggregate([
      { $match: inWindow },
      { $group: { _id: '$classId', ...statusCounters } },
      { $lookup: { from: 'classes', localField: '_id', foreignField: '_id', as: 'cls' } },
      { $set: { cls: { $first: '$cls' } } },
      { $sort: { 'cls.order': 1 } },
    ]),
    studentsBelowThreshold({ sessionId: activeSession._id }, settings),
    upcomingMeetings({}),
    AuditLog.find().sort({ createdAt: -1 }).limit(10).populate('actorId', 'name role').lean(),
    TeacherAssignment.find({
      sessionId: activeSession._id,
      status: ASSIGNMENT_STATUS.ACTIVE,
      schedule: { $size: 0 },
    })
      .populate('teacherId', 'name')
      .populate('classId', 'name order')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name')
      .lean(),
  ]);

  return {
    session: activeSession.name,
    threshold: settings.attendanceThreshold,
    counts: { students, teachers, classes, sections, pendingApprovals: pendingCount },
    pendingApprovals: pendingLatest,
    todayAttendance: { date: toDateKey(today), ...rate(todayRow[0], late) },
    attendanceTrend: trend.map((r) => ({ date: toDateKey(r._id), ...rate(r, late) })),
    classComparison: byClass.map((r) => ({
      classId: r._id,
      class: r.cls?.name,
      ...rate({ total: r.total, present: r.present, absent: r.absent, late: r.late }, late),
    })),
    belowThreshold: below,
    upcomingMeetings: meetings.map(({ inviteeStudentIds, responses, ...m }) => ({
      ...m,
      invitees: inviteeStudentIds.length,
      responses: responses.length,
    })),
    recentActivity,
    assignmentsWithoutSchedule: unscheduled.map((a) => ({
      _id: a._id,
      teacher: a.teacherId?.name,
      classSection: classSectionLabel(a.classId, a.sectionId),
      subject: a.subjectId?.name,
    })),
  };
}

export async function teacherDashboard(actor) {
  const [settings, activeSession] = await Promise.all([Settings.get(), requireActiveSession()]);
  const late = settings.lateCountsAsPresent;
  const { today, from } = windowRange();
  const assignments = await TeacherAssignment.find({
    teacherId: actor.id,
    sessionId: activeSession._id,
    status: ASSIGNMENT_STATUS.ACTIVE,
  })
    .populate('classId', 'name order')
    .populate('sectionId', 'name')
    .lean();

  const sectionKeys = new Map();
  for (const a of assignments) {
    sectionKeys.set(`${a.classId._id}:${a.sectionId._id}`, {
      cls: a.classId,
      section: a.sectionId,
    });
  }
  const mySections = [...sectionKeys.values()];
  const sectionMatch = mySections.map(({ cls, section }) => ({
    classId: cls._id,
    sectionId: section._id,
  }));
  const combos = assignments.map((a) => ({
    classId: a.classId._id,
    sectionId: a.sectionId._id,
    subjectId: a.subjectId,
  }));
  const windowMatch = {
    sessionId: activeSession._id,
    date: { $gte: from, $lte: today },
    ...(sectionMatch.length ? { $or: sectionMatch } : { _id: null }),
  };

  const [today_, perSection, frequentAbsentees, drafts, meetings] = await Promise.all([
    todayStatus(actor),
    Attendance.aggregate([
      { $match: windowMatch },
      {
        $facet: {
          overall: [{ $group: { _id: { c: '$classId', s: '$sectionId' }, ...statusCounters } }],
          daily: [
            { $group: { _id: { c: '$classId', s: '$sectionId', d: '$date' }, ...statusCounters } },
            { $sort: { '_id.d': 1 } },
          ],
        },
      },
    ]),
    Attendance.aggregate([
      { $match: { ...windowMatch, status: 'absent' } },
      { $group: { _id: '$studentId', absentDays: { $addToSet: '$date' } } },
      { $set: { absentDays: { $size: '$absentDays' } } },
      { $match: { absentDays: { $gte: 3 } } },
      { $sort: { absentDays: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $project: { _id: 0, studentId: '$_id', name: { $first: '$user.name' }, absentDays: 1 } },
    ]),
    combos.length
      ? Assessment.find({
          status: ASSESSMENT_STATUS.DRAFT,
          sessionId: activeSession._id,
          $or: combos,
        })
          .sort({ date: -1 })
          .limit(10)
          .populate('subjectId', 'name')
          .populate('classId', 'name')
          .populate('sectionId', 'name')
          .lean()
      : [],
    upcomingMeetings({
      $or: [{ organizerId: oid(actor.id) }, { inviteeTeacherIds: oid(actor.id) }],
    }),
  ]);

  const [facets] = perSection;
  const key = (id) => `${id.c}:${id.s}`;
  const draftCounts = drafts.length
    ? await Result.aggregate([
        { $match: { assessmentId: { $in: drafts.map((d) => d._id) } } },
        { $group: { _id: '$assessmentId', entries: { $sum: 1 } } },
      ])
    : [];
  const entries = new Map(draftCounts.map((d) => [String(d._id), d.entries]));

  return {
    session: activeSession.name,
    today: today_,
    pendingToday: today_.classSections.filter((c) => c.status !== 'marked'),
    sections: mySections
      .sort((a, b) => a.cls.order - b.cls.order || a.section.name.localeCompare(b.section.name))
      .map(({ cls, section }) => {
        const k = `${cls._id}:${section._id}`;
        const overall = facets.overall.find((r) => key(r._id) === k);
        return {
          classId: cls._id,
          sectionId: section._id,
          label: classSectionLabel(cls, section),
          last30Days: rate(
            overall
              ? {
                  total: overall.total,
                  present: overall.present,
                  absent: overall.absent,
                  late: overall.late,
                }
              : {},
            late,
          ),
          daily: facets.daily
            .filter((r) => key(r._id) === k)
            .map((r) => ({
              date: toDateKey(r._id.d),
              ...rate({ total: r.total, present: r.present, absent: r.absent, late: r.late }, late),
            })),
        };
      }),
    frequentAbsentees,
    draftAssessments: drafts.map((d) => ({
      _id: d._id,
      name: d.name,
      mode: d.mode,
      date: toDateKey(d.date),
      subject: d.subjectId?.name,
      classSection: classSectionLabel(d.classId, d.sectionId),
      entries: entries.get(String(d._id)) ?? 0,
    })),
    upcomingMeetings: meetings.map(({ inviteeStudentIds, responses, ...m }) => ({
      ...m,
      invitees: inviteeStudentIds.length,
      responses: responses.length,
    })),
  };
}

export async function studentDashboard(actor) {
  const [summary, absenceAlerts, results, meetings, unread, recent, notices] = await Promise.all([
    studentSummary(actor.id).catch((err) => (err.statusCode === 404 ? null : Promise.reject(err))),
    Notification.find({ recipientId: actor.id, type: 'absence' })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title message data isRead updatedAt')
      .lean(),
    studentResults(actor.id, { limit: 5 }),
    upcomingMeetings({ inviteeStudentIds: oid(actor.id) }),
    countUnread(actor.id),
    // Uses the (recipientId, isRead, createdAt) index.
    Notification.find({ recipientId: actor.id, isRead: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('type title message data isRead createdAt updatedAt')
      .lean(),
    listNotices(actor, { page: 1, limit: 5 }),
  ]);
  return {
    attendance: summary && {
      overall: summary.overall,
      percent: summary.overall.percent,
      counts: {
        present: summary.overall.present,
        absent: summary.overall.absent,
        late: summary.overall.late,
      },
      monthly: summary.byMonth,
      belowThreshold: summary.belowThreshold,
      threshold: summary.threshold,
      student: summary.student,
    },
    absenceAlerts,
    recentResults: results,
    // Scheduled, not started and the child is invited: the guardian can still reply.
    upcomingMeetings: meetings.map(({ inviteeStudentIds: _i, responses, ...m }) => ({
      ...m,
      canRespond: true,
      myResponse: responses.find((r) => String(r.studentId) === String(actor.id)) ?? null,
    })),
    unreadNotifications: unread,
    recentNotifications: recent,
    notices: notices.items,
  };
}
