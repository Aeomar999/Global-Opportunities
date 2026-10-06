"use client";

/**
 * RoleProvider: tells the whole dashboard WHO is looking, so the nav, the route guard and later the edit
 * actions can ask `can(screen, level)`.
 *
 * Where the roles come from (first match wins)
 * 1. Development with mock data only: the role(s) chosen in the dev switcher. The choice is kept in a cookie
 *    (src/config/dev-roles.ts) that the server layout reads, so the first paint already uses it (no flash).
 * 2. The real session: role "admin" maps to super_admin; a session role that is already a desk role id is used as is.
 * 3. No session user in mock mode: super_admin, so the mock app is fully usable.
 * In production only (2) applies: the cookie and the switcher do not exist.
 *
 * Provides (useRoles): roles, can(screen, level), the switcher state and setDevRoles(roles).
 * Helpers: useAccess(screen) -> { canView, canEdit }; VIEW_ONLY_TOOLTIP, the text for a disabled edit control.
 *
 * Props: initialDevRoles (what the server read from the cookie), children.
 */
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { DEV_ROLES_COOKIE, isDevRoleSwitcherEnabled, MAX_DEV_ROLES, serializeDevRoles } from "@/config/dev-roles";
import { roleCan, type AccessLevel, type Screen } from "@/config/permissions";
import { isRole, type Role } from "@/config/roles";
import { getAdminUser } from "@/lib/api";
import { rolePermissionsStore } from "@/lib/role-permissions";
import { isMockMode } from "@/lib/services/mock-mode";

/** The tooltip for an edit control that a view-only role cannot use. */
export const VIEW_ONLY_TOOLTIP = "Your role can view this page but not change it";

interface RoleContextValue {
  roles: Role[];
  can: (screen: Screen, level: AccessLevel) => boolean;
  /** True when the dev role switcher exists (development + mock data only). */
  devSwitcher: boolean;
  /** The roles chosen in the switcher (empty = use the session role). */
  devRoles: Role[];
  setDevRoles: (roles: Role[]) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

/** Roles from the real session (see the file header). */
function sessionRoles(mockMode: boolean): Role[] {
  const role = getAdminUser()?.role as string | undefined;
  if (role === "admin") return ["super_admin"];
  if (role && isRole(role)) return [role];
  if (!role && mockMode) return ["super_admin"];
  return [];
}

export function RoleProvider({ initialDevRoles, children }: { initialDevRoles: Role[]; children: ReactNode }) {
  const mockMode = isMockMode();
  const devSwitcher = isDevRoleSwitcherEnabled(process.env.NODE_ENV, mockMode);
  // The shell renders this only after it has mounted, so reading localStorage here is safe.
  const [fromSession] = useState(() => sessionRoles(mockMode));
  const [devRoles, setDevRolesState] = useState<Role[]>(() => (devSwitcher ? initialDevRoles : []));

  const roles = devRoles.length > 0 ? devRoles : fromSession;

  // The Moderator and Support rows of the matrix follow the toggles saved on Team > Roles & permissions, so `can` is
  // rebuilt (and everything that uses it re-renders) whenever they are saved.
  const matrixRevision = useSyncExternalStore(rolePermissionsStore.subscribe, rolePermissionsStore.getRevision, () => 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const can = useCallback((screen: Screen, level: AccessLevel) => roleCan(roles, screen, level), [roles, matrixRevision]);

  const setDevRoles = useCallback(
    (next: Role[]) => {
      if (!devSwitcher) return; // production: the switcher does not exist
      const chosen = next.slice(0, MAX_DEV_ROLES);
      setDevRolesState(chosen);
      document.cookie = `${DEV_ROLES_COOKIE}=${serializeDevRoles(chosen)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    },
    [devSwitcher],
  );

  const value = useMemo(() => ({ roles, can, devSwitcher, devRoles, setDevRoles }), [roles, can, devSwitcher, devRoles, setDevRoles]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRoles(): RoleContextValue {
  const value = useContext(RoleContext);
  if (!value) throw new Error("useRoles must be used inside <RoleProvider> (the dashboard shell provides it)");
  return value;
}

/** What the current roles may do on one screen. */
export function useAccess(screen: Screen) {
  const { can } = useRoles();
  return { canView: can(screen, "view"), canEdit: can(screen, "edit") };
}
