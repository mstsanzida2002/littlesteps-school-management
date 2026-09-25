/**
 * "data:changed": a lightweight refresh signal (no notification in anyone's list). It tells the
 * people looking at some data that it changed, so their open screens refetch:
 *
 * - every admin (room `role:admin`), for every scope;
 * - the teachers assigned (active, active session) to the class-section, for class-section
 *   scopes (attendance, results), so co-teachers see each other's work;
 * - every teacher for `settings`, `structure` and `assignments` (rules, classes, timetables);
 * - any extra users the caller names (`userIds`, e.g. a meeting's organiser).
 *
 * The payload is a scope and ids only: `{ scope, classId?, sectionId?, assessmentId?,
 * meetingId?, dates? }`. Never names, statuses or any personal data.
 *
 * Throttled per scope key: the first change is sent at once; further changes within
 * THROTTLE_MS are merged into ONE trailing event (dates are collected), so a bulk operation
 * doesn't flood clients. Call only after the change is committed (outbox or after the response
 * for plain writes).
 */
import { ASSIGNMENT_STATUS } from '../config/constants.js';
import { AcademicSession, TeacherAssignment } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { emitToRoom, emitToUser, isRealtimeReady, roleRoom } from './io.js';

export const DATA_SCOPES = Object.freeze([
  'attendance',
  'results',
  'users',
  'registrations',
  'structure',
  'assignments',
  'settings',
  'meetings',
  'notices',
]);
const CLASS_SECTION_SCOPES = new Set(['attendance', 'results']);
// Rules, classes and timetables every teacher's screens rely on.
const ALL_TEACHER_SCOPES = new Set(['settings', 'structure', 'assignments']);
export const THROTTLE_MS = 2000;

const pending = new Map(); // key → { change, dates, userIds, timer, sentAt }

/** Drop keys that have been quiet for a while (one per meeting/assessment would pile up). */
function sweep(now) {
  if (pending.size < 200) return;
  for (const [key, entry] of pending) {
    if (!entry.timer && now - entry.sentAt > THROTTLE_MS * 10) pending.delete(key);
  }
}

const keyOf = ({ scope, classId, sectionId, assessmentId, meetingId }) =>
  [scope, classId, sectionId, assessmentId, meetingId].filter(Boolean).join(':');

async function assignedTeacherIds(classId, sectionId) {
  const session = await AcademicSession.findOne({ isActive: true }).select('_id').lean();
  if (!session) return [];
  const rows = await TeacherAssignment.find({
    classId,
    sectionId,
    sessionId: session._id,
    status: ASSIGNMENT_STATUS.ACTIVE,
  })
    .select('teacherId')
    .lean();
  return [...new Set(rows.map((r) => String(r.teacherId)))];
}

async function send(change, dates, userIds) {
  const { scope, classId, sectionId, assessmentId, meetingId } = change;
  const payload = {
    scope,
    ...(classId && { classId: String(classId) }),
    ...(sectionId && { sectionId: String(sectionId) }),
    ...(assessmentId && { assessmentId: String(assessmentId) }),
    ...(meetingId && { meetingId: String(meetingId) }),
    ...(dates.size && { dates: [...dates].sort() }),
  };
  emitToRoom(roleRoom('admin'), 'data:changed', payload);
  if (ALL_TEACHER_SCOPES.has(scope)) emitToRoom(roleRoom('teacher'), 'data:changed', payload);
  const extra = new Set(userIds);
  if (CLASS_SECTION_SCOPES.has(scope) && classId && sectionId) {
    for (const id of await assignedTeacherIds(classId, sectionId)) extra.add(id);
  }
  for (const id of extra) emitToUser(id, 'data:changed', payload);
}

/**
 * Signal a change. change: { scope, classId?, sectionId?, date?, assessmentId?, meetingId?,
 * userIds? }. No-op without Socket.io (tests, scripts).
 */
export function notifyDataChanged(change) {
  if (!isRealtimeReady() || !DATA_SCOPES.includes(change?.scope)) return;
  const key = keyOf(change);
  const now = Date.now();
  sweep(now);
  let entry = pending.get(key);
  if (!entry) {
    entry = { change, dates: new Set(), userIds: new Set(), timer: null, sentAt: 0 };
    pending.set(key, entry);
  }
  if (change.date) entry.dates.add(String(change.date));
  for (const id of change.userIds ?? []) if (id) entry.userIds.add(String(id));

  const flush = () => {
    const { dates, userIds } = entry;
    entry.dates = new Set();
    entry.userIds = new Set();
    entry.timer = null;
    entry.sentAt = Date.now();
    send(entry.change, dates, userIds).catch((err) => logger.error('data:changed failed:', err));
  };

  if (now - entry.sentAt >= THROTTLE_MS && !entry.timer) {
    flush();
  } else if (!entry.timer) {
    entry.timer = setTimeout(flush, THROTTLE_MS - (now - entry.sentAt));
    entry.timer.unref?.();
  }
}

/** Tests: forget throttling state. */
export function resetDataChanged() {
  for (const entry of pending.values()) clearTimeout(entry.timer);
  pending.clear();
}
