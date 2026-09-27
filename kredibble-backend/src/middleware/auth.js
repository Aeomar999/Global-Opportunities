import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';

export const signToken = (user) => {
  const userId = user.id || user._id;
  return jwt.sign(
    { sub: userId, role: user.role, email: user.email, tv: user.tokenVersion || 0 },
    env.jwtSecret,
    { expiresIn: '15m' }
  );
};

export const signAdminToken = (user) => {
  const userId = user.id || user._id;
  return jwt.sign(
    { sub: userId, role: user.role, email: user.email, aud: 'kredibble-admin' },
    env.adminJwtSecret,
    { expiresIn: '15m' }
  );
};

// SEC-009: generate opaque refresh token (64 hex chars) and its hash
export const generateRefreshToken = () => crypto.randomBytes(32).toString('hex');
export const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const COOKIE_NAME = 'kredibble_admin_token';

export const setAdminCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  });
};

export const clearAdminCookie = (res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/',
  });
};

export const requireAuth = (req, res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Authentication token is required'));

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    // SEC-009: reject tokens whose tokenVersion is stale (password/role change)
    if (payload.tv !== undefined && req.auth?.tokenVersion !== undefined && payload.tv !== req.auth.tokenVersion) {
      return next(new ApiError(401, 'Token revoked due to security event'));
    }
    req.auth = payload;
    next();
  } catch {
    next(new ApiError(401, 'Authentication token is invalid or expired'));
  }
};

export const requireAdminAuth = (req, res, next) => {
  // Try cookie first (admin panel), then Authorization header (API clients)
  const cookieToken = req.cookies?.[COOKIE_NAME];
  const headerToken = req.get('authorization')?.startsWith('Bearer ')
    ? req.get('authorization').slice(7)
    : null;
  const token = cookieToken || headerToken;

  if (!token) return next(new ApiError(401, 'Admin authentication required'));

  try {
    req.auth = jwt.verify(token, env.adminJwtSecret, { audience: 'kredibble-admin' });
    if (req.auth.role !== 'admin') {
      return next(new ApiError(403, 'Admin role required'));
    }
    next();
  } catch {
    next(new ApiError(401, 'Admin authentication invalid or expired'));
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action'));
  }
  next();
};
