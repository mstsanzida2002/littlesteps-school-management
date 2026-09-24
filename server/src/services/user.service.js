/**
 * Admin user management (FR-ADM-01, FR-ADM-05, FR-ADM-06).
 */
import { ACCOUNT_STATUS, ERROR_CODES, ROLES } from '../config/constants.js';
import {
  Notification,
  RefreshToken,
  StudentProfile,
  TeacherAssignment,
  TeacherProfile,
  User,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { todaySchoolDate } from '../utils/date.js';
import { paginate, searchFilter } from '../utils/listQuery.js';
import { hashPassword } from '../utils/password.js';
import { withTransaction } from '../utils/transaction.js';
import { diffChanges, recordAudit } from './audit.service.js';
import {
  nextRollNumber,
  requireActiveSession,
  requireSectionInClass,
  rethrowRollConflict,
} from './lookup.service.js';
import { countUserHistory, describeCounts } from './reference.service.js';
import { invalidateUserSessions } from './token.service.js';

const PUBLIC_USER_FIELDS = '-tokenVersion -__v';
const STUDENT_PROFILE_KEYS = [
  'classId',
  'sectionId',
  'rollNo',
  'dateOfBirth',
  'gender',
  'admissionDate',
  'guardian',
];
const TEACHER_PROFILE_KEYS = ['employeeId', 'qualification', 'joiningDate'];

const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((key) => obj?.[key] !== undefined).map((key) => [key, obj[key]]));

const userSummary = (user) => ({
  name: user.name,
  username: user.username,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
});

const studentProfilePopulate = [
  { path: 'classId', select: 'name order' },
  { path: 'sectionId', select: 'name' },
  { path: 'sessionId', select: 'name isActive' },
];

async function requireUser(id, { session } = {}) {
  const user = await User.findById(id).session(session ?? null);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

// ---------------------------------------------------------------------------
// Read

/** GET /api/users — filters: role, status, classId/sectionId/sessionId (students), search. */
export async function listUsers({
  page,
  limit,
  sort,
  search,
  role,
  status,
  classId,
  sectionId,
  sessionId,
}) {
  const filter = searchFilter(search, ['name', 'username', 'email', 'phone']);
  if (role) filter.role = role;
  if (status) filter.status = status;

  if (classId || sectionId || sessionId) {
    const profileFilter = {};
    if (classId) profileFilter.classId = classId;
    if (sectionId) profileFilter.sectionId = sectionId;
    profileFilter.sessionId = sessionId ?? (await requireActiveSession())._id;
    filter._id = { $in: await StudentProfile.distinct('userId', profileFilter) };
  }

  const { items, meta } = await paginate(User, filter, {
    page,
    limit,
    sort,
    select: PUBLIC_USER_FIELDS,
  });

  const ids = items.map((u) => u._id);
  const [studentProfiles, teacherProfiles] = await Promise.all([
    StudentProfile.find({ userId: { $in: ids } })
      .select('userId rollNo classId sectionId sessionId')
      .populate(studentProfilePopulate)
      .lean(),
    TeacherProfile.find({ userId: { $in: ids } })
      .select('userId employeeId')
      .lean(),
  ]);
  const profiles = new Map(
    [...studentProfiles, ...teacherProfiles].map((p) => [String(p.userId), p]),
  );
  return {
    items: items.map((user) => ({ ...user, profile: profiles.get(String(user._id)) ?? null })),
    meta,
  };
}

/** GET /api/users/:id — the user with their profile (and assignment count for teachers). */
export async function getUser(id) {
  const user = await User.findById(id).select(PUBLIC_USER_FIELDS).lean();
  if (!user) throw ApiError.notFound('User not found');

  let profile = null;
  const extra = {};
  if (user.role === ROLES.STUDENT) {
    profile = await StudentProfile.findOne({ userId: id }).populate(studentProfilePopulate).lean();
  } else if (user.role === ROLES.TEACHER) {
    profile = await TeacherProfile.findOne({ userId: id }).lean();
    const sessionId = (await requireActiveSession().catch(() => null))?._id;
    extra.activeAssignments = sessionId
      ? await TeacherAssignment.countDocuments({ teacherId: id, sessionId, status: 'active' })
      : 0;
  }
  return { ...user, profile, ...extra };
}

/** GET /api/users/next-roll */
export async function getNextRoll({ classId, sectionId, sessionId }) {
  await requireSectionInClass(classId, sectionId);
  const resolvedSessionId = sessionId ?? (await requireActiveSession())._id;
  return nextRollNumber({ classId, sectionId, sessionId: resolvedSessionId });
}

// ---------------------------------------------------------------------------
// Create / update

/**
 * POST /api/users — student (+StudentProfile in the active session), teacher (+TeacherProfile)
 * or admin. Created active, with mustChangePassword so the user picks their own password.
 */
export async function createUser(actor, data, meta) {
  const { role, password, profile, ...fields } = data;

  let placement;
  if (role === ROLES.STUDENT) {
    const activeSession = await requireActiveSession();
    await requireSectionInClass(profile.classId, profile.sectionId);
    const base = {
      classId: profile.classId,
      sectionId: profile.sectionId,
      sessionId: activeSession._id,
    };
    placement = {
      ...base,
      rollNo: profile.rollNo ?? (await nextRollNumber(base)).suggestedRollNo,
    };
  }

  const passwordHash = await hashPassword(password);
  try {
    const userId = await withTransaction(async (session) => {
      const [user] = await User.create(
        [
          {
            ...fields,
            role,
            passwordHash,
            status: ACCOUNT_STATUS.ACTIVE,
            mustChangePassword: true,
            createdBy: actor.id,
          },
        ],
        { session },
      );

      let profileDoc = null;
      if (role === ROLES.STUDENT) {
        [profileDoc] = await StudentProfile.create(
          [
            {
              userId: user._id,
              ...placement,
              dateOfBirth: profile.dateOfBirth,
              gender: profile.gender,
              admissionDate: profile.admissionDate ?? todaySchoolDate(),
              guardian: profile.guardian,
            },
          ],
          { session },
        );
      } else if (role === ROLES.TEACHER) {
        [profileDoc] = await TeacherProfile.create(
          [{ userId: user._id, ...pick(profile, TEACHER_PROFILE_KEYS) }],
          { session },
        );
      }

      await recordAudit(
        {
          actorId: actor.id,
          action: 'user.create',
          entityType: 'User',
          entityId: user._id,
          after: { ...userSummary(user), ...(profileDoc && { profile: profileDoc.toObject() }) },
          meta,
        },
        { session },
      );
      return user._id;
    });
    return getUser(userId);
  } catch (err) {
    if (placement) await rethrowRollConflict(err, placement);
    throw err;
  }
}

/** PATCH /api/users/:id — account fields plus role-specific profile fields. Role is fixed. */
export async function updateUser(actor, id, data, meta) {
  const { role, profile: profileInput, ...fields } = data;
  const existing = await requireUser(id);

  if (role !== undefined && role !== existing.role) {
    throw ApiError.badRequest(
      'Role cannot be changed. Create a new account with the other role instead.',
      [{ field: 'role', message: 'Role cannot be changed' }],
    );
  }

  let placement;
  let profileChanges;
  if (profileInput) {
    const allowed = { student: STUDENT_PROFILE_KEYS, teacher: TEACHER_PROFILE_KEYS }[existing.role];
    if (!allowed) throw ApiError.invalidField('profile', 'Admin accounts have no profile');
    const invalid = Object.keys(profileInput).filter((key) => !allowed.includes(key));
    if (invalid.length) {
      throw ApiError.unprocessable(
        'Validation failed',
        invalid.map((key) => ({
          field: `profile.${key}`,
          message: `Not a ${existing.role} profile field`,
        })),
      );
    }
  }

  try {
    await withTransaction(async (session) => {
      const user = await requireUser(id, { session });
      const before = userSummary(user);
      for (const [key, value] of Object.entries(fields)) {
        user.set(key, value === '' || value === null ? undefined : value);
      }
      await user.save({ session });
      const accountChanges = diffChanges(before, userSummary(user));

      if (profileInput && existing.role === ROLES.STUDENT) {
        const profile = await StudentProfile.findOne({ userId: id }).session(session);
        if (!profile) {
          throw ApiError.conflict(
            'This student has no profile yet (approve the registration first).',
          );
        }
        const beforeProfile = profile.toObject();
        const classId = profileInput.classId ?? profile.classId;
        const sectionId = profileInput.sectionId ?? profile.sectionId;
        const moving =
          String(classId) !== String(profile.classId) ||
          String(sectionId) !== String(profile.sectionId);
        if (profileInput.classId || profileInput.sectionId) {
          await requireSectionInClass(classId, sectionId, { session });
        }
        let rollNo = profileInput.rollNo ?? profile.rollNo;
        if (moving && profileInput.rollNo === undefined) {
          rollNo = (
            await nextRollNumber({ classId, sectionId, sessionId: profile.sessionId }, { session })
          ).suggestedRollNo;
        }
        placement = { classId, sectionId, sessionId: profile.sessionId, rollNo };
        profile.set({ ...pick(profileInput, STUDENT_PROFILE_KEYS), classId, sectionId, rollNo });
        await profile.save({ session });
        profileChanges = diffChanges(beforeProfile, profile.toObject());
      } else if (profileInput && existing.role === ROLES.TEACHER) {
        const profile = await TeacherProfile.findOne({ userId: id }).session(session);
        if (!profile) throw ApiError.conflict('This teacher has no profile');
        const beforeProfile = profile.toObject();
        profile.set(pick(profileInput, TEACHER_PROFILE_KEYS));
        await profile.save({ session });
        profileChanges = diffChanges(beforeProfile, profile.toObject());
      }

      const hasProfileChanges = profileChanges && Object.keys(profileChanges.after).length;
      await recordAudit(
        {
          actorId: actor.id,
          action: 'user.update',
          entityType: 'User',
          entityId: user._id,
          before: {
            ...accountChanges.before,
            ...(hasProfileChanges && { profile: profileChanges.before }),
          },
          after: {
            ...accountChanges.after,
            ...(hasProfileChanges && { profile: profileChanges.after }),
          },
          meta,
        },
        { session },
      );
    });
  } catch (err) {
    if (placement) await rethrowRollConflict(err, placement);
    throw err;
  }
  return getUser(id);
}

// ---------------------------------------------------------------------------
// Status changes / delete

const countActiveAdmins = () =>
  User.countDocuments({ role: ROLES.ADMIN, status: ACCOUNT_STATUS.ACTIVE });

const lastAdminError = () =>
  ApiError.conflict(
    'This is the last active admin account; it cannot be suspended or deleted.',
    undefined,
    {
      code: ERROR_CODES.LAST_ADMIN,
    },
  );

function refuseSelf(actor, id, verb) {
  if (String(actor.id) === String(id)) {
    throw ApiError.forbidden(`You cannot ${verb} your own account.`);
  }
}

/** PATCH /api/users/:id/suspend — ends every session immediately. */
export async function suspendUser(actor, id, { reason } = {}, meta = {}) {
  refuseSelf(actor, id, 'suspend');
  const user = await requireUser(id);
  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw ApiError.conflict(
      `Only active accounts can be suspended (this account is ${user.status}).`,
    );
  }
  const isAdmin = user.role === ROLES.ADMIN;
  if (isAdmin && (await countActiveAdmins()) <= 1) throw lastAdminError();

  const { modifiedCount } = await User.updateOne(
    { _id: id, status: ACCOUNT_STATUS.ACTIVE },
    { $set: { status: ACCOUNT_STATUS.SUSPENDED } },
  );
  if (!modifiedCount) throw ApiError.conflict('The account status changed; reload and try again.');

  // Two admins suspending each other at once could both pass the check above: re-count after
  // the write and undo if no active admin would remain.
  if (isAdmin && (await countActiveAdmins()) === 0) {
    await User.updateOne({ _id: id }, { $set: { status: ACCOUNT_STATUS.ACTIVE } });
    throw lastAdminError();
  }

  await invalidateUserSessions(id, 'suspended');
  await recordAudit({
    actorId: actor.id,
    action: 'user.suspend',
    entityType: 'User',
    entityId: user._id,
    before: { status: ACCOUNT_STATUS.ACTIVE },
    after: { status: ACCOUNT_STATUS.SUSPENDED, reason, sessionsRevoked: true },
    meta,
  });
  return getUser(id);
}

/** PATCH /api/users/:id/reactivate — suspended → active. */
export async function reactivateUser(actor, id, meta = {}) {
  const user = await requireUser(id);
  if (user.status !== ACCOUNT_STATUS.SUSPENDED) {
    throw ApiError.conflict(
      `Only suspended accounts can be reactivated (this account is ${user.status}).`,
    );
  }
  await User.updateOne({ _id: id }, { $set: { status: ACCOUNT_STATUS.ACTIVE } });
  await recordAudit({
    actorId: actor.id,
    action: 'user.reactivate',
    entityType: 'User',
    entityId: user._id,
    before: { status: ACCOUNT_STATUS.SUSPENDED },
    after: { status: ACCOUNT_STATUS.ACTIVE },
    meta,
  });
  return getUser(id);
}

/**
 * DELETE /api/users/:id — only accounts without history (attendance, results, assignments…);
 * otherwise 409 USER_HAS_HISTORY suggesting suspension.
 */
export async function deleteUser(actor, id, meta = {}) {
  refuseSelf(actor, id, 'delete');
  const user = await requireUser(id);
  if (
    user.role === ROLES.ADMIN &&
    user.status === ACCOUNT_STATUS.ACTIVE &&
    (await countActiveAdmins()) <= 1
  ) {
    throw lastAdminError();
  }

  const history = await countUserHistory(user);
  if (Object.keys(history).length) {
    throw ApiError.conflict(
      `Cannot delete ${user.name}: ${describeCounts(history)} are linked to this account. ` +
        'Suspend the account instead.',
      undefined,
      { code: ERROR_CODES.USER_HAS_HISTORY, details: { history } },
    );
  }

  await withTransaction(async (session) => {
    const profile =
      (await StudentProfile.findOneAndDelete({ userId: id }, { session })) ??
      (await TeacherProfile.findOneAndDelete({ userId: id }, { session }));
    await RefreshToken.deleteMany({ userId: id }, { session });
    await Notification.deleteMany({ recipientId: id }, { session });
    await User.deleteOne({ _id: id }, { session });
    await recordAudit(
      {
        actorId: actor.id,
        action: 'user.delete',
        entityType: 'User',
        entityId: user._id,
        before: { ...userSummary(user), ...(profile && { profile: profile.toObject() }) },
        meta,
      },
      { session },
    );
  });
}
