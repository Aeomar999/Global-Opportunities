"use client";

/**
 * Team > Roles & permissions.
 *
 * - Super Admin: locked (lock icon, every permission on, switches disabled), never editable.
 * - Moderator and Support: one Switch (role="switch") per permission, labelled by the permission text. Each toggle
 *   decides screens in the permission matrix (TOGGLE_GRANTS in lib/role-permissions.ts): after "Save changes" the
 *   matrix rows of these two roles follow the toggles, so "Viewing as Moderator" shows exactly what was saved.
 * - A sticky action bar appears when something differs from the saved state: "2 changes", Reset (back to the saved
 *   state) and Save changes. Save only updates the in-memory store, with a TODO(backend).
 * - Leaving with unsaved changes asks first (useUnsavedGuard).
 * - Below the cards, a compact READ-ONLY table shows what the other ten roles can do on every screen. Their rows are fixed.
 * Access (the "roles_permissions" screen): edit (super admin) can change the toggles; view (desk lead) sees everything
 * read-only, with the switches disabled and no save bar; with no access the Team page does not show this tab at all.
 */
import { useState, useEffect, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { useRoles, VIEW_ONLY_TOOLTIP } from "@/components/access/RoleProvider";
import { FIXED_PERMISSIONS, SCREENS } from "@/config/permissions";
import { ROLES, type Role } from "@/config/roles";
import { EDITABLE_ROLES, PERMISSIONS, rolePermissionsStore, type EditableRole, type PermissionKey, type RoleGrants } from "@/lib/role-permissions";
import { getRolesPermissions, updateRolesPermissions } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { StickyActionBar } from "@/components/ui/form/StickyActionBar";
import { Switch } from "@/components/ui/form/Switch";
import { useUnsavedGuard } from "@/components/ui/form/use-unsaved-guard";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";

/** "team_scorecard" -> "Team scorecard". */
const screenLabel = (screen: string) => screen.charAt(0).toUpperCase() + screen.slice(1).replace(/_/g, " ");

const FIXED_ROLES = Object.keys(FIXED_PERMISSIONS) as (keyof typeof FIXED_PERMISSIONS)[];
const LEVEL_TEXT = { edit: "Edit", view: "View" } as const;

export function RolesTab() {
  const [saved, setSaved] = useState<RoleGrants>(() => rolePermissionsStore.grants);
  const [draft, setDraft] = useState<RoleGrants>(() => rolePermissionsStore.grants);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { can } = useRoles();
  const canEdit = can("roles_permissions", "edit");

  useEffect(() => {
    let active = true;
    getRolesPermissions()
      .then((payload) => {
        if (!active || !payload?.toggles) return;
        const liveToggles = payload.toggles as unknown as RoleGrants;
        rolePermissionsStore.load(liveToggles);
        setSaved(liveToggles);
        setDraft(liveToggles);
      })
      .catch(() => {
        // Keeps default in-memory store grants on error or offline
      });
    return () => {
      active = false;
    };
  }, []);

  const changes = EDITABLE_ROLES.reduce(
    (total, role) => total + PERMISSIONS.filter((permission) => draft[role][permission.key] !== saved[role][permission.key]).length,
    0,
  );
  const guard = useUnsavedGuard(changes > 0);

  const toggle = (role: EditableRole, key: PermissionKey, value: boolean) =>
    setDraft((current) => ({ ...current, [role]: { ...current[role], [key]: value } }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      await updateRolesPermissions(draft);
      rolePermissionsStore.save(draft);
      setSaved(draft);
      toast.success("Role permissions were saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-1 flex-col">
      <p className="body-sm mb-4 max-w-3xl text-muted">
        {canEdit
          ? "As Super Admin, enable or disable which permissions Moderator and Support staff are granted. Super Admin always retains full access."
          : "What each role can do. You can read these settings but not change them."}
      </p>
      {!canEdit && <p className="caption mb-4">{VIEW_ONLY_TOOLTIP}.</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Super Admin: fixed */}
        <Card as="section" ariaLabel="Super Admin permissions">
          <div className="flex items-center gap-2">
            <h2 className="card-title">Super Admin</h2>
            <Lock size={14} strokeWidth={2} aria-hidden="true" className="text-muted" />
            <span className="caption">Locked</span>
          </div>
          <p className="caption mb-4 mt-1">Full platform access. Not editable.</p>
          <div className="space-y-4">
            {PERMISSIONS.map((permission) => (
              <Switch key={permission.key} checked onChange={() => {}} disabled label={permission.label} />
            ))}
          </div>
        </Card>

        {EDITABLE_ROLES.map((role) => (
          <Card key={role} as="section" ariaLabel={`${role} permissions`}>
            <h2 className="card-title">{role}</h2>
            <p className="caption mb-4 mt-1">{canEdit ? "Turn a permission on or off for this role." : "Read only."}</p>
            <div className="space-y-4">
              {PERMISSIONS.map((permission) => {
                const control = (
                  <div>
                    <Switch
                      checked={draft[role][permission.key]}
                      onChange={(value) => toggle(role, permission.key, value)}
                      label={permission.label}
                      disabled={!canEdit}
                    />
                  </div>
                );
                return canEdit ? (
                  <div key={permission.key}>{control}</div>
                ) : (
                  <Tooltip key={permission.key} label={VIEW_ONLY_TOOLTIP} wrapperClassName="block w-full">
                    {control}
                  </Tooltip>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* The other ten roles: fixed, read-only, compact. */}
      <Card as="section" ariaLabel="Permissions of the other roles" className="mt-4">
        <h2 className="card-title">Every other role</h2>
        <p className="caption mb-3 mt-1">These rows are fixed. Edit = can change, View = can read, a dash = no access.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left" aria-label="What the other roles can do on each screen (read only)">
            <thead>
              <tr>
                <th scope="col" className="caption sticky left-0 bg-surface py-2 pr-3 font-semibold">
                  Screen
                </th>
                {FIXED_ROLES.map((role) => (
                  <th key={role} scope="col" className="caption px-2 py-2 text-center font-semibold" data-testid={`matrix-role-${role}`}>
                    {ROLES[role as Role].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCREENS.map((screen) => (
                <tr key={screen} className="border-t border-line">
                  <th scope="row" className="caption sticky left-0 whitespace-nowrap bg-surface py-1.5 pr-3 font-normal text-ink">
                    {screenLabel(screen)}
                  </th>
                  {FIXED_ROLES.map((role) => {
                    const level = FIXED_PERMISSIONS[role][screen];
                    return (
                      <td key={role} data-level={level ?? "none"} className="caption px-2 py-1.5 text-center tabular-nums">
                        {level ? <span className={level === "edit" ? "font-semibold text-ink" : "text-muted"}>{LEVEL_TEXT[level]}</span> : <span aria-label="No access">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {canEdit && changes > 0 && (
        <StickyActionBar
          dirty
          status={`${changes} ${changes === 1 ? "change" : "changes"}`}
          saving={false}
          saveLabel="Save changes"
          cancelLabel="Reset"
          onCancel={() => setDraft(saved)}
        />
      )}
      {guard.dialog}
    </form>
  );
}
