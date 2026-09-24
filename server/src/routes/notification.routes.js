import { Router } from 'express';

import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as notifications from '../services/notification.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listNotificationsQuery } from '../validators/attendance.validator.js';
import { idParams } from '../validators/common.validator.js';

/** /api/notifications — every signed-in user, own notifications only (FR-NOT-03/04). */
export function createNotificationRouter() {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/',
    validate({ query: listNotificationsQuery }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await notifications.listNotifications(
        req.user.id,
        req.validated.query,
      );
      sendSuccess(res, { data: items, meta });
    }),
  );
  router.get(
    '/unread-count',
    asyncHandler(async (req, res) =>
      sendSuccess(res, { data: { count: await notifications.countUnread(req.user.id) } }),
    ),
  );
  router.patch(
    '/read-all',
    asyncHandler(async (req, res) =>
      sendSuccess(res, { data: await notifications.markAllRead(req.user.id) }),
    ),
  );
  router.patch(
    '/:id/read',
    validate({ params: idParams }),
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        data: await notifications.markRead(req.user.id, req.validated.params.id),
      }),
    ),
  );
  return router;
}
