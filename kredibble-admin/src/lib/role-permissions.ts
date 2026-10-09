/**
 * Role permissions: what each staff role may do. ONE source for the Roles & permissions tab and the
 * one-line role descriptions in the staff invite Select, so the two cannot drift apart.
 *
 * - PERMISSIONS: the six permissions, each with the full label (shown on the Roles tab) and a short
 *   phrase used to build sentences ("review verifications").
 * - Super Admin always has all of them and is never editable.
 * - Moderator and Support start from the defaults below ("what they could do before the Roles page existed")
 *   and can be changed on the Roles tab. Saved changes live in this module (in memory, reset on reload),
 *   which is what the invite page reads. TODO(backend): load and save these.
 * - TOGGLE_GRANTS: what each toggle means in the screen matrix (src/config/permissions.ts). The matrix rows of
 *   Moderator and Support are COMPUTED from the saved toggles at runtime through this table, so the toggles and
 *   the matrix can never disagree. The other ten roles' rows are fixed. "Manage staff accounts" gives edit on
 *   the Members tab (screen "team") and never grants "roles_permissions".
 * - describeRole(role): the one-line description derived from the CURRENT permissions, so the Select
 *   always says what the role can really do.
 */
import { joinList } from "@/lib/format";
import type { AccessLevel, Screen } from "@/config/permissions";
import { ROLES, type Role } from "@/config/roles";

export type EditableRole = "Moderator" | "Support";
export type PermissionKey = "verifications" | "moderate" | "suspend" | "content" | "broadcast" | "staff";
export type RoleGrants = Record<EditableRole, Record<PermissionKey, boolean>>;

export const PERMISSIONS: { key: PermissionKey; label: string; phrase: string }[] = [
  { key: "verifications", label: "Approve/reject verifications", phrase: "review verifications" },
  { key: "moderate", label: "Moderate opportunities & community", phrase: "moderate opportunities and community" },
  { key: "suspend", label: "Suspend seeker/hirer accounts", phrase: "suspend accounts" },
  { key: "content", label: "Manage reference data & content", phrase: "manage reference data and content" },
  { key: "broadcast", label: "Send platform-wide notifications", phrase: "send notifications" },
  { key: "staff", label: "Manage staff accounts", phrase: "manage staff accounts" },
];

export const EDITABLE_ROLES: EditableRole[] = ["Moderator", "Support"];

/** The role id behind each editable role label. */
export const EDITABLE_ROLE_IDS: Record<EditableRole, Role> = { Moderator: "moderator", Support: "support" };

/** What each toggle does in the matrix: the screens it covers, the level when ON and the level when OFF (null = no access). */
export const TOGGLE_GRANTS: Record<PermissionKey, { screens: Screen[]; on: AccessLevel; off: AccessLevel | null }> = {
  verifications: { screens: ["verification"], on: "edit", off: null },
  moderate: { screens: ["opportunities_queue", "channels", "reports_queue"], on: "edit", off: null },
  suspend: { screens: ["seekers", "hirers"], on: "edit", off: "view" },
  content: { screens: ["reference_data", "career_resources"], on: "edit", off: null },
  broadcast: { screens: ["notifications"], on: "edit", off: null },
  staff: { screens: ["team"], on: "edit", off: null }, // Members only: never roles_permissions
};

// Defaults mirror what Moderator/Support could do before the Roles page existed.
const DEFAULT_GRANTS: RoleGrants = {
  Moderator: { verifications: true, moderate: true, suspend: true, content: false, broadcast: false, staff: false },
  Support: { verifications: false, moderate: false, suspend: true, content: false, broadcast: false, staff: false },
};

const cloneGrants = (grants: RoleGrants): RoleGrants => ({ Moderator: { ...grants.Moderator }, Support: { ...grants.Support } });

class RolePermissionsStore {
  private saved: RoleGrants = cloneGrants(DEFAULT_GRANTS);
  private listeners = new Set<() => void>();
  private revision = 0;

  /** Tells the caller whenever the permissions are saved (the role context re-reads the matrix). */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Changes on every save: a cheap snapshot for useSyncExternalStore. */
  getRevision = () => this.revision;

  /** The saved permissions (a copy: callers edit their own draft). */
  get grants(): RoleGrants {
    return cloneGrants(this.saved);
  }

  /** Loaded from live backend API or initial config. */
  load(next: RoleGrants) {
    this.saved = cloneGrants(next);
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  }

  save(next: RoleGrants) {
    this.saved = cloneGrants(next);
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  }
}

export const rolePermissionsStore = new RolePermissionsStore();

/** "Can review verifications, moderate content and suspend accounts." from the current permissions. */
export function describeRole(role: Role): string {
  if (role === "super_admin") return "Full access, including staff and permissions.";
  // The desk roles have their own fixed description (src/config/roles.ts); only Moderator and Support follow the editable permissions.
  if (role !== "moderator" && role !== "support") return ROLES[role].description;
  const granted = PERMISSIONS.filter((permission) => rolePermissionsStore.grants[role === "moderator" ? "Moderator" : "Support"][permission.key]).map((permission) => permission.phrase);
  if (granted.length === 0) return "No permissions are granted.";
  return `Can ${joinList(granted)}.`;
}
