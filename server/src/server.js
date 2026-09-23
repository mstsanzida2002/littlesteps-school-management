import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

async function start() {
  try {
    await connectDB();
  } catch (err) {
    if (env.isProd) {
      logger.error('Could not connect to MongoDB:', err.message);
      process.exit(1);
    }
    // In development, keep the API up so /api/health can report the problem.
    logger.warn(`Could not connect to MongoDB (${err.message}). Continuing without a database.`);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`LittleSteps API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
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
