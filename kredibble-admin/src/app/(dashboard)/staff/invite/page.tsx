"use client";

/**
 * Invite Staff (/staff/invite): add an admin or support account and choose their role.
 * Built on the shared form system (src/components/ui/form). Single column, 640px wide.
 *
 * Fields: Full name (required), Email (required), Role (any of the 12 roles, default Support) and an optional
 * Second role (any other role; a person holds one or two). Each option shows one line on what the role can do,
 * derived from the current permissions on Team > Roles & permissions. The chosen roles show as chips; the second can be
 * removed with its x.
 *
 * Behaviour: errors show after a field is left and on submit; Send invite shows a spinner while saving,
 * then a toast and back to Team; leaving with unsaved changes asks first.
 * Data: the ONE staff collection (services/staff.ts): the new person is added to it, so the Team page, their member page
 * and the scorecards see them at once.
 */
import { useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { MAX_STAFF_ROLES } from "@/config/staff-roles";
import { ROLE_IDS, ROLES, type Role } from "@/config/roles";
import { inviteStaff } from "@/lib/services/staff";
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

const LIST_HREF = "/team";

// The one-line descriptions are DERIVED from the current role permissions (src/lib/role-permissions.ts), so they
// follow the Roles & permissions tab and cannot drift from it. Do not hard-code them here.
const roleOptions = (without?: Role): SelectOption<Role>[] =>
  ROLE_IDS.filter((role) => role !== without).map((role) => ({ value: role, label: ROLES[role].label, description: describeRole(role) }));

const NO_SECOND = "none";
const secondOptions = (first: Role): SelectOption<Role | typeof NO_SECOND>[] => [
  { value: NO_SECOND, label: "No second role", description: "This person holds one role." },
  ...roleOptions(first),
];

export default function InviteStaffPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("support");
  const [second, setSecond] = useState<Role | typeof NO_SECOND>(NO_SECOND);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { show, touch, touchAll } = useTouched();
  const toast = useToast();

  const dirty = name !== "" || email !== "" || role !== "support" || second !== NO_SECOND;
  const chosen: Role[] = second === NO_SECOND ? [role] : [role, second].slice(0, MAX_STAFF_ROLES) as Role[];
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
    inviteStaff(name.trim(), email.trim(), chosen);
    toast.success(`${name.trim()} was invited as ${chosen.map((held) => ROLES[held].label).join(" and ")}.`);
    guard.leaveNow(LIST_HREF);
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div className="max-w-160">
        <h1 data-testid="page-title" className="page-title">Invite Staff</h1>
        <p className="page-subtitle mt-1 mb-6">Add a new admin/support account and assign their permission tier.</p>

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
              <Select
                options={roleOptions()}
                value={role}
                onChange={(next) => {
                  setRole(next);
                  if (second === next) setSecond(NO_SECOND); // the second role cannot repeat the first
                }}
              />
            </Field>
            <Field label="Second role" optional helper="A person can hold up to two roles.">
              <Select options={secondOptions(role)} value={second} onChange={setSecond} />
            </Field>
            <ul aria-label="Chosen roles" data-testid="invite-role-chips" className="flex flex-wrap gap-2">
              {chosen.map((held, index) => (
                <li key={held} className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">
                  {ROLES[held].label}
                  {index === 1 && (
                    <button type="button" aria-label={`Remove ${ROLES[held].label}`} onClick={() => setSecond(NO_SECOND)} className="rounded-full p-0.5 hover:bg-purple-100">
                      <X size={12} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </FormSection>
        </Card>
      </div>

      {/* 40rem = 640px: the same width as the form, so the buttons sit under its right edge. */}
      <StickyActionBar dirty={dirty} saving={saving} saveLabel="Send invite" maxWidth="40rem" onCancel={() => guard.leave(LIST_HREF)} />
      {guard.dialog}
    </form>
  );
}
