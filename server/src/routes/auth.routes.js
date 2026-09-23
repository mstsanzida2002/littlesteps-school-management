import { Router } from 'express';

import { env } from '../config/env.js';
import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { createAuthLimiters } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { changePasswordSchema, loginSchema, registerSchema } from '../validators/auth.validator.js';

export function createAuthRouter({ selfRegistrationEnabled = env.SELF_REGISTRATION_ENABLED } = {}) {
  const router = Router();
  const limit = createAuthLimiters();

  router.post(
    '/login',
    limit.loginPerIp,
    limit.login,
    validate({ body: loginSchema }),
    asyncHandler(auth.login),
  );
  router.post('/refresh', limit.refresh, asyncHandler(auth.refresh));
  // No authenticate: logout must work even after the access token has expired.
  router.post('/logout', asyncHandler(auth.logout));
  router.get('/me', authenticate, asyncHandler(auth.me));
  router.patch(
    '/password',
    authenticate,
    validate({ body: changePasswordSchema }),
    asyncHandler(auth.changePassword),
  );

  // FR-AUTH-06 (optional): when disabled the route does not exist (404).
  if (selfRegistrationEnabled) {
    router.post(
      '/register',
      limit.register,
      validate({ body: registerSchema }),
      asyncHandler(auth.register),
    );
  }

  return router;
}
