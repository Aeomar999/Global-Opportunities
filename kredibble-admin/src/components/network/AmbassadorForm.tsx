"use client";

/**
 * AmbassadorForm: add (/network/new) or edit (/network/[id]/edit) one ambassador. Built on the shared form system.
 *
 * Fields (required ones have no "Optional" tag):
 *   Person       full name, email (checked for a valid address), phone (optional), country, city, profile photo (optional)
 *   Role         member type, role title (optional), campus, tier (Ambassador, Senior Ambassador, Campus or Regional Lead),
 *                status (applicant, onboarding, active, dormant), description (optional)
 *   Team         assigned lead (optional, a team member), trained (a switch), linked user account (optional, a seeker)
 * THE REFERRAL CODE IS NOT A FIELD. It is generated when the ambassador is added (GOD-XXXXXX, unique) and shown read-only
 * (ReferralCodeCard: a locked look and a Copy button). There is no input for it anywhere, and saving an edit never changes it.
 * Validation: errors show after a field is left and on submit; the first invalid field takes focus. Leaving with unsaved
 * changes asks first. Each save carries a TODO(backend).
 *
 * Props: ambassador? (the ambassador being edited; omit for a new one)
 */
import { useMemo, useRef, useState, type FormEvent } from "react";
import { LISTING_COUNTRIES } from "@/config/countries";
import {
  AMBASSADOR_STATUSES,
  AMBASSADOR_TIERS,
  AMBASSADOR_TIER_LABELS,
  MEMBER_TYPES,
  MEMBER_TYPE_LABELS,
  type Ambassador,
  type AmbassadorStatus,
  type AmbassadorTier,
  type MemberType,
} from "@/lib/mock-entities";
import { createAmbassador, leadOptions, seekerOptions, updateAmbassador, type AmbassadorFields } from "@/lib/services/network";
import { ReferralCodeCard } from "@/components/network/ReferralCodeCard";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/form/Field";
import { FileDrop } from "@/components/ui/form/FileDrop";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input } from "@/components/ui/form/Input";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { StickyActionBar } from "@/components/ui/form/StickyActionBar";
import { Switch } from "@/components/ui/form/Switch";
import { Textarea } from "@/components/ui/form/Textarea";
import { focusFirstInvalid, useTouched } from "@/components/ui/form/use-touched";
import { useUnsavedGuard } from "@/components/ui/form/use-unsaved-guard";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { useToast } from "@/components/ui/Toast";
import { getStatusMeta } from "@/lib/status-map";

const LIST_HREF = "/network";
const NONE = "none";

const COUNTRY_OPTIONS: SelectOption<string>[] = LISTING_COUNTRIES.map((country) => ({ value: country, label: country }));
const MEMBER_OPTIONS: SelectOption<MemberType>[] = MEMBER_TYPES.map((value) => ({ value, label: MEMBER_TYPE_LABELS[value] }));
const TIER_OPTIONS: SelectOption<AmbassadorTier>[] = AMBASSADOR_TIERS.map((value) => ({ value, label: AMBASSADOR_TIER_LABELS[value] }));
const STATUS_OPTIONS: SelectOption<AmbassadorStatus>[] = AMBASSADOR_STATUSES.map((value) => ({ value, label: getStatusMeta(value).label }));

interface FormState {
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  photoUrl: string | undefined;
  memberType: MemberType;
  roleTitle: string;
  campus: string;
  tier: AmbassadorTier;
  status: AmbassadorStatus;
  description: string;
  assignedLeadId: string;
  trained: boolean;
  linkedSeekerId: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  photoUrl: undefined,
  memberType: "student",
  roleTitle: "",
  campus: "",
  tier: "ambassador",
  status: "applicant",
  description: "",
  assignedLeadId: NONE,
  trained: false,
  linkedSeekerId: NONE,
};

const fromAmbassador = (a: Ambassador): FormState => ({
  name: a.name,
  email: a.email,
  phone: a.phone ?? "",
  country: a.country,
  city: a.city,
  photoUrl: a.photoUrl,
  memberType: a.memberType,
  roleTitle: a.roleTitle ?? "",
  campus: a.campus,
  tier: a.tier,
  status: a.status,
  description: a.description ?? "",
  assignedLeadId: a.assignedLeadId ?? NONE,
  trained: a.trained,
  linkedSeekerId: a.linkedSeekerId ?? NONE,
});

type Errors = Partial<Record<"name" | "email" | "country" | "city" | "campus", string>>;

/** A simple address check: something@something.something (the server decides what is really valid). */
const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** The rules (exported for the tests). */
export function validateAmbassador(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.name.trim()) errors.name = "Enter the ambassador's full name.";
  if (!form.email.trim()) errors.email = "Enter an email address.";
  else if (!isEmailLike(form.email)) errors.email = "Enter a full email address, like name@university.edu.";
  if (!form.country) errors.country = "Choose a country.";
  if (!form.city.trim()) errors.city = "Enter the city.";
  if (!form.campus.trim()) errors.campus = "Enter the campus.";
  return errors;
}

export function AmbassadorForm({ ambassador }: { ambassador?: Ambassador }) {
  const leads = useMemo(() => leadOptions(), []);
  const seekers = useMemo(() => seekerOptions(), []);
  const initial = useMemo<FormState>(() => (ambassador ? fromAmbassador(ambassador) : EMPTY), [ambassador]);
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { show, touch, touchAll } = useTouched();
  const toast = useToast();

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const guard = useUnsavedGuard(dirty && !saving);
  const errors = validateAmbassador(form);
  const leadSelect: SelectOption<string>[] = [{ value: NONE, label: "No lead assigned" }, ...leads.map((person) => ({ value: person.id, label: person.name, description: person.title }))];
  const seekerSelect: SelectOption<string>[] = [{ value: NONE, label: "No linked account" }, ...seekers.map((seeker) => ({ value: seeker.id, label: seeker.name, description: seeker.email }))];

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    touchAll();
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    // TODO(backend): persist this change (create or update the ambassador; the API generates the referral code).
    await new Promise((resolve) => setTimeout(resolve, 600));
    const fields: AmbassadorFields = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      country: form.country,
      city: form.city.trim(),
      photoUrl: form.photoUrl,
      memberType: form.memberType,
      roleTitle: form.roleTitle.trim() || undefined,
      campus: form.campus.trim(),
      tier: form.tier,
      status: form.status,
      description: form.description.trim() || undefined,
      assignedLeadId: form.assignedLeadId === NONE ? undefined : form.assignedLeadId,
      trained: form.trained,
      linkedSeekerId: form.linkedSeekerId === NONE ? undefined : form.linkedSeekerId,
    };
    const saved = ambassador ? updateAmbassador(ambassador.id, fields) : createAmbassador(fields);
    toast.success(
      ambassador ? `${fields.name} was updated.` : `${fields.name} was added to the network.${saved ? ` Their referral code is ${saved.referralCode}.` : ""}`,
    );
    guard.leaveNow(saved ? `${LIST_HREF}/${saved.id}` : LIST_HREF);
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div className="max-w-240">
        <h1 data-testid="page-title" className="page-title">
          {ambassador ? "Edit ambassador" : "New ambassador"}
        </h1>
        <p className="page-subtitle mt-1 mb-6">
          {ambassador ? "Change this ambassador's details. Their referral code stays as it is." : "Add someone to the ambassador network. Their referral code is made when you save."}
        </p>
        <NotConnectedNotice className="mb-4" />

        <div className="space-y-4">
          <Card>
            <FormSection title="Person" description="Who they are and where to reach them.">
              <Field label="Full name" error={show("name") ? errors.name : undefined}>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} onBlur={() => touch("name")} placeholder="e.g. Ama Boateng" autoComplete="off" />
              </Field>
              <Field label="Email" error={show("email") ? errors.email : undefined}>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} onBlur={() => touch("email")} placeholder="name@university.edu" autoComplete="off" />
              </Field>
              <Field label="Phone" optional>
                <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+233 24 000 0000" autoComplete="off" />
              </Field>
              <Field label="Country" error={show("country") ? errors.country : undefined}>
                <Select options={COUNTRY_OPTIONS} value={form.country} onChange={(value) => set("country", value)} onBlur={() => touch("country")} placeholder="Choose a country" sheetTitle="Country" />
              </Field>
              <Field label="City" error={show("city") ? errors.city : undefined}>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} onBlur={() => touch("city")} placeholder="e.g. Kumasi" autoComplete="off" />
              </Field>
              <Field label="Profile photo" optional>
                <div className="max-w-sm">
                  <FileDrop value={form.photoUrl} onChange={(url) => set("photoUrl", url)} alt="Profile photo" emptyLabel="Click to upload or drag a photo here" />
                </div>
              </Field>
            </FormSection>
          </Card>

          <Card>
            <FormSection title="Role" description="Where they sit in the network.">
              <Field label="Member type">
                <Select options={MEMBER_OPTIONS} value={form.memberType} onChange={(value) => set("memberType", value)} sheetTitle="Member type" />
              </Field>
              <Field label="Role title" optional helper="For example: Campus lead, KNUST.">
                <Input value={form.roleTitle} onChange={(e) => set("roleTitle", e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Campus" error={show("campus") ? errors.campus : undefined}>
                <Input value={form.campus} onChange={(e) => set("campus", e.target.value)} onBlur={() => touch("campus")} placeholder="e.g. KNUST" autoComplete="off" />
              </Field>
              <Field label="Tier">
                <Select options={TIER_OPTIONS} value={form.tier} onChange={(value) => set("tier", value)} sheetTitle="Tier" />
              </Field>
              <Field label="Status">
                <Select options={STATUS_OPTIONS} value={form.status} onChange={(value) => set("status", value)} sheetTitle="Status" />
              </Field>
              <Field label="Description" optional>
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="A line or two about them and their campus." />
              </Field>
            </FormSection>
          </Card>

          <Card>
            <FormSection title="Team" description="Who looks after them, and their training.">
              <Field label="Assigned lead" optional>
                <Select options={leadSelect} value={form.assignedLeadId} onChange={(value) => set("assignedLeadId", value)} sheetTitle="Assigned lead" />
              </Field>
              <Switch
                checked={form.trained}
                onChange={(checked) => set("trained", checked)}
                label="Trained"
                statusText={form.trained ? "Yes" : "No"}
                description="Turn on once they have finished the desk's ambassador training."
              />
              <Field label="Linked user account" optional helper="Their seeker account on the platform, if they have one.">
                <Select options={seekerSelect} value={form.linkedSeekerId} onChange={(value) => set("linkedSeekerId", value)} sheetTitle="Linked user account" />
              </Field>
            </FormSection>
          </Card>

          {/* The referral code: read-only, never an input. */}
          <ReferralCodeCard code={ambassador?.referralCode} />
        </div>
      </div>

      <StickyActionBar
        dirty={dirty}
        saving={saving}
        saveLabel={ambassador ? "Save changes" : "Add ambassador"}
        maxWidth="60rem"
        onCancel={() => guard.leave(ambassador ? `${LIST_HREF}/${ambassador.id}` : LIST_HREF)}
      />
      {guard.dialog}
    </form>
  );
}
