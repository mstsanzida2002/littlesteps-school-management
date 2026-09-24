/**
 * Notifications (FR-NOT-01…05).
 *
 * Write path: services create/update Notification documents INSIDE their transaction and record
 * what to deliver in an **outbox**. After the transaction commits, `dispatchOutbox` emits the
 * Socket.io events and sends emails. Nothing is delivered for a rolled-back transaction, and a
 * delivery failure never affects the stored data.
 *
 * Build a fresh outbox inside the transaction callback: withTransaction may retry the callback.
 */
import { Notification } from '../models/index.js';
import { sendEmail } from '../notifications/email.js';
import { emitToUser } from '../realtime/io.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/listQuery.js';
import { logger } from '../utils/logger.js';

export function createOutbox() {
  return { events: [], emails: [] };
}

/** Queue a socket event for after commit. `event`: 'notification:new' | 'notification:updated'. */
export function queueNotificationEvent(outbox, event, notification) {
  outbox.events.push({ userId: String(notification.recipientId), event, notification });
}

/** Queue an email for after commit ({ to, subject, text }). */
export function queueEmail(outbox, email) {
  if (email?.to) outbox.emails.push(email);
}

export const countUnread = (userId) =>
  Notification.countDocuments({ recipientId: userId, isRead: false });

async function emitUnreadCount(userId) {
  emitToUser(userId, 'notifications:unread-count', { count: await countUnread(userId) });
}

/** Deliver everything queued in the outbox. Call only after the transaction committed. */
export async function dispatchOutbox(outbox) {
  if (!outbox) return;
  try {
    for (const { userId, event, notification } of outbox.events) {
      emitToUser(userId, event, notification.toJSON?.() ?? notification);
    }
    const users = [...new Set(outbox.events.map((e) => e.userId))];
    await Promise.all(users.map(emitUnreadCount));
  } catch (err) {
    logger.error('Real-time dispatch failed:', err);
  }
  // Emails are fire-and-forget: never delay the HTTP response on an SMTP/API round trip.
  if (outbox.emails.length) {
    Promise.allSettled(outbox.emails.map((email) => sendEmail(email))).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// API (own notifications only)

/** GET /api/notifications */
export function listNotifications(userId, { page, limit, sort, unread, type }) {
  const filter = { recipientId: userId };
  if (unread !== undefined) filter.isRead = !unread;
  if (type) filter.type = type;
  return paginate(Notification, filter, { page, limit, sort, select: '-dedupeKey -__v' });
}

/** PATCH /api/notifications/:id/read — 404 for anything that isn't the caller's own. */
export async function markRead(userId, id) {
  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipientId: userId },
    { $set: { isRead: true, readAt: new Date() } },
    { returnDocument: 'after', projection: { dedupeKey: 0 } },
  );
  if (!notification) throw ApiError.notFound('Notification not found');
  await emitUnreadCount(userId);
  return notification.toJSON();
}

/** PATCH /api/notifications/read-all */
export async function markAllRead(userId) {
  const { modifiedCount } = await Notification.updateMany(
    { recipientId: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
  await emitUnreadCount(userId);
  return { updated: modifiedCount };
}
