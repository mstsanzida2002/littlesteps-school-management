/**
 * Audit trail (FR-ADM-09/11). Every admin create/update/delete/status change writes one entry.
 * Only changed fields are stored, and secrets are always stripped.
 */
import { AuditLog } from '../models/index.js';
import { addDays, atSchoolTime, toSchoolDate } from '../utils/date.js';
import { paginate } from '../utils/listQuery.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'tokenVersion',
  '__v',
]);

/** Deep copy to plain JSON-safe values without sensitive keys. */
export function sanitizeForAudit(value) {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (typeof value.toHexString === 'function') return value.toString(); // ObjectId
  if (typeof value.toObject === 'function') return sanitizeForAudit(value.toObject());
  if (Array.isArray(value)) return value.map(sanitizeForAudit);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.has(key))
      .map(([key, v]) => [key, sanitizeForAudit(v)]),
  );
}

const same = (a, b) => JSON.stringify(sanitizeForAudit(a)) === JSON.stringify(sanitizeForAudit(b));

/** { before, after } containing only the keys of `after` whose values changed. */
export function diffChanges(before = {}, after = {}) {
  const changed = Object.keys(after).filter((key) => !same(before[key], after[key]));
  return {
    before: Object.fromEntries(changed.map((key) => [key, before[key]])),
    after: Object.fromEntries(changed.map((key) => [key, after[key]])),
  };
}

/**
 * Write one audit entry. Pass `{ session }` inside a transaction.
 * @param {{ actorId, action, entityType, entityId?, before?, after?, meta? }} entry
 */
export async function recordAudit(
  { actorId, action, entityType, entityId, before, after, meta = {} },
  { session } = {},
) {
  const changes = {};
  if (before !== undefined) changes.before = sanitizeForAudit(before);
  if (after !== undefined) changes.after = sanitizeForAudit(after);

  await AuditLog.create(
    [
      {
        actorId,
        action,
        entityType,
        entityId,
        changes,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    ],
    { session },
  );
}

/** GET /api/audit-logs — `from`/`to` are Asia/Dhaka calendar days (inclusive). */
export function listAuditLogs({
  page,
  limit,
  sort,
  action,
  actorId,
  entityType,
  entityId,
  from,
  to,
}) {
  const filter = {};
  if (action) filter.action = action;
  if (actorId) filter.actorId = actorId;
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = atSchoolTime(toSchoolDate(from), '00:00');
    if (to) filter.createdAt.$lt = atSchoolTime(addDays(toSchoolDate(to), 1), '00:00');
  }
  return paginate(AuditLog, filter, {
    page,
    limit,
    sort,
    populate: { path: 'actorId', select: 'name username role' },
  });
}
