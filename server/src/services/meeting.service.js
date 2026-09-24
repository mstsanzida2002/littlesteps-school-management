/**
 * Meetings (FR-ADM-07, FR-TCH-13/14, FR-STU-06/07).
 *
 * - dateTime is entered as Dhaka local { date, time } and stored as a real instant (atSchoolTime).
 * - Invites: the organizer's selection (`invite`) is stored AND resolved to inviteeStudentIds /
 *   inviteeTeacherIds at create/update (active-session enrolment). Teachers may only target their
 *   own class-sections (a whole class only if they teach every section; never 'all'); only admins
 *   can invite teachers.
 * - Enrolment changes keep invitees correct (syncStudentMeetingInvites) inside the enrolment
 *   transaction: joiners are added to upcoming meetings whose target covers them; leavers are
 *   removed only where they were invited via that section/class (never individual invites).
 *   Past and cancelled meetings never change.
 * - Notifications (in the same transaction, delivered after commit): invite on create/added,
 *   'meeting_updated' to everyone on detail changes, "no longer invited" to removed invitees,
 *   'meeting_cancelled' to everyone on cancel.
 * - RSVP: invited students only, until the start, changeable; never after cancellation.
 */
import mongoose from 'mongoose';

import { ACCOUNT_STATUS, ASSIGNMENT_STATUS, ERROR_CODES, ROLES } from '../config/constants.js';
import { MEETING_STATUS } from '../models/meeting.model.js';
import { Meeting, Section, StudentProfile, TeacherAssignment, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import {
  atSchoolTime,
  formatSchoolDateTime,
  schoolDateKeyOf,
  schoolTimeOf,
  toSchoolDate,
} from '../utils/date.js';
import { withTransaction } from '../utils/transaction.js';
import { diffChanges, recordAudit } from './audit.service.js';
import { classSectionLabel, requireActiveSession } from './lookup.service.js';
import { createNotifications, createOutbox, dispatchOutbox } from './notification.service.js';

const { ObjectId } = mongoose.Types;
const ids = (list = []) => [...new Set(list.map(String))];
const oids = (list = []) => ids(list).map((id) => new ObjectId(id));
const DETAIL_FIELDS = [
  'title',
  'agenda',
  'type',
  'dateTime',
  'durationMinutes',
  'venue',
  'onlineLink',
];

export const toInstant = ({ date, time }) => atSchoolTime(toSchoolDate(date), time);

// ---------------------------------------------------------------------------
// Invite resolution

/** "classId:sectionId" of every active assignment of a teacher in a session. */
async function teacherSectionKeys(teacherId, sessionId) {
  const rows = await TeacherAssignment.find({
    teacherId,
    sessionId,
    status: ASSIGNMENT_STATUS.ACTIVE,
  })
    .select('classId sectionId')
    .lean();
  return new Set(rows.map((r) => `${r.classId}:${r.sectionId}`));
}

/**
 * Resolve an invite to { studentIds, teacherIds } for the active session, enforcing who may
 * target what. Throws 403 / 422.
 */
export async function resolveInvite(actor, invite, sessionId) {
  const isAdmin = actor.role === ROLES.ADMIN;
  const mine = isAdmin ? null : await teacherSectionKeys(actor.id, sessionId);
  const denied = (message) => ApiError.forbidden(message);
  const profileKey = (p) => `${p.classId}:${p.sectionId}`;
  let profiles = [];

  switch (invite.target) {
    case 'all':
      if (!isAdmin) throw denied('Only admins can invite the whole school.');
      profiles = await StudentProfile.find({ sessionId }).select('userId classId sectionId').lean();
      break;
    case 'classes': {
      if (!isAdmin) {
        const sections = await Section.find({ classId: { $in: invite.classIds } }).lean();
        const notAll = sections.filter((s) => !mine.has(`${s.classId}:${s._id}`));
        if (!sections.length || notAll.length) {
          throw denied('You can invite a whole class only if you teach every section of it.');
        }
      }
      profiles = await StudentProfile.find({ sessionId, classId: { $in: invite.classIds } })
        .select('userId classId sectionId')
        .lean();
      break;
    }
    case 'sections': {
      const sections = await Section.find({ _id: { $in: invite.sectionIds } }).lean();
      if (sections.length !== ids(invite.sectionIds).length) {
        throw ApiError.invalidField('invite.sectionIds', 'Unknown section');
      }
      if (!isAdmin && sections.some((s) => !mine.has(`${s.classId}:${s._id}`))) {
        throw denied('You can only invite sections you teach.');
      }
      profiles = await StudentProfile.find({ sessionId, sectionId: { $in: invite.sectionIds } })
        .select('userId classId sectionId')
        .lean();
      break;
    }
    case 'students': {
      profiles = await StudentProfile.find({ sessionId, userId: { $in: invite.studentIds } })
        .select('userId classId sectionId')
        .lean();
      if (profiles.length !== ids(invite.studentIds).length) {
        throw ApiError.invalidField(
          'invite.studentIds',
          'Some students are not enrolled this session',
        );
      }
      if (!isAdmin && profiles.some((p) => !mine.has(profileKey(p)))) {
        throw denied('You can only invite students from your own classes.');
      }
      break;
    }
    default:
      profiles = [];
  }

  let teacherIds = [];
  if (invite.teacherIds?.length) {
    if (!isAdmin) throw denied('Only admins can invite teachers.');
    const teachers = await User.find({
      _id: { $in: invite.teacherIds },
      role: ROLES.TEACHER,
      status: ACCOUNT_STATUS.ACTIVE,
    })
      .select('_id')
      .lean();
    if (teachers.length !== ids(invite.teacherIds).length) {
      throw ApiError.invalidField(
        'invite.teacherIds',
        'Every invited teacher must be an active teacher',
      );
    }
    teacherIds = teachers.map((t) => t._id);
  }

  const studentIds = oids(profiles.map((p) => p.userId));
  if (!studentIds.length && !teacherIds.length) {
    throw ApiError.unprocessable('This invite does not include anyone.');
  }
  return { studentIds, teacherIds };
}

// ---------------------------------------------------------------------------
// Notifications

const when = (meeting) => formatSchoolDateTime(meeting.dateTime);
const where = (meeting) => meeting.venue ?? 'online';

function meetingNotifications(meeting, recipients, kind) {
  const base = {
    relatedEntity: { kind: 'Meeting', id: meeting._id },
    data: { meetingId: String(meeting._id), dateTime: meeting.dateTime },
  };
  const templates = {
    invite: {
      type: 'meeting_invite',
      title: `Meeting invitation: ${meeting.title}`,
      message: `You are invited to "${meeting.title}" on ${when(meeting)} (${where(meeting)}).`,
    },
    updated: {
      type: 'meeting_updated',
      title: `Meeting updated: ${meeting.title}`,
      message: `"${meeting.title}" was updated. It is now on ${when(meeting)} (${where(meeting)}).`,
    },
    removed: {
      type: 'meeting_updated',
      title: `No longer invited: ${meeting.title}`,
      message: `You are no longer invited to "${meeting.title}" on ${when(meeting)}.`,
      data: { ...base.data, removed: true },
    },
    cancelled: {
      type: 'meeting_cancelled',
      title: `Meeting cancelled: ${meeting.title}`,
      message:
        `"${meeting.title}" on ${when(meeting)} was cancelled.` +
        (meeting.cancelReason ? ` Reason: ${meeting.cancelReason}` : ''),
    },
  };
  return ids(recipients).map((recipientId) => ({ ...base, ...templates[kind], recipientId }));
}

// ---------------------------------------------------------------------------
// Access helpers

const isInvitedStudent = (meeting, userId) =>
  meeting.inviteeStudentIds.some((id) => String(id) === String(userId));
const isInvitedTeacher = (meeting, userId) =>
  meeting.inviteeTeacherIds.some((id) => String(id) === String(userId));
const isOrganizer = (meeting, userId) => String(meeting.organizerId) === String(userId);

function canSee(actor, meeting) {
  if (actor.role === ROLES.ADMIN) return true;
  if (actor.role === ROLES.TEACHER) {
    return isOrganizer(meeting, actor.id) || isInvitedTeacher(meeting, actor.id);
  }
  return isInvitedStudent(meeting, actor.id);
}

const canManage = (actor, meeting) => actor.role === ROLES.ADMIN || isOrganizer(meeting, actor.id);

async function requireMeeting(id) {
  const meeting = await Meeting.findById(id);
  if (!meeting) throw ApiError.notFound('Meeting not found');
  return meeting;
}

const assertNotStarted = (meeting) => {
  if (meeting.dateTime <= new Date()) {
    throw ApiError.conflict('This meeting has already started.', undefined, {
      code: ERROR_CODES.MEETING_STARTED,
    });
  }
};
const assertNotCancelled = (meeting) => {
  if (meeting.status === MEETING_STATUS.CANCELLED) {
    throw ApiError.conflict('This meeting was cancelled.', undefined, {
      code: ERROR_CODES.MEETING_CANCELLED,
    });
  }
};

/** Shape a meeting for a viewer: students see only their own response. */
function present(actor, meeting) {
  const m = meeting.toObject ? meeting.toObject() : meeting;
  const now = new Date();
  const base = {
    ...m,
    isPast: m.dateTime <= now,
    canRespond:
      actor.role === ROLES.STUDENT &&
      m.status === MEETING_STATUS.SCHEDULED &&
      m.dateTime > now &&
      isInvitedStudent(m, actor.id),
  };
  if (actor.role === ROLES.STUDENT) {
    const mine = m.responses.find((r) => String(r.studentId) === String(actor.id));
    const {
      inviteeStudentIds: _s,
      inviteeTeacherIds: _t,
      responses: _r,
      invite: _i,
      ...rest
    } = base;
    return { ...rest, myResponse: mine ?? null };
  }
  return {
    ...base,
    inviteeCount: m.inviteeStudentIds.length + m.inviteeTeacherIds.length,
    responseCounts: countResponses(m),
  };
}

function countResponses(meeting) {
  const counts = { will_attend: 0, cannot_attend: 0 };
  for (const r of meeting.responses) counts[r.response] += 1;
  return { ...counts, no_response: meeting.inviteeStudentIds.length - meeting.responses.length };
}

// ---------------------------------------------------------------------------
// CRUD

/** POST /api/meetings */
export async function createMeeting(actor, data, meta = {}) {
  const activeSession = await requireActiveSession();
  const dateTime = toInstant(data);
  if (dateTime <= new Date())
    throw ApiError.invalidField('time', 'The meeting must be in the future');
  const { studentIds, teacherIds } = await resolveInvite(actor, data.invite, activeSession._id);

  const outbox = await withTransaction(async (session) => {
    const txOutbox = createOutbox();
    const [meeting] = await Meeting.create(
      [
        {
          title: data.title,
          agenda: data.agenda,
          type: data.type,
          dateTime,
          durationMinutes: data.durationMinutes,
          venue: data.venue,
          onlineLink: data.onlineLink,
          organizerId: actor.id,
          sessionId: activeSession._id,
          invite: data.invite,
          inviteeStudentIds: studentIds,
          inviteeTeacherIds: teacherIds,
        },
      ],
      { session },
    );
    await createNotifications(
      meetingNotifications(meeting, [...studentIds, ...teacherIds], 'invite'),
      {
        session,
        outbox: txOutbox,
      },
    );
    await recordAudit(
      {
        actorId: actor.id,
        action: 'meeting.create',
        entityType: 'Meeting',
        entityId: meeting._id,
        after: {
          title: meeting.title,
          dateTime,
          invite: data.invite,
          invitees: studentIds.length + teacherIds.length,
        },
        meta,
      },
      { session },
    );
    txOutbox.meetingId = meeting._id;
    return txOutbox;
  });
  await dispatchOutbox(outbox);
  return getMeeting(actor, outbox.meetingId);
}

/** GET /api/meetings — scoped to the viewer; ?when=upcoming|past&status= */
export async function listMeetings(actor, { page, limit, when: period, status }) {
  const now = new Date();
  const filter = {};
  if (actor.role === ROLES.TEACHER) {
    filter.$or = [{ organizerId: actor.id }, { inviteeTeacherIds: actor.id }];
  } else if (actor.role === ROLES.STUDENT) {
    filter.inviteeStudentIds = actor.id;
  }
  if (status) filter.status = status;
  if (period === 'upcoming') filter.dateTime = { $gt: now };
  if (period === 'past') filter.dateTime = { $lte: now };
  const sort = period === 'past' ? { dateTime: -1, _id: -1 } : { dateTime: 1, _id: 1 };

  const [items, total] = await Promise.all([
    Meeting.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('organizerId', 'name role')
      .lean(),
    Meeting.countDocuments(filter),
  ]);
  return {
    items: items.map((m) => present(actor, m)),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** GET /api/meetings/:id — 404 for anyone who can't see it. */
export async function getMeeting(actor, id) {
  const meeting = await Meeting.findById(id).populate('organizerId', 'name role').lean();
  if (!meeting || !canSee(actor, { ...meeting, organizerId: meeting.organizerId._id })) {
    throw ApiError.notFound('Meeting not found');
  }
  return present(actor, meeting);
}

/** PATCH /api/meetings/:id — organizer or admin, before it starts. */
export async function updateMeeting(actor, id, data, meta = {}) {
  const meeting = await requireMeeting(id);
  if (!canSee(actor, meeting)) throw ApiError.notFound('Meeting not found');
  if (!canManage(actor, meeting))
    throw ApiError.forbidden('Only the organizer or an admin can edit this meeting.');
  assertNotCancelled(meeting);
  assertNotStarted(meeting);

  const changes = { ...data };
  delete changes.date;
  delete changes.time;
  if (data.date || data.time) {
    // Either part may change; the other keeps its current Dhaka value.
    const dateTime = toInstant({
      date: data.date ?? schoolDateKeyOf(meeting.dateTime),
      time: data.time ?? schoolTimeOf(meeting.dateTime),
    });
    if (dateTime <= new Date())
      throw ApiError.invalidField('time', 'The meeting must be in the future');
    changes.dateTime = dateTime;
  }

  let added = [];
  let removed = [];
  let resolved = null;
  if (data.invite) {
    resolved = await resolveInvite(actor, data.invite, meeting.sessionId);
    const before = new Set(ids([...meeting.inviteeStudentIds, ...meeting.inviteeTeacherIds]));
    const after = new Set(ids([...resolved.studentIds, ...resolved.teacherIds]));
    added = [...after].filter((x) => !before.has(x));
    removed = [...before].filter((x) => !after.has(x));
  }

  const before = meeting.toObject();
  const outbox = await withTransaction(async (session) => {
    const txOutbox = createOutbox();
    meeting.set(changes);
    if (resolved) {
      meeting.inviteeStudentIds = resolved.studentIds;
      meeting.inviteeTeacherIds = resolved.teacherIds;
      meeting.responses = meeting.responses.filter((r) => !removed.includes(String(r.studentId)));
    }
    await meeting.save({ session });

    const detailsChanged = DETAIL_FIELDS.some(
      (f) => JSON.stringify(before[f]) !== JSON.stringify(meeting.toObject()[f]),
    );
    const stayed = ids([...meeting.inviteeStudentIds, ...meeting.inviteeTeacherIds]).filter(
      (x) => !added.includes(x),
    );
    const docs = [
      ...(detailsChanged ? meetingNotifications(meeting, stayed, 'updated') : []),
      ...meetingNotifications(meeting, added, 'invite'),
      ...meetingNotifications(meeting, removed, 'removed'),
    ];
    await createNotifications(docs, { session, outbox: txOutbox });
    await recordAudit(
      {
        actorId: actor.id,
        action: 'meeting.update',
        entityType: 'Meeting',
        entityId: meeting._id,
        ...diffChanges(
          Object.fromEntries([...DETAIL_FIELDS, 'invite'].map((f) => [f, before[f]])),
          Object.fromEntries([...DETAIL_FIELDS, 'invite'].map((f) => [f, meeting.toObject()[f]])),
        ),
        meta,
      },
      { session },
    );
    return txOutbox;
  });
  await dispatchOutbox(outbox);
  return { meeting: await getMeeting(actor, id), added: added.length, removed: removed.length };
}

/** POST /api/meetings/:id/cancel */
export async function cancelMeeting(actor, id, { reason }, meta = {}) {
  const meeting = await requireMeeting(id);
  if (!canSee(actor, meeting)) throw ApiError.notFound('Meeting not found');
  if (!canManage(actor, meeting))
    throw ApiError.forbidden('Only the organizer or an admin can cancel this meeting.');
  assertNotCancelled(meeting);
  assertNotStarted(meeting);

  const outbox = await withTransaction(async (session) => {
    const txOutbox = createOutbox();
    meeting.set({
      status: MEETING_STATUS.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: actor.id,
      cancelReason: reason,
    });
    await meeting.save({ session });
    await createNotifications(
      meetingNotifications(
        meeting,
        [...meeting.inviteeStudentIds, ...meeting.inviteeTeacherIds],
        'cancelled',
      ),
      { session, outbox: txOutbox },
    );
    await recordAudit(
      {
        actorId: actor.id,
        action: 'meeting.cancel',
        entityType: 'Meeting',
        entityId: meeting._id,
        before: { status: MEETING_STATUS.SCHEDULED },
        after: { status: MEETING_STATUS.CANCELLED, reason },
        meta,
      },
      { session },
    );
    return txOutbox;
  });
  await dispatchOutbox(outbox);
  return getMeeting(actor, id);
}

/** PATCH /api/meetings/:id/respond — invited students, until the start; changeable. */
export async function respondToMeeting(actor, id, { response, note }) {
  const meeting = await requireMeeting(id);
  if (!isInvitedStudent(meeting, actor.id)) throw ApiError.notFound('Meeting not found');
  assertNotCancelled(meeting);
  assertNotStarted(meeting);

  const now = new Date();
  const open = {
    _id: id,
    status: MEETING_STATUS.SCHEDULED,
    dateTime: { $gt: now },
    inviteeStudentIds: actor.id,
  };
  const entry = {
    studentId: actor.id,
    response,
    note: note?.trim() || undefined,
    respondedAt: now,
  };
  // Change an existing response, or add one atomically (never two per student).
  const changed = await Meeting.updateOne(
    { ...open, 'responses.studentId': actor.id },
    { $set: { 'responses.$': entry } },
  );
  if (!changed.matchedCount) {
    const added = await Meeting.updateOne(
      { ...open, 'responses.studentId': { $ne: actor.id } },
      { $push: { responses: entry } },
    );
    if (!added.matchedCount) {
      const fresh = await requireMeeting(id);
      assertNotCancelled(fresh);
      assertNotStarted(fresh);
      throw ApiError.conflict('Could not save your response; please try again.');
    }
  }
  return getMeeting(actor, id);
}

/** GET /api/meetings/:id/responses — organizer/admin: counts + per-student list. */
export async function meetingResponses(actor, id) {
  const meeting = await Meeting.findById(id).lean();
  if (!meeting || !canSee(actor, meeting)) throw ApiError.notFound('Meeting not found');
  if (!canManage(actor, meeting))
    throw ApiError.forbidden('Only the organizer or an admin can see responses.');
  const profiles = await StudentProfile.find({
    userId: { $in: meeting.inviteeStudentIds },
    sessionId: meeting.sessionId,
  })
    .populate('userId', 'name')
    .populate('classId', 'name order')
    .populate('sectionId', 'name')
    .lean();
  const byStudent = new Map(meeting.responses.map((r) => [String(r.studentId), r]));
  const students = profiles
    .map((p) => {
      const r = byStudent.get(String(p.userId._id));
      return {
        studentId: p.userId._id,
        name: p.userId.name,
        classSection: classSectionLabel(p.classId, p.sectionId),
        rollNo: p.rollNo,
        response: r?.response ?? 'no_response',
        note: r?.note ?? null,
        respondedAt: r?.respondedAt ?? null,
        order: [p.classId.order, p.sectionId.name, p.rollNo],
      };
    })
    .sort(
      (a, b) =>
        a.order[0] - b.order[0] || a.order[1].localeCompare(b.order[1]) || a.order[2] - b.order[2],
    )
    .map(({ order: _o, ...rest }) => rest);
  return { counts: countResponses(meeting), students };
}

// ---------------------------------------------------------------------------
// Enrolment changes keep invitees correct

/**
 * Called INSIDE the enrolment transaction (create student, approve registration, move
 * class/section). `from`/`to` = { classId, sectionId } or null.
 */
export async function syncStudentMeetingInvites({
  studentId,
  sessionId,
  from,
  to,
  session,
  outbox,
}) {
  const now = new Date();
  const upcoming = { sessionId, status: MEETING_STATUS.SCHEDULED, dateTime: { $gt: now } };
  const covers = (placement) => [
    { 'invite.target': 'all' },
    { 'invite.target': 'classes', 'invite.classIds': placement.classId },
    { 'invite.target': 'sections', 'invite.sectionIds': placement.sectionId },
  ];
  const sid = new ObjectId(String(studentId));

  if (to) {
    const joining = await Meeting.find({
      ...upcoming,
      inviteeStudentIds: { $ne: sid },
      $or: covers(to),
    }).session(session);
    for (const meeting of joining) {
      meeting.inviteeStudentIds.push(sid);
      await meeting.save({ session });
    }
    await createNotifications(
      joining.flatMap((m) => meetingNotifications(m, [sid], 'invite')),
      { session, outbox },
    );
  }

  if (from) {
    // Only meetings they were invited to through their old class or section. Individual
    // invitations are target 'students' meetings, which this query never matches, and 'all'
    // still covers them after a move.
    const leaving = await Meeting.find({
      ...upcoming,
      inviteeStudentIds: sid,
      $or: covers(from).slice(1),
    }).session(session);
    const stillCovered = (m) =>
      to &&
      ((m.invite.target === 'classes' && ids(m.invite.classIds).includes(String(to.classId))) ||
        (m.invite.target === 'sections' &&
          ids(m.invite.sectionIds).includes(String(to.sectionId))));
    const removedFrom = leaving.filter((m) => !stillCovered(m));
    for (const meeting of removedFrom) {
      meeting.inviteeStudentIds = meeting.inviteeStudentIds.filter((x) => !x.equals(sid));
      meeting.responses = meeting.responses.filter((r) => !r.studentId.equals(sid));
      await meeting.save({ session });
    }
    await createNotifications(
      removedFrom.flatMap((m) => meetingNotifications(m, [sid], 'removed')),
      { session, outbox },
    );
  }
}
