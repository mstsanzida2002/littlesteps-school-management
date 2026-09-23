import { ACCOUNT_STATUS } from '../config/constants.js';
import { User } from '../models/index.js';
import { verifyAccessToken } from '../services/token.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Require a valid access token. Re-checks the user on every request, so suspension,
 * deletion, and tokenVersion bumps (password change/reset) take effect immediately.
 * Sets req.user = { id, role, name, username }.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized('Authentication required');

  const payload = await verifyAccessToken(token);

  const user = await User.findById(payload.sub)
    .select('name username role status tokenVersion')
    .lean();
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.status !== ACCOUNT_STATUS.ACTIVE) throw ApiError.unauthorized('Account is not active');
  if (user.tokenVersion !== payload.tv) {
    throw ApiError.unauthorized('Session expired, please sign in again');
  }

  req.user = { id: String(user._id), role: user.role, name: user.name, username: user.username };
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
