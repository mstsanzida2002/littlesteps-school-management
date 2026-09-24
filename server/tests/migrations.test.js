import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { markAllApplied, migrationStatus, runMigrations } from '../src/migrations/runner.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';

beforeAll(startTestDB);
afterEach(async () => {
  await clearTestDB();
  await mongoose.connection.db.collection('migrations').deleteMany({});
  await mongoose.connection.db.collection('migration_lock').deleteMany({});
});
afterAll(stopTestDB);

const silent = { info: () => {}, warn: () => {}, error: () => {} };
const db = () => mongoose.connection.db;

async function tempMigrations(files) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ls-migrations-'));
  for (const [name, body] of Object.entries(files)) await writeFile(path.join(dir, name), body);
  return dir;
}

describe('migration runner', () => {
  it('applies pending migrations once, in order, and records them', async () => {
    const dir = await tempMigrations({
      '002-second.js': `export default { description: 'second', async up({ db }) { await db.collection('trail').insertOne({ n: 2 }); } };`,
      '001-first.js': `export default { description: 'first', async up({ db }) { await db.collection('trail').insertOne({ n: 1 }); } };`,
      'notes.txt': 'ignored',
    });
    try {
      expect(await runMigrations({ dir, logger: silent })).toEqual(['001-first', '002-second']);
      expect(await runMigrations({ dir, logger: silent })).toEqual([]);
      const trail = await db().collection('trail').find().sort({ _id: 1 }).toArray();
      expect(trail.map((t) => t.n)).toEqual([1, 2]);
      const status = await migrationStatus({ dir });
      expect(status.every((m) => m.appliedAt instanceof Date)).toBe(true);
      expect(await db().collection('migration_lock').countDocuments()).toBe(0); // released
    } finally {
      await rm(dir, { recursive: true });
      await db()
        .collection('trail')
        .drop()
        .catch(() => {});
    }
  });

  it('a failing migration is not recorded and releases the lock', async () => {
    const dir = await tempMigrations({
      '001-broken.js': `export default { description: 'broken', async up() { throw new Error('boom'); } };`,
    });
    try {
      await expect(runMigrations({ dir, logger: silent })).rejects.toThrow('boom');
      expect(await db().collection('migrations').countDocuments()).toBe(0);
      expect(await db().collection('migration_lock').countDocuments()).toBe(0);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it('waits for / refuses a held lock and takes over one without a heartbeat', async () => {
    const dir = await tempMigrations({
      '001-noop.js': `export default { description: 'noop', async up() {} };`,
    });
    try {
      await db().collection('migration_lock').insertOne({
        _id: 'lock',
        owner: 'other',
        acquiredAt: new Date(),
        heartbeatAt: new Date(),
      });
      await expect(runMigrations({ dir, logger: silent, waitForLockMs: 50 })).rejects.toThrow(
        /lock/,
      );

      await db()
        .collection('migration_lock')
        .updateOne({ _id: 'lock' }, { $set: { heartbeatAt: new Date(Date.now() - 31_000) } });
      expect(await runMigrations({ dir, logger: silent, waitForLockMs: 50 })).toEqual(['001-noop']);

      // Nothing pending → no lock needed at all, even if someone holds it.
      await db().collection('migration_lock').insertOne({
        _id: 'lock',
        owner: 'other',
        acquiredAt: new Date(),
        heartbeatAt: new Date(),
      });
      expect(await runMigrations({ dir, logger: silent, waitForLockMs: 50 })).toEqual([]);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

describe('real migrations', () => {
  it('001–004 backfill TeacherAssignment.status, attendanceAlert and attendanceBackdateDays', async () => {
    await db()
      .collection('teacherassignments')
      .insertOne({ teacherId: new mongoose.Types.ObjectId() });
    await db().collection('studentprofiles').insertOne({ rollNo: 1, nickname: '' });
    await db().collection('settings').insertOne({ key: 'global', attendanceThreshold: 75 });
    await db().collection('assessments').insertOne({ name: 'Old test' });
    await db().collection('results').insertOne({ marksObtained: 5 });
    const createdAt = new Date('2026-01-10T00:00:00Z');
    await db().collection('notices').insertOne({ title: 'Old notice', createdAt });

    const applied = await runMigrations({ logger: silent });
    expect(applied).toEqual([
      '001-teacher-assignment-status',
      '002-attendance-notifications',
      '003-results-meetings-notices',
      '004-student-nickname',
    ]);
    expect((await db().collection('assessments').findOne()).mode).toBe('marks');
    expect((await db().collection('results').findOne()).attendance).toBe('present');
    expect(await db().collection('notices').findOne()).toMatchObject({
      status: 'published',
      publishedAt: createdAt,
    });

    expect((await db().collection('teacherassignments').findOne()).status).toBe('active');
    const profile = await db().collection('studentprofiles').findOne();
    expect(profile.attendanceAlert).toEqual({ belowThreshold: false });
    expect(profile).not.toHaveProperty('nickname');
    expect((await db().collection('settings').findOne()).attendanceBackdateDays).toBe(7);
  });

  it('seed baseline marks every migration as applied without running it', async () => {
    const ids = await markAllApplied();
    expect(ids).toContain('002-attendance-notifications');
    expect(await runMigrations({ logger: silent })).toEqual([]);
  });
});
