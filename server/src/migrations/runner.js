/**
 * Forward-only data migrations.
 *
 * - Files: src/migrations/NNN-short-name.js, each `export default { description, up }` where
 *   `up({ db, mongoose, logger })` receives the native Db. Applied in filename order.
 * - Applied migrations are recorded in the `migrations` collection (_id = file name without .js).
 * - The lock is taken ONLY when something is pending (most starts have nothing to do, so
 *   restarts and multiple instances never wait on each other). A lock document in
 *   `migration_lock` guarantees one runner at a time; the holder refreshes `heartbeatAt` every
 *   HEARTBEAT_MS, and a lock without a heartbeat for LOCK_STALE_MS is taken over (crashed or
 *   killed runner, e.g. a dev --watch restart mid-migration).
 * - Runs via `npm run migrate` and automatically at server start-up (before listening).
 * - Every schema change needs a migration (see CLAUDE.md). `up` must be idempotent.
 */
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import mongoose from 'mongoose';

import { logger as defaultLogger } from '../utils/logger.js';

const MIGRATIONS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE_RE = /^\d{3}-[\w-]+\.js$/;
const LOCK_ID = 'lock';
const LOCK_STALE_MS = 30_000;
const HEARTBEAT_MS = 5_000;
const POLL_MS = 1_000;

const collections = (db) => ({
  applied: db.collection('migrations'),
  lock: db.collection('migration_lock'),
});

/** All migration files in order: [{ id, description, up }]. */
export async function loadMigrations(dir = MIGRATIONS_DIR) {
  const files = (await readdir(dir)).filter((f) => FILE_RE.test(f)).sort();
  const migrations = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href);
    const migration = mod.default;
    if (typeof migration?.up !== 'function') {
      throw new Error(`Migration ${file} must export default { description, up }`);
    }
    migrations.push({ id: file.replace(/\.js$/, ''), ...migration });
  }
  return migrations;
}

async function acquireLock(db, { owner, waitMs }) {
  const { lock } = collections(db);
  const deadline = Date.now() + waitMs;
  for (;;) {
    const now = new Date();
    try {
      await lock.insertOne({ _id: LOCK_ID, owner, acquiredAt: now, heartbeatAt: now });
      return;
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
    // Take over a lock whose holder stopped sending heartbeats (crashed / killed).
    const cutoff = new Date(now.getTime() - LOCK_STALE_MS);
    const stale = await lock.findOneAndUpdate(
      {
        _id: LOCK_ID,
        $or: [
          { heartbeatAt: { $lt: cutoff } },
          { heartbeatAt: { $exists: false }, acquiredAt: { $lt: cutoff } },
        ],
      },
      { $set: { owner, acquiredAt: now, heartbeatAt: now } },
    );
    if (stale) return;
    if (Date.now() >= deadline) {
      throw new Error('Another migration run holds the lock; try again later.');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

const releaseLock = (db, owner) => collections(db).lock.deleteOne({ _id: LOCK_ID, owner });

/**
 * Apply every pending migration in order. Returns the ids applied.
 * @param {{ dir?: string, waitForLockMs?: number, logger?: object }} [options]
 */
export async function runMigrations({
  dir = MIGRATIONS_DIR,
  waitForLockMs = 60_000,
  logger = defaultLogger,
} = {}) {
  const { db } = mongoose.connection;
  if (!db) throw new Error('Not connected to MongoDB');

  const all = await loadMigrations(dir);
  const pendingNow = async () => {
    const done = new Set(await collections(db).applied.distinct('_id'));
    return all.filter((m) => !done.has(m.id));
  };
  if (!(await pendingNow()).length) {
    logger.info('Migrations: database is up to date');
    return [];
  }

  const owner = randomUUID();
  await acquireLock(db, { owner, waitMs: waitForLockMs });
  const heartbeat = setInterval(() => {
    collections(db)
      .lock.updateOne({ _id: LOCK_ID, owner }, { $set: { heartbeatAt: new Date() } })
      .catch(() => {});
  }, HEARTBEAT_MS);
  heartbeat.unref?.();
  try {
    // Re-check under the lock: another instance may have just applied them.
    const applied = [];
    for (const migration of await pendingNow()) {
      const started = Date.now();
      logger.info(`Applying migration ${migration.id} — ${migration.description ?? ''}`);
      await migration.up({ db, mongoose, logger });
      await collections(db).applied.insertOne({
        _id: migration.id,
        description: migration.description,
        appliedAt: new Date(),
        durationMs: Date.now() - started,
      });
      applied.push(migration.id);
    }
    if (!applied.length) logger.info('Migrations: database is up to date');
    return applied;
  } finally {
    clearInterval(heartbeat);
    await releaseLock(db, owner);
  }
}

/** [{ id, description, appliedAt | null }] */
export async function migrationStatus({ dir = MIGRATIONS_DIR } = {}) {
  const { db } = mongoose.connection;
  const all = await loadMigrations(dir);
  const records = new Map(
    (await collections(db).applied.find().toArray()).map((r) => [r._id, r.appliedAt]),
  );
  return all.map((m) => ({
    id: m.id,
    description: m.description,
    appliedAt: records.get(m.id) ?? null,
  }));
}

/**
 * Record every migration as applied without running it. Used by `seed --reset`, whose fresh
 * data already has the current schema.
 */
export async function markAllApplied({ dir = MIGRATIONS_DIR } = {}) {
  const { db } = mongoose.connection;
  const all = await loadMigrations(dir);
  const { applied } = collections(db);
  await applied.deleteMany({});
  if (all.length) {
    await applied.insertMany(
      all.map((m) => ({
        _id: m.id,
        description: m.description,
        appliedAt: new Date(),
        durationMs: 0,
        baseline: true,
      })),
    );
  }
  return all.map((m) => m.id);
}
