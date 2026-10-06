/**
 * Permissions: a matrix of screen -> role -> "edit" | "view". A missing entry means no access.
 *
 * DEFAULTS (change them here; they are easy to find because each role is one line below)
 * - Every role: edit My scorecard and Settings (the personal part), and view the Overview. Overview, My scorecard
 *   and Settings are therefore reachable by everyone.
 * - super_admin and desk_lead: edit everything except the Team scorecard, which they can only view.
 * - moderator: edit verification, reports queue, opportunities queue, channels, seekers, hirers (suspend).
 * - support: edit seekers and hirers (suspend only).
 * - partnerships_officer: edit partners; view network, leaderboard.
 * - opportunities_officer: edit opportunities queue, career resources; view events, grants.
 * - training_officer: edit programs, events; view network.
 * - database_officer: edit database; view network.
 * - communications_officer: edit testimonials, notifications, career resources; view monthly report, social.
 * - social_media_manager: edit social.
 * - country_lead: edit network; view programs, partners, database, leaderboard.
 * - admin_support: edit team (members).
 * - roles_permissions (the Roles & permissions tab on Team): edit for super_admin, view for desk_lead, nobody else.
 *   The Members tab keeps "team".
 * - settings_admin (Settings > Targets, Pipeline stages, Integrations): edit for super_admin and desk_lead only.
 *   "settings" stays the key for the personal "My account" part, which every role has.
 * - listings_curate (creating and editing curated listings): edit for opportunities_officer, desk_lead, super_admin.
 *   "opportunities_queue" stays the key for moderating listings that hirers submit.
 * - monthly_report: also view for partnerships_officer (the partner version only; the team version is gated by
 *   team_scorecard).
 * MODERATOR and SUPPORT are different: their rows are COMPUTED at runtime from the saved toggles on Team > Roles &
 * permissions (see editableRoleGrants and TOGGLE_GRANTS in lib/role-permissions.ts). The other ten rows are fixed here.
 * A user with two roles gets the HIGHEST level of either (see accessLevel).
 */
import { ROLE_IDS, type Role } from "./roles";
import { EDITABLE_ROLE_IDS, TOGGLE_GRANTS, rolePermissionsStore, type EditableRole, type PermissionKey } from "@/lib/role-permissions";

export const SCREENS = [
  "overview",
  "insights",
  "monthly_report",
  "my_scorecard",
  "team_scorecard",
  "opportunities_queue",
  "events",
  "grants",
  "programs",
  "partners",
  "network",
  "leaderboard",
  "seekers",
  "hirers",
  "channels",
  "database",
  "verification",
  "reports_queue",
  "career_resources",
  "reference_data",
  "social",
  "testimonials",
  "notifications",
  "team",
  "roles_permissions",
  "settings",
  "settings_admin",
  "listings_curate",
] as const;

export type Screen = (typeof SCREENS)[number];
export type AccessLevel = "view" | "edit";

type Grants = Partial<Record<Screen, AccessLevel>>;

const everything = (): Grants => {
  const grants: Grants = {};
  for (const screen of SCREENS) grants[screen] = "edit";
  grants.team_scorecard = "view"; // read-only for the people who may see it
  return grants;
};

/** What every role gets before its own grants are added. */
const BASE: Grants = { overview: "view", my_scorecard: "edit", settings: "edit" };

const own = (grants: Grants): Grants => ({ ...BASE, ...grants });

/** The editable roles' matrix rows, computed from toggles (saved ones by default): see TOGGLE_GRANTS. */
export function editableRoleGrants(role: "moderator" | "support", toggles?: Record<PermissionKey, boolean>): Grants {
  const label = (Object.keys(EDITABLE_ROLE_IDS) as EditableRole[]).find((name) => EDITABLE_ROLE_IDS[name] === role)!;
  const on = toggles ?? rolePermissionsStore.grants[label];
  const grants: Grants = { ...BASE };
  for (const key of Object.keys(TOGGLE_GRANTS) as PermissionKey[]) {
    const rule = TOGGLE_GRANTS[key];
    const level = on[key] ? rule.on : rule.off;
    if (level) for (const screen of rule.screens) grants[screen] = level;
  }
  return grants;
}

/** The ten roles whose rows are fixed. */
export const FIXED_PERMISSIONS: Record<Exclude<Role, "moderator" | "support">, Grants> = {
  super_admin: everything(),
  desk_lead: { ...everything(), roles_permissions: "view" }, // may read the roles matrix, not change it
  partnerships_officer: own({ partners: "edit", network: "view", leaderboard: "view", monthly_report: "view" }),
  opportunities_officer: own({ opportunities_queue: "edit", career_resources: "edit", events: "view", grants: "view", listings_curate: "edit" }),
  training_officer: own({ programs: "edit", events: "edit", network: "view" }),
  database_officer: own({ database: "edit", network: "view" }),
  communications_officer: own({ testimonials: "edit", notifications: "edit", career_resources: "edit", monthly_report: "view", social: "view" }),
  social_media_manager: own({ social: "edit" }),
  country_lead: own({ network: "edit", programs: "view", partners: "view", database: "view", leaderboard: "view" }),
  admin_support: own({ team: "edit" }),
};

/** The matrix row of a role RIGHT NOW (Moderator and Support follow the saved toggles). */
export const grantsFor = (role: Role): Grants => (role === "moderator" || role === "support" ? editableRoleGrants(role) : FIXED_PERMISSIONS[role]);

/** Every role's row as it is today (the defaults, until the toggles are saved). Prefer grantsFor for anything live. */
export const PERMISSIONS: Record<Role, Grants> = {
  ...FIXED_PERMISSIONS,
  moderator: editableRoleGrants("moderator"),
  support: editableRoleGrants("support"),
};

const ROLE_LIST: readonly Role[] = ROLE_IDS;
const RANK: Record<AccessLevel, number> = { view: 1, edit: 2 };

/** The highest level any of the roles has on a screen, or null (no access). */
export function accessLevel(roles: readonly Role[], screen: Screen): AccessLevel | null {
  let best: AccessLevel | null = null;
  for (const role of roles) {
    const level = grantsFor(role)[screen];
    if (level && (!best || RANK[level] > RANK[best])) best = level;
  }
  return best;
}

/** True when the roles reach `level` on `screen`. Editing implies viewing. */
export const roleCan = (roles: readonly Role[], screen: Screen, level: AccessLevel): boolean => {
  const have = accessLevel(roles, screen);
  return !!have && RANK[have] >= RANK[level];
};

/** The roles that own a screen: those with edit access, not counting the two all-access roles. Falls back to those two. */
export function owningRoles(screen: Screen): Role[] {
  const specific = ROLE_LIST.filter((role) => role !== "super_admin" && role !== "desk_lead" && grantsFor(role)[screen] === "edit");
  return specific.length > 0 ? specific : ["super_admin", "desk_lead"];
}
