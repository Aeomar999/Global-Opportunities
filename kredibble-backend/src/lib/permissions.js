import { RolePermissionConfig } from '../models/AdminPortal.js';

export const ROLE_IDS = [
  'super_admin',
  'moderator',
  'support',
  'partnerships_officer',
  'opportunities_officer',
  'training_officer',
  'database_officer',
  'communications_officer',
  'social_media_manager',
  'country_lead',
  'admin_support',
  'desk_lead',
];

export const SCREENS = [
  'overview',
  'insights',
  'monthly_report',
  'my_scorecard',
  'team_scorecard',
  'opportunities_queue',
  'events',
  'grants',
  'programs',
  'partners',
  'network',
  'leaderboard',
  'seekers',
  'hirers',
  'channels',
  'database',
  'verification',
  'reports_queue',
  'career_resources',
  'reference_data',
  'social',
  'testimonials',
  'notifications',
  'team',
  'roles_permissions',
  'settings',
  'settings_admin',
  'listings_curate',
];

export const EDITABLE_ROLES = ['Moderator', 'Support'];
export const PERMISSION_KEYS = ['verifications', 'moderate', 'suspend', 'content', 'broadcast', 'staff'];

export const TOGGLE_GRANTS = {
  verifications: { screens: ['verification'], on: 'edit', off: null },
  moderate: { screens: ['opportunities_queue', 'channels', 'reports_queue'], on: 'edit', off: null },
  suspend: { screens: ['seekers', 'hirers'], on: 'edit', off: 'view' },
  content: { screens: ['reference_data', 'career_resources'], on: 'edit', off: null },
  broadcast: { screens: ['notifications'], on: 'edit', off: null },
  staff: { screens: ['team'], on: 'edit', off: null },
};

export const DEFAULT_TOGGLE_GRANTS = {
  Moderator: { verifications: true, moderate: true, suspend: true, content: false, broadcast: false, staff: false },
  Support: { verifications: false, moderate: false, suspend: true, content: false, broadcast: false, staff: false },
};

const BASE = { overview: 'view', my_scorecard: 'edit', settings: 'edit' };
const RANK = { view: 1, edit: 2 };

const everything = () => {
  const grants = {};
  for (const screen of SCREENS) grants[screen] = 'edit';
  grants.team_scorecard = 'view';
  return grants;
};

const own = (grants) => ({ ...BASE, ...grants });

export const FIXED_PERMISSIONS = {
  super_admin: everything(),
  desk_lead: { ...everything(), roles_permissions: 'view' },
  partnerships_officer: own({ partners: 'edit', network: 'view', leaderboard: 'view', monthly_report: 'view' }),
  opportunities_officer: own({
    opportunities_queue: 'edit',
    career_resources: 'edit',
    events: 'view',
    grants: 'view',
    listings_curate: 'edit',
  }),
  training_officer: own({ programs: 'edit', events: 'edit', network: 'view' }),
  database_officer: own({ database: 'edit', network: 'view' }),
  communications_officer: own({
    testimonials: 'edit',
    notifications: 'edit',
    career_resources: 'edit',
    monthly_report: 'view',
    social: 'view',
  }),
  social_media_manager: own({ social: 'edit', testimonials: 'view' }),
  country_lead: own({ network: 'edit', programs: 'view', partners: 'view', database: 'view', leaderboard: 'view' }),
  admin_support: own({ team: 'edit' }),
};

export function editableRoleGrants(role, toggles = DEFAULT_TOGGLE_GRANTS) {
  const label = role.toLowerCase() === 'moderator' ? 'Moderator' : 'Support';
  const roleToggles = toggles[label] || DEFAULT_TOGGLE_GRANTS[label];
  const grants = { ...BASE };

  for (const key of PERMISSION_KEYS) {
    const rule = TOGGLE_GRANTS[key];
    const level = roleToggles[key] ? rule.on : rule.off;
    if (level) {
      for (const screen of rule.screens) grants[screen] = level;
    }
  }
  return grants;
}

export function grantsFor(role, toggles = DEFAULT_TOGGLE_GRANTS) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'moderator' || normalized === 'support') {
    return editableRoleGrants(normalized, toggles);
  }
  return FIXED_PERMISSIONS[normalized] || { ...BASE };
}

export function accessLevel(roles, screen, toggles = DEFAULT_TOGGLE_GRANTS) {
  let best = null;
  const list = Array.isArray(roles) ? roles : [roles];

  for (const role of list) {
    const grants = grantsFor(role, toggles);
    const level = grants[screen];
    if (level && (!best || RANK[level] > RANK[best])) {
      best = level;
    }
  }
  return best;
}

export function roleCan(roles, screen, level, toggles = DEFAULT_TOGGLE_GRANTS) {
  const have = accessLevel(roles, screen, toggles);
  return Boolean(have && RANK[have] >= RANK[level]);
}

export function computeGrants(roles, toggles = DEFAULT_TOGGLE_GRANTS) {
  const result = {};
  for (const screen of SCREENS) {
    const level = accessLevel(roles, screen, toggles);
    if (level) result[screen] = level;
  }
  return result;
}

export function computeFullMatrix(toggles = DEFAULT_TOGGLE_GRANTS) {
  const matrix = {};
  for (const roleId of ROLE_IDS) {
    matrix[roleId] = grantsFor(roleId, toggles);
  }
  return matrix;
}

const LEGACY_ROLE_MAP = {
  super_admin: 'super_admin',
  superadmin: 'super_admin',
  admin: 'super_admin',
  desk_lead: 'desk_lead',
  desklead: 'desk_lead',
  admin_support: 'admin_support',
  adminsupport: 'admin_support',
  partnerships_officer: 'partnerships_officer',
  partnershipsofficer: 'partnerships_officer',
  opportunities_officer: 'opportunities_officer',
  opportunitiesofficer: 'opportunities_officer',
  writer: 'opportunities_officer',
  training_officer: 'training_officer',
  trainingofficer: 'training_officer',
  trainingandcapacitydevelopmentofficer: 'training_officer',
  database_officer: 'database_officer',
  databaseofficer: 'database_officer',
  communications_officer: 'communications_officer',
  communicationsofficer: 'communications_officer',
  social_media_manager: 'social_media_manager',
  socialmediamanager: 'social_media_manager',
  country_lead: 'country_lead',
  countrylead: 'country_lead',
  moderator: 'moderator',
  support: 'support',
};

export function normalizeLegacyRole(input) {
  if (Array.isArray(input)) {
    return input.map((r) => normalizeLegacyRole(r)[0]).filter(Boolean);
  }
  const raw = String(input || '').trim();
  if (!raw) return [];

  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const resolved = [];

  for (const part of parts) {
    const simplified = part.toLowerCase().replace(/[\s_-]+/g, '');
    const mapped = LEGACY_ROLE_MAP[simplified];
    if (mapped && !resolved.includes(mapped)) {
      resolved.push(mapped);
    }
  }

  return resolved.slice(0, 2);
}

let cachedToggles = null;
let cacheExpiry = 0;

export async function getEffectiveToggles() {
  const now = Date.now();
  if (cachedToggles && cacheExpiry > now) {
    return cachedToggles;
  }

  try {
    const config = await RolePermissionConfig.findOne({ key: 'global' }).lean();
    if (config?.toggles) {
      cachedToggles = config.toggles;
      cacheExpiry = now + 60_000;
      return cachedToggles;
    }
  } catch {
    // If DB is offline or table is empty, fall back to defaults
  }

  cachedToggles = DEFAULT_TOGGLE_GRANTS;
  cacheExpiry = now + 5_000;
  return cachedToggles;
}

export function invalidateTogglesCache() {
  cachedToggles = null;
  cacheExpiry = 0;
}
