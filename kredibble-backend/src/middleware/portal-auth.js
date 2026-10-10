import { StaffMember } from '../models/User.js';
import { ApiError } from '../utils/http.js';
import { roleCan, normalizeLegacyRole, getEffectiveToggles } from '../lib/permissions.js';

const toCanonicalRole = (role) => {
  const norm = normalizeLegacyRole(role);
  return norm.length > 0 ? norm[0] : String(role || '').trim().toLowerCase().replace(/\s+/g, '_');
};

const rawNormalized = (str) => String(str || '').trim().toLowerCase();

export const requirePortalRoles = (...allowedRoles) => async (req, res, next) => {
  try {
    if (req.auth?.role === 'admin') return next();

    const staff = await StaffMember.findOne({ userId: req.auth?.sub, status: 'active' });
    if (!staff) {
      return next(new ApiError(403, 'You do not have access to this admin function'));
    }

    const staffRoles = staff.roles?.length
      ? staff.roles
      : String(staff.role || '').split(',').map((r) => r.trim()).filter(Boolean);

    const hasMatch = staffRoles.some((sRole) =>
      allowedRoles.some((aRole) =>
        toCanonicalRole(sRole) === toCanonicalRole(aRole) ||
        rawNormalized(sRole) === rawNormalized(aRole)
      )
    );

    if (!hasMatch) {
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
    const screens = Array.isArray(screen) ? screen : [screen];
    const allowed = screens.some((s) => roleCan(roles, s, level, toggles));

    if (!allowed) {
      const screenLabel = Array.isArray(screen) ? screen.join(', ') : screen;
      return next(new ApiError(403, `Forbidden: insufficient permissions for screen "${screenLabel}"`));
    }

    req.portalStaff = staff;
    req.screenAccess = { screen, level, roles };
    next();
  } catch (error) {
    next(error);
  }
};
