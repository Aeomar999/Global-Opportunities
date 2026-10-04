/**
 * Dev role switcher: shared constants and rules.
 *
 * In development with mock data a person can "view as" one or two roles. The choice is kept in a cookie
 * so the server layout can read it on the first paint (no flash). In production none of this exists: the
 * real session role is used and the cookie is ignored.
 */
import { isRole, type Role } from "./roles";

export const DEV_ROLES_COOKIE = "god_dev_roles";
export const MAX_DEV_ROLES = 2;

/** True when the switcher may exist. Pure, so both environments can be checked. */
export const isDevRoleSwitcherEnabled = (nodeEnv: string | undefined, mockMode: boolean): boolean => nodeEnv !== "production" && mockMode;

/** "moderator,support" -> ["moderator", "support"] (unknown ids dropped, at most two). */
export function parseDevRoles(value: string | undefined | null): Role[] {
  if (!value) return [];
  return value.split(",").map((part) => part.trim()).filter(isRole).slice(0, MAX_DEV_ROLES);
}

export const serializeDevRoles = (roles: readonly Role[]): string => roles.join(",");
