import * as authService from '../services/auth.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { requestMeta } from './auth.controller.js';

/** PATCH /api/users/:id/password (admin, FR-AUTH-05) */
export async function resetPassword(req, res) {
  const user = await authService.adminResetPassword(
    req.user.id,
    req.validated.params.id,
    req.body.newPassword,
    requestMeta(req),
  );
  return sendSuccess(res, {
    message: 'Password reset. The user has been signed out everywhere.',
    data: { user },
  });
}
