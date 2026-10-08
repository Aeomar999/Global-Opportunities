"use client";

/**
 * RecordForm: add one beneficiary record (/database/new). Built on the shared form system.
 *
 * Fields (required ones have no "Optional" tag):
 *   Person    full name, email (checked for a valid address), phone (optional), country, institution
 *   Source    source type (organic, ambassador referral, event, partner channel, bulk import); the LINKED AMBASSADOR field appears
 *             only when the source is "Ambassador referral" (and is then required); linked opportunity (optional)
 *   Status    verified (a switch); added by (the signed-in person) and added on (today): both READ-ONLY, set by the service
 * DUPLICATES: as soon as the email (or, when the email is new, the phone) matches a record, an inline error says
 * "A record with this email already exists" with a link to that record, and saving is blocked. Email is compared trimmed and
 * without case; phone without spaces, dashes or the leading + or 0 (see findDuplicate in services/database.ts). Email is checked first.
 * Validation: errors show after a field is left and on submit; the first invalid field takes focus. Leaving with unsaved changes
 * asks first. The save carries a TODO(backend).
 */
import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { LISTING_COUNTRIES } from "@/config/countries";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/form/Field";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input } from "@/components/ui/form/Input";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { StickyActionBar } from "@/components/ui/form/StickyActionBar";
import { Switch } from "@/components/ui/form/Switch";
import { focusFirstInvalid, useTouched } from "@/components/ui/form/use-touched";
import { useUnsavedGuard } from "@/components/ui/form/use-unsaved-guard";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import { RECORD_SOURCES, RECORD_SOURCE_LABELS, type RecordSource } from "@/lib/mock-entities";
import { useMockCollection } from "@/lib/mock-store";
import { todayIsoDate } from "@/lib/services/listings";
import { DUPLICATE_MESSAGES, ambassadorOptions, createRecord, currentRecorder, findDuplicate, opportunityOptions, type Duplicate } from "@/lib/services/database";

const LIST_HREF = "/database";
const NONE = "none";

const COUNTRY_OPTIONS: SelectOption<string>[] = LISTING_COUNTRIES.filter((country) => country !== "Worldwide").map((country) => ({ value: country, label: country }));
const SOURCE_OPTIONS: SelectOption<RecordSource>[] = RECORD_SOURCES.map((value) => ({ value, label: RECORD_SOURCE_LABELS[value] }));

export interface RecordFormState {
  name: string;
  email: string;
  phone: string;
  country: string;
  institution: string;
  source: RecordSource;
  ambassadorId: string;
  listingId: string;
  verified: boolean;
}

const EMPTY: RecordFormState = { name: "", email: "", phone: "", country: "", institution: "", source: "organic", ambassadorId: "", listingId: NONE, verified: false };

type Errors = Partial<Record<"name" | "email" | "country" | "institution" | "ambassadorId", string>>;

/** A simple address check: something@something.something (the server decides what is really valid). */
const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** The rules (exported for the tests). Duplicates are a separate rule (findDuplicate). */
export function validateRecord(form: RecordFormState): Errors {
  const errors: Errors = {};
  if (!form.name.trim()) errors.name = "Enter the person's full name.";
  if (!form.email.trim()) errors.email = "Enter an email address.";
  else if (!isEmailLike(form.email)) errors.email = "Enter a full email address, like name@university.edu.";
  if (!form.country) errors.country = "Choose a country.";
  if (!form.institution.trim()) errors.institution = "Enter the institution.";
  if (form.source === "ambassador" && !form.ambassadorId) errors.ambassadorId = "Choose the ambassador who referred them.";
  return errors;
}

function DuplicateError({ duplicate }: { duplicate: Duplicate }) {
  return (
    <span data-testid={`duplicate-${duplicate.field}`}>
      {DUPLICATE_MESSAGES[duplicate.field]}.{" "}
      <Link href={`${LIST_HREF}/${duplicate.record.id}`} className="font-semibold underline">
        Open {duplicate.record.name}
      </Link>
    </span>
  );
}

export function RecordForm() {
  const ambassadors = useMemo(() => ambassadorOptions(), []);
  const opportunities = useMemo(() => opportunityOptions(), []);
  const recorder = useMemo(() => currentRecorder(), []);
  const records = useMockCollection("databaseRecords");
  const [form, setForm] = useState<RecordFormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { show, touch, touchAll } = useTouched();
  const toast = useToast();

  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY);
  const guard = useUnsavedGuard(dirty && !saving);
  const errors = validateRecord(form);
  // Email first, then phone: the duplicate shows as soon as it is typed.
  const duplicate = findDuplicate({ email: form.email, phone: form.phone, country: form.country }, records);
  const blocked = duplicate !== null;

  const ambassadorSelect: SelectOption<string>[] = ambassadors.map((a) => ({ value: a.id, label: a.name, description: a.campus }));
  const opportunitySelect: SelectOption<string>[] = [{ value: NONE, label: "No linked opportunity" }, ...opportunities.map((o) => ({ value: o.id, label: o.title, description: o.organisation }))];

  const set = <K extends keyof RecordFormState>(key: K, value: RecordFormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    touchAll();
    if (Object.keys(errors).length > 0 || blocked) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    // TODO(backend): persist this change (create the record; the API sets who added it and when).
    await new Promise((resolve) => setTimeout(resolve, 600));
    const result = createRecord({
      name: form.name,
      email: form.email,
      phone: form.phone,
      country: form.country,
      institution: form.institution,
      source: form.source,
      verified: form.verified,
      ambassadorId: form.source === "ambassador" ? form.ambassadorId : undefined,
      listingId: form.listingId === NONE ? undefined : form.listingId,
    });
    if (!result.ok) {
      // Someone else added the same person while this form was open: nothing was written.
      setSaving(false);
      toast.error(`${DUPLICATE_MESSAGES[result.duplicate.field]}.`);
      return;
    }
    toast.success(`${result.record.name} was added to the database.`);
    guard.leaveNow(`${LIST_HREF}/${result.record.id}`);
  };

  const emailError = duplicate?.field === "email" ? <DuplicateError duplicate={duplicate} /> : show("email") ? errors.email : undefined;
  const phoneError = duplicate?.field === "phone" ? <DuplicateError duplicate={duplicate} /> : undefined;

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div className="max-w-240">
        <h1 data-testid="page-title" className="page-title">
          Add record
        </h1>
        <p className="page-subtitle mt-1 mb-6">Add a beneficiary to the desk&apos;s database. Someone already in it cannot be added twice.</p>
        <NotConnectedNotice className="mb-4" />

        <div className="space-y-4">
          <Card>
            <FormSection title="Person" description="Who they are and where to reach them.">
              <Field label="Full name" error={show("name") ? errors.name : undefined}>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} onBlur={() => touch("name")} placeholder="e.g. Ama Boateng" autoComplete="off" />
              </Field>
              <Field label="Email" error={emailError}>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} onBlur={() => touch("email")} placeholder="name@university.edu" autoComplete="off" />
              </Field>
              <Field label="Phone" optional error={phoneError}>
                <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+233 24 000 0000" autoComplete="off" />
              </Field>
              <Field label="Country" error={show("country") ? errors.country : undefined}>
                <Select options={COUNTRY_OPTIONS} value={form.country} onChange={(value) => set("country", value)} onBlur={() => touch("country")} placeholder="Choose a country" sheetTitle="Country" />
              </Field>
              <Field label="Institution" error={show("institution") ? errors.institution : undefined}>
                <Input value={form.institution} onChange={(e) => set("institution", e.target.value)} onBlur={() => touch("institution")} placeholder="e.g. KNUST" autoComplete="off" />
              </Field>
            </FormSection>
          </Card>

          <Card>
            <FormSection title="Source" description="How they came to the desk.">
              <Field label="Source type">
                <Select options={SOURCE_OPTIONS} value={form.source} onChange={(value) => set("source", value)} sheetTitle="Source type" />
              </Field>
              {form.source === "ambassador" && (
                <Field label="Linked ambassador" error={show("ambassadorId") ? errors.ambassadorId : undefined}>
                  <Select
                    options={ambassadorSelect}
                    value={form.ambassadorId}
                    onChange={(value) => set("ambassadorId", value)}
                    onBlur={() => touch("ambassadorId")}
                    placeholder="Choose the ambassador"
                    sheetTitle="Linked ambassador"
                  />
                </Field>
              )}
              <Field label="Linked opportunity" optional helper="The opportunity they came in through, if there is one.">
                <Select options={opportunitySelect} value={form.listingId} onChange={(value) => set("listingId", value)} sheetTitle="Linked opportunity" />
              </Field>
            </FormSection>
          </Card>

          <Card>
            <FormSection title="Status" description="Verified records count toward this month's target.">
              <Switch
                checked={form.verified}
                onChange={(checked) => set("verified", checked)}
                label="Verified"
                statusText={form.verified ? "Yes" : "No"}
                description="Turn on if the desk has already checked this person. Otherwise verify them later from the list."
              />
              <Field label="Added by" helper="The signed-in person. This cannot be changed.">
                <Input value={recorder?.name ?? "—"} readOnly disabled data-testid="added-by" />
              </Field>
              <Field label="Added on" helper="Today. This cannot be changed.">
                <Input value={formatDate(todayIsoDate())} readOnly disabled data-testid="added-on" />
              </Field>
            </FormSection>
          </Card>
        </div>
      </div>

      <StickyActionBar
        dirty={dirty}
        saving={saving}
        saveLabel="Add record"
        maxWidth="60rem"
        saveDisabled={blocked}
        saveDisabledReason={duplicate ? `${DUPLICATE_MESSAGES[duplicate.field]}.` : undefined}
        onCancel={() => guard.leave(LIST_HREF)}
      />
      {guard.dialog}
    </form>
  );
}
