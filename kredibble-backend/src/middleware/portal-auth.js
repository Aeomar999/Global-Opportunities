import { StaffMember } from '../models/User.js';
import { ApiError } from '../utils/http.js';

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

export const requirePortalRoles = (...allowedRoles) => async (req, res, next) => {
  try {
  if (req.auth?.role === 'admin') return next();

  const staff = await StaffMember.findOne({ userId: req.auth?.sub, status: 'active' });
  const staffRoles = String(staff?.role || '')
    .split(',')
    .map(normalizeRole)
    .filter(Boolean);
  const permitted = allowedRoles.map(normalizeRole);

  if (!staff || !staffRoles.some((role) => permitted.includes(role))) {
    return next(new ApiError(403, 'You do not have access to this admin function'));
  }
  req.portalStaff = staff;
  next();
  } catch (error) {
    next(error);
  }
};
