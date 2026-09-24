/**
 * Pending self-registrations (FR-ADM-02, FR-AUTH-06).
 */
import { ACCOUNT_STATUS, ROLES } from '../config/constants.js';
import { StudentProfile, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { todaySchoolDate, toDateKey, toSchoolDate } from '../utils/date.js';
import { withTransaction } from '../utils/transaction.js';
import { recordAudit } from './audit.service.js';
import {
  nextRollNumber,
  requireActiveSession,
  requireSectionInClass,
  rethrowRollConflict,
} from './lookup.service.js';
import { syncStudentMeetingInvites } from './meeting.service.js';
import { createOutbox, dispatchOutbox } from './notification.service.js';
import { getUser } from './user.service.js';

async function requirePendingRegistration(id, { session } = {}) {
  const user = await User.findById(id).session(session ?? null);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role !== ROLES.STUDENT || user.status !== ACCOUNT_STATUS.PENDING || !user.registration) {
    throw ApiError.conflict(
      `Only pending registrations can be reviewed (this account is ${user.status}).`,
    );
  }
  return user;
}

/**
 * PATCH /api/users/:id/approve — in ONE transaction: create the StudentProfile from the stored
 * registration (active session), activate the account, remove `registration`, write the audit.
 * A roll-number conflict rolls everything back (the account stays pending).
 */
export async function approveRegistration(actor, id, input, meta = {}) {
  const pending = await requirePendingRegistration(id);
  const activeSession = await requireActiveSession();
  await requireSectionInClass(input.classId, input.sectionId);

  const { registration } = pending;
  const dateOfBirth = input.dateOfBirth ?? registration.dateOfBirth;
  if (!dateOfBirth) {
    throw ApiError.invalidField(
      'dateOfBirth',
      'The registration has no date of birth; provide dateOfBirth to approve it.',
    );
  }

  const base = { classId: input.classId, sectionId: input.sectionId, sessionId: activeSession._id };
  const placement = {
    ...base,
    rollNo: input.rollNo ?? (await nextRollNumber(base)).suggestedRollNo,
  };

  let outbox;
  try {
    outbox = await withTransaction(async (session) => {
      const txOutbox = createOutbox();
      const user = await requirePendingRegistration(id, { session });
      const reg = user.registration.toObject();

      await StudentProfile.create(
        [
          {
            userId: user._id,
            ...placement,
            dateOfBirth,
            gender: reg.gender,
            admissionDate: input.admissionDate ?? todaySchoolDate(),
            guardian: reg.guardian,
            nickname: input.nickname,
          },
        ],
        { session },
      );

      user.status = ACCOUNT_STATUS.ACTIVE;
      user.registration = undefined;
      await user.save({ session });

      // Join upcoming meetings targeting everyone / this class / this section.
      await syncStudentMeetingInvites({
        studentId: user._id,
        sessionId: placement.sessionId,
        from: null,
        to: placement,
        session,
        outbox: txOutbox,
      });

      await recordAudit(
        {
          actorId: actor.id,
          action: 'user.approve',
          entityType: 'User',
          entityId: user._id,
          before: { status: ACCOUNT_STATUS.PENDING, registration: reg },
          after: {
            status: ACCOUNT_STATUS.ACTIVE,
            profile: { ...placement, dateOfBirth: toDateKey(toSchoolDate(dateOfBirth)) },
          },
          meta,
        },
        { session },
      );
      return txOutbox;
    });
  } catch (err) {
    await rethrowRollConflict(err, placement);
  }
  await dispatchOutbox(outbox);
  return getUser(id);
}

/** PATCH /api/users/:id/reject — keeps the account (status rejected) with the reason. */
export async function rejectRegistration(actor, id, { reason }, meta = {}) {
  const user = await requirePendingRegistration(id);
  user.status = ACCOUNT_STATUS.REJECTED;
  user.registration.review = { reason, reviewedBy: actor.id, reviewedAt: new Date() };
  await user.save();

  await recordAudit({
    actorId: actor.id,
    action: 'user.reject',
    entityType: 'User',
    entityId: user._id,
    before: { status: ACCOUNT_STATUS.PENDING },
    after: { status: ACCOUNT_STATUS.REJECTED, reason },
    meta,
  });
  return getUser(id);
}
