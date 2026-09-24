/**
 *   npm run migrate              apply pending migrations
 *   npm run migrate -- --status  list migrations and when they were applied
 */
import mongoose from 'mongoose';

import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { migrationStatus, runMigrations } from '../migrations/runner.js';

async function main() {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await connectDB();
  console.log(`Database: "${mongoose.connection.name}"`);

  if (process.argv.includes('--status')) {
    for (const m of await migrationStatus()) {
      const when = m.appliedAt ? m.appliedAt.toISOString() : 'PENDING';
      console.log(`  ${m.id.padEnd(40)} ${when}`);
    }
    return;
  }

  const applied = await runMigrations();
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to apply.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
