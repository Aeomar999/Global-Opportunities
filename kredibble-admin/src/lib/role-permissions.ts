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
 * - describeRole(role): the one-line description derived from the CURRENT permissions, so the Select
 *   always says what the role can really do.
 */
import { joinList } from "@/lib/format";
import type { StaffRole } from "@/lib/mock-staff";

export type EditableRole = "Moderator" | "Support";
export type PermissionKey = "verifications" | "moderate" | "suspend" | "content" | "broadcast" | "staff";
export type RoleGrants = Record<EditableRole, Record<PermissionKey, boolean>>;

export const PERMISSIONS: { key: PermissionKey; label: string; phrase: string }[] = [
  { key: "verifications", label: "Approve/reject verifications", phrase: "review verifications" },
  { key: "moderate", label: "Moderate opportunities & community", phrase: "moderate opportunities and community" },
  { key: "suspend", label: "Suspend seeker/hirer accounts", phrase: "suspend accounts" },
  { key: "content", label: "Manage reference data & content", phrase: "manage reference data and content" },
  { key: "broadcast", label: "Send platform-wide notifications", phrase: "send notifications" },
  { key: "staff", label: "Manage staff & permissions", phrase: "manage staff" },
];

export const EDITABLE_ROLES: EditableRole[] = ["Moderator", "Support"];

// Defaults mirror what Moderator/Support could do before the Roles page existed.
const DEFAULT_GRANTS: RoleGrants = {
  Moderator: { verifications: true, moderate: true, suspend: true, content: false, broadcast: false, staff: false },
  Support: { verifications: false, moderate: false, suspend: true, content: false, broadcast: false, staff: false },
};

const cloneGrants = (grants: RoleGrants): RoleGrants => ({ Moderator: { ...grants.Moderator }, Support: { ...grants.Support } });

class RolePermissionsStore {
  private saved: RoleGrants = cloneGrants(DEFAULT_GRANTS);

  /** The saved permissions (a copy: callers edit their own draft). */
  get grants(): RoleGrants {
    return cloneGrants(this.saved);
  }

  /** TODO(backend): persist this change. Today it only updates this in-memory copy. */
  save(next: RoleGrants) {
    this.saved = cloneGrants(next);
  }
}

export const rolePermissionsStore = new RolePermissionsStore();

/** "Can review verifications, moderate content and suspend accounts." from the current permissions. */
export function describeRole(role: StaffRole): string {
  if (role === "Super Admin") return "Full access, including staff and permissions.";
  const granted = PERMISSIONS.filter((permission) => rolePermissionsStore.grants[role][permission.key]).map((permission) => permission.phrase);
  if (granted.length === 0) return "No permissions are granted.";
  return `Can ${joinList(granted)}.`;
}
