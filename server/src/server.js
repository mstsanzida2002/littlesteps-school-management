import http from 'node:http';

import { env } from './config/env.js';
import { connectDB, connectInBackground, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { runMigrations } from './migrations/runner.js';
import { initRealtime, closeRealtime } from './realtime/io.js';
import { logger } from './utils/logger.js';

/** Pending migrations run before the server accepts traffic (the runner's lock serializes instances). */
async function migrateOrExit() {
  try {
    await runMigrations();
  } catch (err) {
    logger.error('Migrations failed; refusing to start:', err);
    process.exit(1);
  }
}

async function start() {
  try {
    await connectDB();
    if (env.MONGODB_URI) await migrateOrExit();
  } catch (err) {
    if (env.isProd) {
      // Fail the deploy loudly (e.g. a wrong MONGODB_URI); Render restarts the instance.
      logger.error('Could not connect to MongoDB:', err.message);
      process.exit(1);
    }
    // Development: keep the API up (503s) and keep retrying in the background.
    logger.warn(`Could not connect to MongoDB (${err.message}). Retrying in the background.`);
    connectInBackground({ onConnected: migrateOrExit });
  }

  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server);
  server.listen(env.PORT, () => {
    logger.info(`LittleSteps API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    closeRealtime();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if connections do not drain in time.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

start();
