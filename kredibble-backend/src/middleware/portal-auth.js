import { StaffMember } from '../models/User.js';
import { ApiError } from '../utils/http.js';
import { roleCan, normalizeLegacyRole, getEffectiveToggles } from '../lib/permissions.js';

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

export const requirePortalRoles = (...allowedRoles) => async (req, res, next) => {
  try {
    if (req.auth?.role === 'admin') return next();

    const staff = await StaffMember.findOne({ userId: req.auth?.sub, status: 'active' });
    const staffRoles = staff?.roles?.length
      ? staff.roles
      : String(staff?.role || '')
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

export const requireScreen = (screen, level = 'view') => async (req, res, next) => {
  try {
    if (req.auth?.role === 'admin') {
      req.screenAccess = { screen, level, grantedVia: 'admin' };
      return next();
    }

    const userId = req.auth?.sub;
    if (!userId) {
      return next(new ApiError(401, 'Authentication required'));
    }

    const staff = await StaffMember.findOne({ userId, status: 'active' });
    if (!staff) {
      return next(new ApiError(403, 'You do not have staff access to this admin function'));
    }

    const roles = staff.roles?.length ? staff.roles : normalizeLegacyRole(staff.role);
    const toggles = await getEffectiveToggles();
    const allowed = roleCan(roles, screen, level, toggles);

    if (!allowed) {
      return next(new ApiError(403, `Forbidden: insufficient permissions for screen "${screen}"`));
    }

    req.portalStaff = staff;
    req.screenAccess = { screen, level, roles };
    next();
  } catch (error) {
    next(error);
  }
};
