import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';

export const signToken = (user) => {
  const userId = user.id || user._id;
  return jwt.sign({ sub: userId, role: user.role, email: user.email }, env.jwtSecret, { expiresIn: '7d' });
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

export const optionalAuth = (req, res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    req.auth = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    next(new ApiError(401, 'Authentication token is invalid or expired'));
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action'));
  }
  next();
};
