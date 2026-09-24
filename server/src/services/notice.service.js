/**
 * Notices (FR-ADM-08, FR-STU-08). Admin writes; everyone reads what is meant for them.
 *
 * - Draft → publish. Publishing (one transaction) marks it published and bulk-inserts one 'notice'
 *   notification per ACTIVE user in the audience; sockets fire after the commit.
 * - Edits after publishing don't re-notify. Expire = expiresAt now.
 * - Non-admins only see published, unexpired notices for their audience ('all' or their role),
 *   pinned first.
 */
import { ACCOUNT_STATUS, ROLES } from '../config/constants.js';
import { Notice, Notification, User } from '../models/index.js';
import { NOTICE_STATUS } from '../models/notice.model.js';
import { ApiError } from '../utils/ApiError.js';
import { withTransaction } from '../utils/transaction.js';
import { diffChanges, recordAudit } from './audit.service.js';
import { createNotifications, createOutbox, dispatchOutbox } from './notification.service.js';

const AUDIENCE_ROLES = {
  all: [ROLES.ADMIN, ROLES.TEACHER, ROLES.STUDENT],
  teachers: [ROLES.TEACHER],
  students: [ROLES.STUDENT],
};
const ROLE_AUDIENCES = {
  [ROLES.TEACHER]: ['all', 'teachers'],
  [ROLES.STUDENT]: ['all', 'students'],
};
const EDITABLE = ['title', 'body', 'audience', 'isPinned', 'expiresAt'];

/** Visibility filter for a viewer (admins see everything). */
export function noticeVisibility(actor, now = new Date()) {
  if (actor.role === ROLES.ADMIN) return {};
  return {
    status: NOTICE_STATUS.PUBLISHED,
    audience: { $in: ROLE_AUDIENCES[actor.role] },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
}

const SORT = { isPinned: -1, publishedAt: -1, _id: -1 };

async function requireNotice(id) {
  const notice = await Notice.findById(id);
  if (!notice) throw ApiError.notFound('Notice not found');
  return notice;
}

/** Publish inside a transaction: mark published + one notification per active audience member. */
async function publishInSession(actor, notice, { session, outbox }) {
  if (notice.expiresAt && notice.expiresAt <= new Date()) {
    throw ApiError.invalidField('expiresAt', 'This notice has already expired');
  }
  notice.set({ status: NOTICE_STATUS.PUBLISHED, publishedAt: new Date(), publishedBy: actor.id });
  await notice.save({ session });
  const recipients = await User.find({
    role: { $in: AUDIENCE_ROLES[notice.audience] },
    status: ACCOUNT_STATUS.ACTIVE,
  })
    .select('_id')
    .session(session)
    .lean();
  await createNotifications(
    recipients.map((u) => ({
      recipientId: u._id,
      type: 'notice',
      title: `Notice: ${notice.title}`,
      message: notice.body.length > 240 ? `${notice.body.slice(0, 237)}…` : notice.body,
      data: { noticeId: String(notice._id), pinned: notice.isPinned },
      relatedEntity: { kind: 'Notice', id: notice._id },
    })),
    { session, outbox },
  );
  return recipients.length;
}

/** POST /api/notices — draft unless publish: true. */
export async function createNotice(actor, { publish, ...data }, meta = {}) {
  let recipients = 0;
  const { notice, outbox } = await withTransaction(async (session) => {
    const txOutbox = createOutbox();
    const [created] = await Notice.create([{ ...data, createdBy: actor.id }], { session });
    if (publish) recipients = await publishInSession(actor, created, { session, outbox: txOutbox });
    await recordAudit(
      {
        actorId: actor.id,
        action: publish ? 'notice.publish' : 'notice.create',
        entityType: 'Notice',
        entityId: created._id,
        after: { ...created.toObject(), recipients },
        meta,
      },
      { session },
    );
    return { notice: created, outbox: txOutbox };
  });
  await dispatchOutbox(outbox);
  return { notice: notice.toJSON(), recipients };
}

/** POST /api/notices/:id/publish */
export async function publishNotice(actor, id, meta = {}) {
  const notice = await requireNotice(id);
  if (notice.status === NOTICE_STATUS.PUBLISHED)
    throw ApiError.conflict('This notice is already published.');
  let recipients = 0;
  const outbox = await withTransaction(async (session) => {
    const txOutbox = createOutbox();
    recipients = await publishInSession(actor, notice, { session, outbox: txOutbox });
    await recordAudit(
      {
        actorId: actor.id,
        action: 'notice.publish',
        entityType: 'Notice',
        entityId: notice._id,
        before: { status: NOTICE_STATUS.DRAFT },
        after: { status: NOTICE_STATUS.PUBLISHED, recipients },
        meta,
      },
      { session },
    );
    return txOutbox;
  });
  await dispatchOutbox(outbox);
  return { notice: notice.toJSON(), recipients };
}

/** PATCH /api/notices/:id — edits never re-notify. */
export async function updateNotice(actor, id, changes, meta = {}) {
  const notice = await requireNotice(id);
  const before = notice.toObject();
  notice.set(changes);
  await notice.save();
  const pick = (o) => Object.fromEntries(EDITABLE.map((k) => [k, o[k]]));
  await recordAudit({
    actorId: actor.id,
    action: 'notice.update',
    entityType: 'Notice',
    entityId: notice._id,
    ...diffChanges(pick(before), pick(notice.toObject())),
    meta,
  });
  return notice.toJSON();
}

/** PATCH /api/notices/:id/expire */
export async function expireNotice(actor, id, meta = {}) {
  const notice = await requireNotice(id);
  const now = new Date();
  if (notice.expiresAt && notice.expiresAt <= now)
    throw ApiError.conflict('This notice has already expired.');
  const before = notice.expiresAt ?? null;
  notice.expiresAt = now;
  await notice.save();
  await recordAudit({
    actorId: actor.id,
    action: 'notice.expire',
    entityType: 'Notice',
    entityId: notice._id,
    before: { expiresAt: before },
    after: { expiresAt: now },
    meta,
  });
  return notice.toJSON();
}

/** DELETE /api/notices/:id — also removes its notifications. */
export async function deleteNotice(actor, id, meta = {}) {
  const notice = await requireNotice(id);
  await withTransaction(async (session) => {
    await Notification.deleteMany(
      { 'relatedEntity.kind': 'Notice', 'relatedEntity.id': notice._id },
      { session },
    );
    await Notice.deleteOne({ _id: notice._id }, { session });
    await recordAudit(
      {
        actorId: actor.id,
        action: 'notice.delete',
        entityType: 'Notice',
        entityId: notice._id,
        before: notice.toObject(),
        meta,
      },
      { session },
    );
  });
}

/** GET /api/notices — pinned first; admins may filter status/audience/expired. */
export async function listNotices(actor, { page, limit, status, audience, includeExpired }) {
  const now = new Date();
  const filter = noticeVisibility(actor, now);
  if (actor.role === ROLES.ADMIN) {
    if (status) filter.status = status;
    if (audience) filter.audience = audience;
    if (!includeExpired) filter.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
  }
  const [items, total] = await Promise.all([
    Notice.find(filter)
      .sort(SORT)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('publishedBy', 'name')
      .lean(),
    Notice.countDocuments(filter),
  ]);
  return {
    items: items.map((n) => ({ ...n, isExpired: Boolean(n.expiresAt && n.expiresAt <= now) })),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** GET /api/notices/:id — 404 when not visible to the viewer. */
export async function getNotice(actor, id) {
  const notice = await Notice.findOne({ _id: id, ...noticeVisibility(actor) })
    .populate('publishedBy', 'name')
    .lean();
  if (!notice) throw ApiError.notFound('Notice not found');
  return notice;
}
