/**
 * System settings (FR-ADM-10). One document; changes are audited with before/after values.
 */
import { AcademicSession, Settings } from '../models/index.js';
import { toDateKey, todaySchoolDate } from '../utils/date.js';
import { withBandRanges } from '../models/settings.model.js';
import { diffChanges, recordAudit } from './audit.service.js';

const EDITABLE = [
  'gradingScale',
  'attendanceThreshold',
  'lateCountsAsPresent',
  'attendanceBackdateDays',
  'weeklyOffDays',
];

function present(settings) {
  const plain = settings.toObject();
  return {
    gradingScale: withBandRanges(plain.gradingScale),
    attendanceThreshold: plain.attendanceThreshold,
    lateCountsAsPresent: plain.lateCountsAsPresent,
    attendanceBackdateDays: plain.attendanceBackdateDays,
    weeklyOffDays: plain.weeklyOffDays,
    updatedAt: plain.updatedAt,
  };
}

const editableView = (plain) => Object.fromEntries(EDITABLE.map((key) => [key, plain[key]]));

export async function getSettings() {
  return present(await Settings.get());
}

/** PATCH /api/settings — partial; gradingScale arrives already sorted and validated. */
export async function updateSettings(actor, changes, meta = {}) {
  const settings = await Settings.get();
  const before = editableView(settings.toObject());
  settings.set(changes);
  await settings.save();

  const diff = diffChanges(before, editableView(settings.toObject()));
  if (Object.keys(diff.after).length) {
    await recordAudit({
      actorId: actor.id,
      action: 'settings.update',
      entityType: 'Settings',
      entityId: settings._id,
      ...diff,
      meta,
    });
  }
  return present(settings);
}

/**
 * GET /api/settings/school — what every signed-in user may know: the school's rules (none of
 * the settings are sensitive), today's school date (Asia/Dhaka, from the server clock) and the
 * active session's dates. Teachers need them for date pickers and grade previews.
 */
export async function schoolSettings() {
  const [settings, session] = await Promise.all([
    Settings.get(),
    AcademicSession.findOne({ isActive: true }, { name: 1, startDate: 1, endDate: 1 }).lean(),
  ]);
  const { updatedAt: _updatedAt, ...rules } = present(settings);
  return {
    ...rules,
    today: toDateKey(todaySchoolDate()),
    session: session && {
      _id: session._id,
      name: session.name,
      startDate: toDateKey(session.startDate),
      endDate: toDateKey(session.endDate),
    },
  };
}
