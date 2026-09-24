import { Router } from 'express';

import { ROLES } from '../config/constants.js';
import * as users from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { adminResetPasswordSchema } from '../validators/auth.validator.js';
import { idParams } from '../validators/common.validator.js';
import {
  approveSchema,
  createUserSchema,
  listUsersQuery,
  nextRollQuery,
  rejectSchema,
  suspendSchema,
  updateUserSchema,
} from '../validators/user.validator.js';

/** /api/users — admin only (FR-ADM-01/02/05/06, FR-AUTH-05). */
export function createUserRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', validate({ query: listUsersQuery }), asyncHandler(users.list));
  router.post('/', validate({ body: createUserSchema }), asyncHandler(users.create));
  // Before '/:id' so "next-roll" is not taken as an id.
  router.get('/next-roll', validate({ query: nextRollQuery }), asyncHandler(users.nextRoll));

  router.get('/:id', validate({ params: idParams }), asyncHandler(users.get));
  router.patch(
    '/:id',
    validate({ params: idParams, body: updateUserSchema }),
    asyncHandler(users.update),
  );
  router.delete('/:id', validate({ params: idParams }), asyncHandler(users.remove));

  router.patch(
    '/:id/suspend',
    validate({ params: idParams, body: suspendSchema }),
    asyncHandler(users.suspend),
  );
  router.patch('/:id/reactivate', validate({ params: idParams }), asyncHandler(users.reactivate));
  router.patch(
    '/:id/approve',
    validate({ params: idParams, body: approveSchema }),
    asyncHandler(users.approve),
  );
  router.patch(
    '/:id/reject',
    validate({ params: idParams, body: rejectSchema }),
    asyncHandler(users.reject),
  );
  router.patch(
    '/:id/password',
    validate({ params: idParams, body: adminResetPasswordSchema }),
    asyncHandler(users.resetPassword),
  );

  return router;
}
