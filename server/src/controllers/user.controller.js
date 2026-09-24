import * as authService from '../services/auth.service.js';
import * as registrationService from '../services/registration.service.js';
import * as userService from '../services/user.service.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { requestMeta } from '../utils/requestMeta.js';

const id = (req) => req.validated.params.id;

export async function list(req, res) {
  const { items, meta } = await userService.listUsers(req.validated.query);
  return sendSuccess(res, { data: items, meta });
}

export async function get(req, res) {
  return sendSuccess(res, { data: await userService.getUser(id(req)) });
}

export async function nextRoll(req, res) {
  return sendSuccess(res, { data: await userService.getNextRoll(req.validated.query) });
}

export async function create(req, res) {
  const user = await userService.createUser(req.user, req.body, requestMeta(req));
  return sendCreated(res, {
    message: 'Account created. The user must change the password at first sign-in.',
    data: user,
  });
}

export async function update(req, res) {
  const user = await userService.updateUser(req.user, id(req), req.body, requestMeta(req));
  return sendSuccess(res, { message: 'Account updated', data: user });
}

export async function suspend(req, res) {
  const user = await userService.suspendUser(req.user, id(req), req.body, requestMeta(req));
  return sendSuccess(res, { message: 'Account suspended and signed out everywhere', data: user });
}

export async function reactivate(req, res) {
  const user = await userService.reactivateUser(req.user, id(req), requestMeta(req));
  return sendSuccess(res, { message: 'Account reactivated', data: user });
}

export async function approve(req, res) {
  const user = await registrationService.approveRegistration(
    req.user,
    id(req),
    req.body,
    requestMeta(req),
  );
  return sendSuccess(res, { message: 'Registration approved', data: user });
}

export async function reject(req, res) {
  const user = await registrationService.rejectRegistration(
    req.user,
    id(req),
    req.body,
    requestMeta(req),
  );
  return sendSuccess(res, { message: 'Registration rejected', data: user });
}

export async function remove(req, res) {
  await userService.deleteUser(req.user, id(req), requestMeta(req));
  return sendSuccess(res, { message: 'Account deleted' });
}

/** PATCH /api/users/:id/password (admin, FR-AUTH-05) */
export async function resetPassword(req, res) {
  const user = await authService.adminResetPassword(
    req.user.id,
    id(req),
    req.body.newPassword,
    requestMeta(req),
  );
  return sendSuccess(res, {
    message: 'Password reset. The user has been signed out and must choose a new password.',
    data: { user },
  });
}
