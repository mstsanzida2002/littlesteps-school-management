import { Router } from 'express';

import { env } from '../config/env.js';
import * as auth from '../controllers/auth.controller.js';
import { authenticateAllowingPasswordChange } from '../middleware/auth.js';
import { signalsDataChange } from '../middleware/dataChanged.js';
import { createAuthLimiters } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { changePasswordSchema, loginSchema, registerSchema } from '../validators/auth.validator.js';

export function createAuthRouter({
  selfRegistrationEnabled = env.SELF_REGISTRATION_ENABLED,
  rateLimits,
} = {}) {
  const router = Router();
  const limit = createAuthLimiters(rateLimits);

  router.post(
    '/login',
    limit.loginPerIp,
    limit.login,
    validate({ body: loginSchema }),
    asyncHandler(auth.login),
  );
  // The cheap per-IP backstop runs first; the per-session limiter needs a lookup.
  router.post('/refresh', limit.refreshPerIp, limit.refreshPerSession, asyncHandler(auth.refresh));
  // No authenticate: logout must work even after the access token has expired.
  router.post('/logout', asyncHandler(auth.logout));
  // /me and /password stay reachable while mustChangePassword is set.
  router.get('/me', authenticateAllowingPasswordChange, asyncHandler(auth.me));
  router.patch(
    '/password',
    authenticateAllowingPasswordChange,
    validate({ body: changePasswordSchema }),
    asyncHandler(auth.changePassword),
  );

  // FR-AUTH-06 (optional): when disabled the route does not exist (404).
  if (selfRegistrationEnabled) {
    router.post(
      '/register',
      limit.register,
      // A new registration appears in the admins' approvals queue straight away.
      signalsDataChange('registrations'),
      validate({ body: registerSchema }),
      asyncHandler(auth.register),
    );
  }

  return router;
}
