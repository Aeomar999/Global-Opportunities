import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';

export const signToken = (user) => {
  const userId = user.id || user._id;
  return jwt.sign({ sub: userId, role: user.role, email: user.email }, env.jwtSecret, { expiresIn: '7d' });
};

export const signAdminToken = (user) => {
  const userId = user.id || user._id;
  return jwt.sign(
    { sub: userId, role: user.role, email: user.email, aud: 'kredibble-admin' },
    env.adminJwtSecret,
    { expiresIn: '15m' }
  );
};

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
    req.auth = jwt.verify(token, env.jwtSecret);
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
