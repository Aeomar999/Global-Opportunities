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
 * A user with two roles gets the HIGHEST level of either (see accessLevel).
 */
import type { Role } from "./roles";

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
  "settings",
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

export const PERMISSIONS: Record<Role, Grants> = {
  super_admin: everything(),
  desk_lead: everything(),
  moderator: own({ verification: "edit", reports_queue: "edit", opportunities_queue: "edit", channels: "edit", seekers: "edit", hirers: "edit" }),
  support: own({ seekers: "edit", hirers: "edit" }),
  partnerships_officer: own({ partners: "edit", network: "view", leaderboard: "view" }),
  opportunities_officer: own({ opportunities_queue: "edit", career_resources: "edit", events: "view", grants: "view" }),
  training_officer: own({ programs: "edit", events: "edit", network: "view" }),
  database_officer: own({ database: "edit", network: "view" }),
  communications_officer: own({ testimonials: "edit", notifications: "edit", career_resources: "edit", monthly_report: "view", social: "view" }),
  social_media_manager: own({ social: "edit" }),
  country_lead: own({ network: "edit", programs: "view", partners: "view", database: "view", leaderboard: "view" }),
  admin_support: own({ team: "edit" }),
};

const RANK: Record<AccessLevel, number> = { view: 1, edit: 2 };

/** The highest level any of the roles has on a screen, or null (no access). */
export function accessLevel(roles: readonly Role[], screen: Screen): AccessLevel | null {
  let best: AccessLevel | null = null;
  for (const role of roles) {
    const level = PERMISSIONS[role][screen];
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
  const specific = (Object.keys(PERMISSIONS) as Role[]).filter((role) => role !== "super_admin" && role !== "desk_lead" && PERMISSIONS[role][screen] === "edit");
  return specific.length > 0 ? specific : ["super_admin", "desk_lead"];
}
