/**
 * Development seed.
 *
 *   npm run seed             # refuses if the database already has data
 *   npm run seed -- --reset  # clears LittleSteps collections first (re-runnable)
 *   npm run seed -- --reset --large   # ~500 students, for performance testing
 *   npm run seed -- --reset --e2e     # also leave the latest school day unmarked
 *
 * Safety: never runs with NODE_ENV=production, and only writes to databases whose name
 * ends in _dev or _test.
 */
import mongoose from 'mongoose';

import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import * as models from '../models/index.js';
import { seedDatabase } from './seedDatabase.js';

const SAFE_DB_NAME = /_(dev|test)$/;

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exitCode = 1;
}

async function main() {
  const reset = process.argv.includes('--reset');

  if (env.isProd) return fail('Refusing to seed: NODE_ENV=production.');
  if (!env.MONGODB_URI) return fail('MONGODB_URI is not set (see server/.env.example).');

  await connectDB();
  const dbName = mongoose.connection.name;
  console.log(`\nConnected database: "${dbName}" on ${mongoose.connection.host}`);

  if (!SAFE_DB_NAME.test(dbName)) {
    return fail(
      `Refusing to seed "${dbName}": the database name must end in _dev or _test. ` +
        'Put the name in MONGODB_URI, e.g. .../littlesteps_dev?retryWrites=true',
    );
  }

  if (reset) {
    console.log('--reset: clearing LittleSteps collections…');
    // Sequential on purpose: the free Atlas tier (M0) throttles bursts of parallel operations.
    for (const model of Object.values(models)) await model.deleteMany({});
  } else if (await models.User.exists({})) {
    return fail(`"${dbName}" already has data. Re-run with --reset to clear and reseed.`);
  }

  await seedDatabase({
    large: process.argv.includes('--large'),
    e2e: process.argv.includes('--e2e'),
  });
}

main()
  .catch((err) => {
    console.error('\n✖ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
