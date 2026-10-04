"use client";

/**
 * Team > Roles & permissions: three role cards.
 * - Super Admin: locked (lock icon, every permission on, switches disabled), never editable.
 * - Moderator and Support: one Switch (role="switch") per permission, labelled by the permission text.
 * - A sticky action bar appears when something differs from the saved state: "2 changes", Reset
 *   (back to the saved state) and Save changes. Save only updates the in-memory store (and the invite
 *   page's role descriptions read from it), with a TODO(backend).
 * - Leaving with unsaved changes asks first (useUnsavedGuard).
 * The explanatory header text is kept from the old Roles & Permissions page.
 */
import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { EDITABLE_ROLES, PERMISSIONS, rolePermissionsStore, type EditableRole, type PermissionKey, type RoleGrants } from "@/lib/role-permissions";
import { Card } from "@/components/ui/Card";
import { StickyActionBar } from "@/components/ui/form/StickyActionBar";
import { Switch } from "@/components/ui/form/Switch";
import { useUnsavedGuard } from "@/components/ui/form/use-unsaved-guard";
import { useToast } from "@/components/ui/Toast";

export function RolesTab() {
  const [saved, setSaved] = useState<RoleGrants>(() => rolePermissionsStore.grants);
  const [draft, setDraft] = useState<RoleGrants>(() => rolePermissionsStore.grants);
  const toast = useToast();

  const changes = EDITABLE_ROLES.reduce(
    (total, role) => total + PERMISSIONS.filter((permission) => draft[role][permission.key] !== saved[role][permission.key]).length,
    0,
  );
  const guard = useUnsavedGuard(changes > 0);

  const toggle = (role: EditableRole, key: PermissionKey, value: boolean) =>
    setDraft((current) => ({ ...current, [role]: { ...current[role], [key]: value } }));

  const save = (event: FormEvent) => {
    event.preventDefault();
    // TODO(backend): persist this change. Today this only updates local state and the in-memory store.
    rolePermissionsStore.save(draft);
    setSaved(draft);
    toast.success("Role permissions were saved.");
  };

  return (
    <form onSubmit={save} className="flex flex-1 flex-col">
      <p className="body-sm mb-4 max-w-3xl text-muted">
        As Super Admin, enable or disable which permissions Moderator and Support staff are granted. Super Admin always retains full access.
      </p>

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
            <p className="caption mb-4 mt-1">Turn a permission on or off for this role.</p>
            <div className="space-y-4">
              {PERMISSIONS.map((permission) => (
                <Switch
                  key={permission.key}
                  checked={draft[role][permission.key]}
                  onChange={(value) => toggle(role, permission.key, value)}
                  label={permission.label}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>

      {changes > 0 && (
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
