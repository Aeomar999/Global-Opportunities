"use client";

/**
 * PartnerForm: create (/partners/new) or edit (/partners/[id]/edit) one partner. Built on the shared form system.
 *
 * Fields (required ones have no "Optional" tag):
 *   Organisation  organisation name, partner type (corporate, university, foundation, NGO, government, media & tech),
 *                 assigned owner (a team member), country, what they provide (one line, shown on the board card)
 *   Contact       contact name, contact email (optional, checked for a valid address), contact phone (optional)
 *   Background    how they were sourced (optional), notes (optional)
 * There is NO stage field: a new partner always starts at Prospect, and the stage changes only by moving the card on the
 * board. "Closed" is not a field either: it follows the stage by itself.
 * Validation: errors show after a field is left and on submit; the first invalid field takes focus. Leaving with unsaved
 * changes asks first. Each save carries a TODO(backend).
 *
 * Props: partner? (the partner being edited; omit for a new one)
 */
import { useMemo, useRef, useState, type FormEvent } from "react";
import { LISTING_COUNTRIES } from "@/config/countries";
import { PARTNER_TYPES, PARTNER_TYPE_LABELS, type Partner, type PartnerType } from "@/lib/mock-entities";
import { createPartner, partnerOwnerOptions, updatePartner, type PartnerFields } from "@/lib/services/partners";
import { currentStaffMember } from "@/lib/services/listings";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/form/Field";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input } from "@/components/ui/form/Input";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { StickyActionBar } from "@/components/ui/form/StickyActionBar";
import { Textarea } from "@/components/ui/form/Textarea";
import { focusFirstInvalid, useTouched } from "@/components/ui/form/use-touched";
import { useUnsavedGuard } from "@/components/ui/form/use-unsaved-guard";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { useToast } from "@/components/ui/Toast";

const LIST_HREF = "/partners";

const TYPE_OPTIONS: SelectOption<PartnerType>[] = PARTNER_TYPES.map((value) => ({ value, label: PARTNER_TYPE_LABELS[value] }));
const COUNTRY_OPTIONS: SelectOption<string>[] = LISTING_COUNTRIES.map((country) => ({ value: country, label: country }));

interface FormState {
  name: string;
  type: PartnerType;
  ownerId: string;
  country: string;
  provides: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  sourcedVia: string;
  notes: string;
}

const fromPartner = (partner: Partner): FormState => ({
  name: partner.name,
  type: partner.type,
  ownerId: partner.ownerId,
  country: partner.country,
  provides: partner.provides,
  contactName: partner.contactName,
  contactEmail: partner.contactEmail ?? "",
  contactPhone: partner.contactPhone ?? "",
  sourcedVia: partner.sourcedVia ?? "",
  notes: partner.notes ?? "",
});

type Errors = Partial<Record<"name" | "ownerId" | "country" | "provides" | "contactName" | "contactEmail", string>>;

/** A simple address check: something@something.something (the server decides what is really valid). */
export const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** The rules (exported for the tests). */
export function validatePartner(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.name.trim()) errors.name = "Enter the organisation's name.";
  if (!form.ownerId) errors.ownerId = "Choose who looks after this partner.";
  if (!form.country) errors.country = "Choose a country.";
  if (!form.provides.trim()) errors.provides = "Say in a line what they provide.";
  if (!form.contactName.trim()) errors.contactName = "Enter the contact's name.";
  if (form.contactEmail.trim() && !isEmailLike(form.contactEmail)) errors.contactEmail = "Enter a full email address, like name@company.com.";
  return errors;
}

export function PartnerForm({ partner }: { partner?: Partner }) {
  const owners = useMemo(() => partnerOwnerOptions(), []);
  const initial = useMemo<FormState>(() => {
    if (partner) return fromPartner(partner);
    return { name: "", type: "corporate", ownerId: currentStaffMember()?.id ?? owners[0]?.id ?? "", country: "", provides: "", contactName: "", contactEmail: "", contactPhone: "", sourcedVia: "", notes: "" };
  }, [partner, owners]);
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { show, touch, touchAll } = useTouched();
  const toast = useToast();

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const guard = useUnsavedGuard(dirty && !saving);
  const errors = validatePartner(form);
  const ownerOptions: SelectOption<string>[] = owners.map((person) => ({ value: person.id, label: person.name, description: person.title }));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    touchAll();
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    // TODO(backend): persist this change (create or update the partner).
    await new Promise((resolve) => setTimeout(resolve, 600));
    const fields: PartnerFields = {
      name: form.name.trim(),
      type: form.type,
      sector: partner?.sector ?? PARTNER_TYPE_LABELS[form.type],
      ownerId: form.ownerId,
      country: form.country,
      provides: form.provides.trim(),
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      sourcedVia: form.sourcedVia.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    const saved = partner ? updatePartner(partner.id, fields) : createPartner(fields);
    toast.success(partner ? `${fields.name} was updated.` : `${fields.name} was added at Prospect.`);
    guard.leaveNow(saved ? `${LIST_HREF}/${saved.id}` : LIST_HREF);
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div className="max-w-240">
        <h1 data-testid="page-title" className="page-title">
          {partner ? "Edit partner" : "New partner"}
        </h1>
        <p className="page-subtitle mt-1 mb-6">
          {partner ? "Change this partner's details. Move it between stages on the board." : "Add an organisation to the pipeline. It starts at Prospect."}
        </p>
        <NotConnectedNotice className="mb-4" />

        <div className="space-y-4">
          <Card>
            <FormSection title="Organisation" description="Who they are and who looks after them.">
              <Field label="Organisation name" error={show("name") ? errors.name : undefined}>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} onBlur={() => touch("name")} placeholder="e.g. Acme Foundation" autoComplete="off" />
              </Field>
              <Field label="Partner type">
                <Select options={TYPE_OPTIONS} value={form.type} onChange={(value) => set("type", value)} sheetTitle="Partner type" />
              </Field>
              <Field label="Assigned owner" error={show("ownerId") ? errors.ownerId : undefined}>
                <Select options={ownerOptions} value={form.ownerId} onChange={(value) => set("ownerId", value)} onBlur={() => touch("ownerId")} placeholder="Choose an owner" sheetTitle="Assigned owner" />
              </Field>
              <Field label="Country" error={show("country") ? errors.country : undefined}>
                <Select options={COUNTRY_OPTIONS} value={form.country} onChange={(value) => set("country", value)} onBlur={() => touch("country")} placeholder="Choose a country" sheetTitle="Country" />
              </Field>
              <Field label="What they provide" error={show("provides") ? errors.provides : undefined} helper="One line, shown on the card. For example: graduate roles and internships.">
                <Input value={form.provides} onChange={(e) => set("provides", e.target.value)} onBlur={() => touch("provides")} placeholder="e.g. Scholarship funding and grants" autoComplete="off" />
              </Field>
            </FormSection>
          </Card>

          <Card>
            <FormSection title="Contact" description="The person to talk to.">
              <Field label="Contact name" error={show("contactName") ? errors.contactName : undefined}>
                <Input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} onBlur={() => touch("contactName")} autoComplete="off" />
              </Field>
              <Field label="Contact email" optional error={show("contactEmail") ? errors.contactEmail : undefined}>
                <Input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} onBlur={() => touch("contactEmail")} placeholder="name@company.com" autoComplete="off" />
              </Field>
              <Field label="Contact phone" optional>
                <Input type="tel" inputMode="tel" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="+233 24 000 0000" autoComplete="off" />
              </Field>
            </FormSection>
          </Card>

          <Card>
            <FormSection title="Background" description="How you found them and anything to remember.">
              <Field label="How sourced" optional helper="For example: ambassador introduction, event contact, inbound request.">
                <Input value={form.sourcedVia} onChange={(e) => set("sourcedVia", e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Notes" optional>
                <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={4} placeholder="Preferences, history, next steps..." />
              </Field>
            </FormSection>
          </Card>
        </div>
      </div>

      <StickyActionBar
        dirty={dirty}
        saving={saving}
        saveLabel={partner ? "Save changes" : "Add partner"}
        maxWidth="60rem"
        onCancel={() => guard.leave(partner ? `${LIST_HREF}/${partner.id}` : LIST_HREF)}
      />
      {guard.dialog}
    </form>
  );
}
