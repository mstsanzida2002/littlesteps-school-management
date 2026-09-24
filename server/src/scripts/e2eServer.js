/**
 * API for the Playwright E2E suite (npm run e2e): an in-memory MongoDB replica set (the same
 * approach as tests/helpers/db.js, so transactions work), seeded with the --e2e demo data at
 * start-up. Nothing touches Atlas or littlesteps_dev, and every run starts from the same data.
 *
 *   npm run e2e:api -w server     # PORT, CLIENT_ORIGIN etc. come from the environment
 *
 * Never used in production: mongodb-memory-server is a dev dependency.
 */
import http from 'node:http';

import { MongoMemoryReplSet } from 'mongodb-memory-server';

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
// Set before config/env.js is imported: real environment variables win over server/.env.
process.env.MONGODB_URI = replSet.getUri('littlesteps_e2e_test');

const { env } = await import('../config/env.js');
const { connectDB, disconnectDB } = await import('../config/db.js');
const { createApp } = await import('../app.js');
const { initRealtime, closeRealtime } = await import('../realtime/io.js');
const { seedDatabase } = await import('../seed/seedDatabase.js');

if (env.isProd) throw new Error('The E2E API must not run with NODE_ENV=production');

await connectDB();
const started = Date.now();
const { markableDay } = await seedDatabase({ e2e: true, log: () => {} });
console.log(`E2E database seeded in ${Date.now() - started} ms (attendance day: ${markableDay})`);

const server = http.createServer(createApp());
initRealtime(server);
server.listen(env.PORT, () => {
  console.log(`E2E API listening on http://localhost:${env.PORT} (in-memory MongoDB)`);
});

async function shutdown(code = 0) {
  closeRealtime();
  server.close();
  await disconnectDB();
  await replSet.stop();
  process.exit(code);
}
// e.g. the port is taken by a previous run: stop the in-memory MongoDB too.
server.on('error', (err) => {
  console.error(`E2E API could not start: ${err.message}`);
  shutdown(1);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
