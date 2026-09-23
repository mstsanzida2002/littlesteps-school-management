/**
 * In-memory MongoDB for integration tests.
 *
 *   import { beforeAll, afterAll, afterEach } from 'vitest';
 *   import { startTestDB, clearTestDB, stopTestDB } from './helpers/db.js';
 *
 *   beforeAll(startTestDB);
 *   afterEach(clearTestDB);
 *   afterAll(stopTestDB);
 *
 * Uses a single-node replica set so transactions work the same as on Atlas.
 * The mongod binary is downloaded and cached on first use.
 */
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet;

export async function startTestDB() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri('littlesteps-test'));
  // Build indexes (e.g. unique attendance index) so constraint tests behave like production.
  await mongoose.connection.syncIndexes();
}

export async function clearTestDB() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export async function stopTestDB() {
  await mongoose.disconnect();
  await replSet?.stop();
  replSet = undefined;
}
