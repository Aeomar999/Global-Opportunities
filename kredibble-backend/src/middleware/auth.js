import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';
import { User } from '../models/User.js';

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

export const requireAuth = async (req, res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Authentication token is required'));

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    
    // SEC-052: Check token version and deleted role
    const user = await User.findById(payload.sub).select('tokenVersion role').lean();
    if (!user || user.role === 'deleted') {
      return next(new ApiError(401, 'Account no longer active'));
    }
    if (payload.tv !== undefined && payload.tv !== user.tokenVersion) {
      return next(new ApiError(401, 'Token revoked due to security event'));
    }
    
    req.auth = payload;
    next();
  } catch {
    next(new ApiError(401, 'Authentication token is invalid or expired'));
  }
};

export const requireAdminAuth = async (req, res, next) => {
  // Try cookie first (admin panel), then Authorization header (API clients)
  const cookieToken = req.cookies?.[COOKIE_NAME];
  const headerToken = req.get('authorization')?.startsWith('Bearer ')
    ? req.get('authorization').slice(7)
    : null;

  const token = cookieToken || headerToken;
  if (!token) return next(new ApiError(401, 'Admin authentication required'));

  try {
    const payload = jwt.verify(token, env.adminJwtSecret);
    if (payload.aud !== 'kredibble-admin' || payload.role !== 'admin') {
      return next(new ApiError(403, 'Insufficient permissions'));
    }
    
    const user = await User.findById(payload.sub).select('tokenVersion role').lean();
    if (!user || user.role === 'deleted') {
      return next(new ApiError(401, 'Account no longer active'));
    }
    
    req.auth = payload;
    next();
  } catch {
    next(new ApiError(401, 'Admin token is invalid or expired'));
  }
};

export const optionalAuth = async (req, res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    
    const user = await User.findById(payload.sub).select('tokenVersion role').lean();
    if (!user || user.role === 'deleted' || (payload.tv !== undefined && payload.tv !== user.tokenVersion)) {
      return next(); // Ignore invalid tokens on optional routes
    }

    req.auth = payload;
    next();
  } catch {
    // Ignore invalid tokens on optional routes
    next();
  }
};

/**
 * Combined auth for admin routes: accepts admin cookie/JWT OR user Bearer token with StaffMember role.
 * This maintains backward compatibility while supporting the admin panel's cookie-based auth.
 */
export const requireAdminOrStaffAuth = async (req, res, next) => {
  // Try admin auth first (cookie or Bearer with admin audience)
  const cookieToken = req.cookies?.kredibble_admin_token;
  const headerToken = req.get('authorization')?.startsWith('Bearer ')
    ? req.get('authorization').slice(7)
    : null;

  // Check if it's an admin token (has audience claim or is in cookie)
  const isAdminToken = cookieToken || (headerToken && headerToken.startsWith('eyJ'));

  if (isAdminToken && (cookieToken || headerToken)) {
    try {
      const token = cookieToken || headerToken;
      const payload = jwt.verify(token, env.adminJwtSecret);
      if (payload.aud === 'kredibble-admin' && payload.role === 'admin') {
        const user = await User.findById(payload.sub).select('tokenVersion role').lean();
        if (user && user.role !== 'deleted') {
          req.auth = payload;
          return next();
        }
      }
    } catch {
      // Fall through to user auth
    }
  }

  // Fall back to user auth with StaffMember check
  const userToken = headerToken;
  if (!userToken) return next(new ApiError(401, 'Authentication required'));

  try {
    const payload = jwt.verify(userToken, env.jwtSecret);
    
    const user = await User.findById(payload.sub).select('tokenVersion role').lean();
    if (!user || user.role === 'deleted' || (payload.tv !== undefined && payload.tv !== user.tokenVersion)) {
      return next(new ApiError(401, 'Account no longer active'));
    }
    
    req.auth = payload;
    next();
  } catch {
    next(new ApiError(401, 'Authentication token is invalid or expired'));
  }
};
