import { ACCOUNT_STATUS, ERROR_CODES } from '../config/constants.js';
import { User } from '../models/index.js';
import { verifyAccessToken } from '../services/token.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Verify the Bearer token and re-check the user on every request, so suspension, deletion and
 * tokenVersion bumps (password change/reset) take effect immediately.
 */
async function loadRequestUser(req) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized('Authentication required');

  const payload = await verifyAccessToken(token);

  const user = await User.findById(payload.sub)
    .select('name username role status tokenVersion mustChangePassword')
    .lean();
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.status !== ACCOUNT_STATUS.ACTIVE) throw ApiError.unauthorized('Account is not active');
  if (user.tokenVersion !== payload.tv) {
    throw ApiError.unauthorized('Session expired, please sign in again');
  }

  return {
    id: String(user._id),
    role: user.role,
    name: user.name,
    username: user.username,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

/**
 * Require a valid access token. Sets req.user = { id, role, name, username, mustChangePassword }.
 * Users who must change their password get 403 PASSWORD_CHANGE_REQUIRED here — i.e. on every
 * protected route except the few that use authenticateAllowingPasswordChange.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  req.user = await loadRequestUser(req);
  if (req.user.mustChangePassword) {
    throw ApiError.forbidden('You must change your password before continuing.', {
      code: ERROR_CODES.PASSWORD_CHANGE_REQUIRED,
    });
  }
  next();
});

/** Like authenticate, but lets mustChangePassword users through. Only for /auth/me and /auth/password. */
export const authenticateAllowingPasswordChange = asyncHandler(async (req, res, next) => {
  req.user = await loadRequestUser(req);
  next();
});

/** Allow only the given roles. Use after authenticate. */
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };
