import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { requestMeta } from '../utils/requestMeta.js';

export const REFRESH_COOKIE = 'ls_rt';

// Same-origin in dev (Vite proxy) and prod (Vercel rewrite), so Lax is enough and the cookie
// is first-party everywhere. Scoped to /api/auth so it is not sent with every API call.
const refreshCookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax',
  path: '/api/auth',
};

function sendSession(res, { user, accessToken, refreshToken, refreshExpiresAt }, message) {
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshCookieOptions, expires: refreshExpiresAt });
  return sendSuccess(res, {
    message,
    // mustChangePassword is repeated at the top level so clients can branch without digging.
    data: { accessToken, user, mustChangePassword: Boolean(user.mustChangePassword) },
  });
}

const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);

export async function login(req, res) {
  const session = await authService.login(req.body, requestMeta(req));
  return sendSession(res, session, 'Signed in');
}

export async function refresh(req, res) {
  try {
    const session = await authService.refresh(req.cookies?.[REFRESH_COOKIE], requestMeta(req));
    return sendSession(res, session, 'Session refreshed');
  } catch (err) {
    // Never clear the cookie on a grace-window race: the browser may hold another tab's
    // newer token by now.
    if (err.clearCookie) clearRefreshCookie(res);
    throw err;
  }
}

export async function logout(req, res) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: 'Signed out' });
}

export async function me(req, res) {
  const user = await authService.getCurrentUser(req.user.id);
  return sendSuccess(res, { data: { user } });
}

export async function changePassword(req, res) {
  const session = await authService.changePassword(req.user.id, req.body, requestMeta(req));
  return sendSession(res, session, 'Password changed. Other devices have been signed out.');
}

export async function register(req, res) {
  const user = await authService.register(req.body, requestMeta(req));
  return sendCreated(res, {
    message: 'Registration submitted. The school will review and activate your account.',
    data: { user },
  });
}
