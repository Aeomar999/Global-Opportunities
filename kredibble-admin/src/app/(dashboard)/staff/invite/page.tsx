"use client";

/**
 * Invite Staff (/staff/invite): add an admin or support account and choose their role.
 * Built on the shared form system (src/components/ui/form). Single column, 640px wide.
 *
 * Fields (same as before, same required rules): Full name (required), Email (required), Role
 * (Super Admin | Moderator | Support, default Support). Each role option shows one line on what the role can do,
 * derived from the current permissions on Team > Roles & permissions.
 *
 * Behaviour: errors show after a field is left and on submit; Send invite shows a spinner while saving,
 * then a toast and back to Team; leaving with unsaved changes asks first.
 * Data: the in-memory staff store (staffStore.invite), as before.
 */
import { useRef, useState, type FormEvent } from "react";
import { staffStore, type StaffRole } from "@/lib/mock-staff";
import { describeRole } from "@/lib/role-permissions";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/form/Field";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input } from "@/components/ui/form/Input";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { StickyActionBar } from "@/components/ui/form/StickyActionBar";
import { focusFirstInvalid, useTouched } from "@/components/ui/form/use-touched";
import { useUnsavedGuard } from "@/components/ui/form/use-unsaved-guard";
import { useToast } from "@/components/ui/Toast";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";

const LIST_HREF = "/team";

// The one-line descriptions are DERIVED from the current role permissions (src/lib/role-permissions.ts), so they
// follow the Roles & permissions tab and cannot drift from it. Do not hard-code them here.
const ROLES: StaffRole[] = ["Super Admin", "Moderator", "Support"];
const roleOptions = (): SelectOption<StaffRole>[] => ROLES.map((role) => ({ value: role, label: role, description: describeRole(role) }));

export default function InviteStaffPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("Support");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { show, touch, touchAll } = useTouched();
  const toast = useToast();

  const dirty = name !== "" || email !== "" || role !== "Support";
  const guard = useUnsavedGuard(dirty && !saving);

  // Same rules as before: name and email must have text once trimmed.
  const errors = {
    name: name.trim() ? undefined : "Enter the person's full name.",
    email: email.trim() ? undefined : "Enter an email address.",
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    touchAll();
    if (errors.name || errors.email) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    // TODO(backend): persist this change (send the invitation). The in-memory staff store stands in for now.
    await new Promise((resolve) => setTimeout(resolve, 700));
    staffStore.invite(name.trim(), email.trim(), role);
    toast.success(`${name.trim()} was invited as ${role}.`);
    guard.leaveNow(LIST_HREF);
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div className="max-w-160">
        <h1 data-testid="page-title" className="page-title">Invite Staff</h1>
        <p className="page-subtitle mt-1 mb-6">Add a new admin/support account and assign their permission tier.</p>

        <NotConnectedNotice className="mb-4" />

        <Card>
          <FormSection title="Account" description="Who is joining the team.">
            <Field label="Full name" error={show("name") ? errors.name : undefined}>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => touch("name")}
                placeholder="e.g. Ama Boateng"
                autoComplete="off"
              />
            </Field>
            <Field label="Email" error={show("email") ? errors.email : undefined}>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => touch("email")}
                placeholder="name@company.com"
                autoComplete="off"
              />
            </Field>
          </FormSection>

          <FormSection title="Access" description="What they can do in the admin.">
            <Field label="Role">
              <Select options={roleOptions()} value={role} onChange={setRole} />
            </Field>
          </FormSection>
        </Card>
      </div>

      {/* 40rem = 640px: the same width as the form, so the buttons sit under its right edge. */}
      <StickyActionBar dirty={dirty} saving={saving} saveLabel="Send invite" maxWidth="40rem" onCancel={() => guard.leave(LIST_HREF)} />
      {guard.dialog}
    </form>
  );
}
