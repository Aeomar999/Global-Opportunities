"use client";

/**
 * ProgramForm: create (/programs/new) or edit (/programs/[id]/edit) one program. Built on the shared form system.
 *
 * Fields (required ones have no "Optional" tag):
 *   About        title, program type (training, bootcamp, webinar, outreach, project, mentorship, event), status
 *                (planned, running, delivered, cancelled), format (online, in person, hybrid)
 *   People       linked partner (optional), participants now, participant target, facilitators (chips)
 *   Place & time country, location (optional), start date and time, end date and time
 *   Notes        optional free text
 * Validation (errors show after a field is left and on submit; the first invalid field takes focus):
 *   - the end must be after the start
 *   - the target is a whole number of at least 1; the count a whole number of 0 or more
 *   - while the status is "planned" the count cannot be above the target
 * A "Delivered" status shows the note "Delivered programs count toward the monthly target" (a delivered program counts in
 * the month it ends). Leaving with unsaved changes asks first.
 * Data: services/programs.ts (shared mock store). Each save carries a TODO(backend).
 *
 * Props: program? (the program being edited; omit for a new one)
 */
import { useMemo, useRef, useState, type FormEvent } from "react";
import { Info } from "lucide-react";
import { LISTING_COUNTRIES } from "@/config/countries";
import { PROGRAM_FORMATS, PROGRAM_STATUSES, PROGRAM_TYPES, type Program, type ProgramFormat, type ProgramStatus, type ProgramType } from "@/lib/mock-entities";
import { createProgram, programPartnerOptions, updateProgram, type ProgramFields } from "@/lib/services/programs";
import { Card } from "@/components/ui/Card";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { ChipsInput } from "@/components/ui/form/ChipsInput";
import { Field } from "@/components/ui/form/Field";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input } from "@/components/ui/form/Input";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { StickyActionBar } from "@/components/ui/form/StickyActionBar";
import { Textarea } from "@/components/ui/form/Textarea";
import { focusFirstInvalid, useTouched } from "@/components/ui/form/use-touched";
import { useUnsavedGuard } from "@/components/ui/form/use-unsaved-guard";
import { useToast } from "@/components/ui/Toast";
import { PROGRAM_FORMAT_LABELS, PROGRAM_STATUS_LABELS, PROGRAM_TYPE_META } from "./program-meta";

const LIST_HREF = "/programs";
const NONE = "none";

const TYPE_OPTIONS: SelectOption<ProgramType>[] = PROGRAM_TYPES.map((value) => ({ value, label: PROGRAM_TYPE_META[value].label }));
const STATUS_OPTIONS: SelectOption<ProgramStatus>[] = PROGRAM_STATUSES.map((value) => ({ value, label: PROGRAM_STATUS_LABELS[value] }));
const FORMAT_OPTIONS: SelectOption<ProgramFormat>[] = PROGRAM_FORMATS.map((value) => ({ value, label: PROGRAM_FORMAT_LABELS[value] }));
const COUNTRY_OPTIONS: SelectOption<string>[] = LISTING_COUNTRIES.map((country) => ({ value: country, label: country }));

interface FormState {
  name: string;
  type: ProgramType;
  status: ProgramStatus;
  format: ProgramFormat;
  partnerId: string;
  /** Kept as text while typing, so "" is not turned into 0. */
  participants: string;
  target: string;
  facilitators: string[];
  country: string;
  location: string;
  startAt: string;
  endAt: string;
  notes: string;
}

const EMPTY: FormState = {
  name: "",
  type: "training",
  status: "planned",
  format: "in-person",
  partnerId: NONE,
  participants: "0",
  target: "",
  facilitators: [],
  country: "",
  location: "",
  startAt: "",
  endAt: "",
  notes: "",
};

/** "2026-10-03" -> "2026-10-03T09:00" (the date-time input needs a time); a full value is kept. */
const toInput = (value: string) => (value.length === 10 ? `${value}T09:00` : value.slice(0, 16));

const fromProgram = (program: Program): FormState => ({
  name: program.name,
  type: program.type,
  status: program.status,
  format: program.format,
  partnerId: program.partnerId ?? NONE,
  participants: String(program.participants),
  target: String(program.target),
  facilitators: program.facilitators,
  country: program.country,
  location: program.location ?? "",
  startAt: toInput(program.startAt),
  endAt: toInput(program.endAt),
  notes: program.notes ?? "",
});

const isWholeNumber = (text: string) => /^\d+$/.test(text.trim());

type Errors = Partial<Record<"name" | "country" | "startAt" | "endAt" | "target" | "participants", string>>;

/** The rules (exported for the tests). */
export function validateProgram(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.name.trim()) errors.name = "Enter a title.";
  if (!form.country) errors.country = "Choose a country.";
  if (!form.startAt) errors.startAt = "Choose the start date and time.";
  if (!form.endAt) errors.endAt = "Choose the end date and time.";
  else if (form.startAt && form.endAt <= form.startAt) errors.endAt = "The end must be after the start.";
  const target = Number(form.target);
  if (!isWholeNumber(form.target) || target < 1) errors.target = "Enter a target of at least 1.";
  if (!isWholeNumber(form.participants)) errors.participants = "Enter the number of participants now (0 or more).";
  else if (form.status === "planned" && !errors.target && Number(form.participants) > target) {
    errors.participants = "The count cannot be above the target while the program is planned.";
  }
  return errors;
}

export function ProgramForm({ program }: { program?: Program }) {
  const initial = useMemo<FormState>(() => (program ? fromProgram(program) : EMPTY), [program]);
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { show, touch, touchAll } = useTouched();
  const toast = useToast();

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const guard = useUnsavedGuard(dirty && !saving);
  const errors = validateProgram(form);
  const partnerOptions: SelectOption<string>[] = useMemo(
    () => [{ value: NONE, label: "No linked partner" }, ...programPartnerOptions().map((partner) => ({ value: partner.id, label: partner.name }))],
    [],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    touchAll();
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    // TODO(backend): persist this change (create or update the program).
    await new Promise((resolve) => setTimeout(resolve, 600));
    const fields: ProgramFields = {
      name: form.name.trim(),
      type: form.type,
      status: form.status,
      format: form.format,
      partnerId: form.partnerId === NONE ? undefined : form.partnerId,
      participants: Number(form.participants),
      target: Number(form.target),
      facilitators: form.facilitators,
      country: form.country,
      location: form.location.trim() || undefined,
      startAt: form.startAt,
      endAt: form.endAt,
      notes: form.notes.trim() || undefined,
    };
    const saved = program ? updateProgram(program.id, fields) : createProgram(fields);
    toast.success(program ? `${fields.name} was updated.` : `${fields.name} was created.`);
    guard.leaveNow(saved ? `${LIST_HREF}/${saved.id}` : LIST_HREF);
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div className="max-w-240">
        <h1 data-testid="page-title" className="page-title">
          {program ? "Edit program" : "New program"}
        </h1>
        <p className="page-subtitle mt-1 mb-6">
          {program ? "Change this program." : "Add something the desk runs: a training, a bootcamp, a webinar and so on."}
        </p>

        <NotConnectedNotice className="mb-4" />

        <div className="space-y-4">
          <Card>
            <FormSection title="About" description="What it is and where it stands.">
              <Field label="Title" error={show("name") ? errors.name : undefined}>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} onBlur={() => touch("name")} placeholder="e.g. CV and Interview Masterclass" autoComplete="off" />
              </Field>
              <Field label="Program type">
                <Select options={TYPE_OPTIONS} value={form.type} onChange={(value) => set("type", value)} sheetTitle="Program type" />
              </Field>
              <Field label="Status">
                <Select options={STATUS_OPTIONS} value={form.status} onChange={(value) => set("status", value)} sheetTitle="Status" />
              </Field>
              {form.status === "delivered" && (
                <p data-testid="delivered-note" className="caption flex items-start gap-2 rounded-inset bg-purple-50 px-3 py-2 text-ink">
                  <Info size={14} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-purple-700" />
                  Delivered programs count toward the monthly target
                </p>
              )}
              <Field label="Format">
                <Select options={FORMAT_OPTIONS} value={form.format} onChange={(value) => set("format", value)} sheetTitle="Format" />
              </Field>
            </FormSection>
          </Card>

          <Card>
            <FormSection title="People" description="Who runs it, who joins and who it is with.">
              <Field label="Linked partner" optional helper="The partner this program is run with, if any.">
                <Select options={partnerOptions} value={form.partnerId} onChange={(value) => set("partnerId", value)} sheetTitle="Linked partner" />
              </Field>
              <Field label="Participants now" error={show("participants") ? errors.participants : undefined}>
                <Input type="number" inputMode="numeric" min={0} value={form.participants} onChange={(e) => set("participants", e.target.value)} onBlur={() => touch("participants")} />
              </Field>
              <Field label="Participant target" error={show("target") ? errors.target : undefined} helper="At least 1.">
                <Input type="number" inputMode="numeric" min={1} value={form.target} onChange={(e) => set("target", e.target.value)} onBlur={() => touch("target")} placeholder="e.g. 60" />
              </Field>
              <Field label="Facilitators" optional helper="Type a name and press Enter to add it.">
                <ChipsInput value={form.facilitators} onChange={(next) => set("facilitators", next)} chipsLabel="Added facilitators" placeholder="e.g. Kwabena Tetteh" />
              </Field>
            </FormSection>
          </Card>

          <Card>
            <FormSection title="Place and time" description="Where and when it happens.">
              <Field label="Country" error={show("country") ? errors.country : undefined}>
                <Select options={COUNTRY_OPTIONS} value={form.country} onChange={(value) => set("country", value)} onBlur={() => touch("country")} placeholder="Choose a country" sheetTitle="Country" />
              </Field>
              <Field label="Location" optional helper="A city, a venue or a link.">
                <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Accra" autoComplete="off" />
              </Field>
              <Field label="Start date and time" error={show("startAt") ? errors.startAt : undefined}>
                <Input type="datetime-local" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} onBlur={() => touch("startAt")} />
              </Field>
              <Field label="End date and time" error={show("endAt") ? errors.endAt : undefined}>
                <Input type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} onBlur={() => touch("endAt")} />
              </Field>
            </FormSection>
          </Card>

          <Card>
            <FormSection title="Notes" description="Anything the team should know.">
              <Field label="Notes" optional>
                <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={4} placeholder="Preparation, materials, follow-ups..." />
              </Field>
            </FormSection>
          </Card>
        </div>
      </div>

      <StickyActionBar
        dirty={dirty}
        saving={saving}
        saveLabel={program ? "Save changes" : "Create program"}
        maxWidth="60rem"
        onCancel={() => guard.leave(program ? `${LIST_HREF}/${program.id}` : LIST_HREF)}
      />
      {guard.dialog}
    </form>
  );
}
