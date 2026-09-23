import { Router } from 'express';

import { createAuthRouter } from './auth.routes.js';
import healthRoutes from './health.routes.js';
import { createUserRouter } from './user.routes.js';

/**
 * Builds the /api router. A factory (not a module singleton) so each app instance gets fresh
 * rate-limit counters and options (e.g. tests toggling self-registration).
 */
export function createApiRouter({ selfRegistrationEnabled, testRouter } = {}) {
  const router = Router();

  router.use('/health', healthRoutes);
  router.use('/auth', createAuthRouter({ selfRegistrationEnabled }));
  router.use('/users', createUserRouter());

  // Test-only routes (never passed in production code).
  if (testRouter) router.use('/test', testRouter);

  return router;
}
