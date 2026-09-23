import { Router } from 'express';

import { ROLES } from '../config/constants.js';
import { resetPassword } from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { adminResetPasswordSchema } from '../validators/auth.validator.js';
import { idParams } from '../validators/common.validator.js';

export function createUserRouter() {
  const router = Router();

  router.use(authenticate, authorize(ROLES.ADMIN));

  router.patch(
    '/:id/password',
    validate({ params: idParams, body: adminResetPasswordSchema }),
    asyncHandler(resetPassword),
  );

  return router;
}
