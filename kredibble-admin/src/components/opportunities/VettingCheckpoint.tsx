"use client";

/**
 * VettingCheckpoint: the card on the listing form where a person confirms that a listing was checked. It is visually
 * distinct from the other form cards (warning-tinted border and background, a shield icon that becomes a check once
 * vetted) because it is the gate: "Listings must be vetted before they can be published".
 *
 * Structure idea from the 21st.dev "Card Style Checkbox" candidates (a checkbox living inside a bordered card that
 * changes when selected); restyled with our tokens. Three controls:
 *   - Vetted (checkbox). Checking it sets "Vetted on" to today and "Vetted by" to the signed-in person.
 *   - Vetted by (Select of staff; disabled until vetted)
 *   - Vetted on (date; set automatically, still editable; disabled until vetted)
 * Unchecking clears both, because a listing that is not vetted has no vetter.
 *
 * Props:
 * - vetted, vettedById, vettedOn: the current values; onChange({ vetted, vettedById, vettedOn }) gives the next ones
 * - staff: the people who can be named as the vetter
 * - defaultVetterId: who is chosen when the box is first checked (the signed-in person)
 * - errors: { vettedBy?, vettedOn? } messages to show under those fields
 * - disabled: view-only (nothing can change)
 */
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { todayIsoDate } from "@/lib/services/listings";
import type { StaffMember } from "@/lib/mock-entities";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Select } from "@/components/ui/form/Select";

export interface VettingValue {
  vetted: boolean;
  vettedById: string;
  vettedOn: string;
}

interface VettingCheckpointProps extends VettingValue {
  staff: StaffMember[];
  defaultVetterId: string;
  onChange: (next: VettingValue) => void;
  errors?: { vettedBy?: string; vettedOn?: string };
  disabled?: boolean;
}

export function VettingCheckpoint({ vetted, vettedById, vettedOn, staff, defaultVetterId, onChange, errors, disabled }: VettingCheckpointProps) {
  const Icon = vetted ? ShieldCheck : ShieldAlert;
  return (
    <section
      aria-label="Vetting checkpoint"
      data-testid="vetting-checkpoint"
      className={cn(
        "rounded-card border-2 p-5",
        vetted ? "border-success-dot bg-success-soft" : "border-warning-dot bg-warning-soft",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn("flex size-10 shrink-0 items-center justify-center rounded-control bg-surface", vetted ? "text-success" : "text-warning")}
        >
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="card-title">Vetting checkpoint</h2>
          <p className="caption mt-1 text-ink">Listings must be vetted before they can be published.</p>
          <p className="caption text-ink">Check the organisation, the official link and the deadline, then confirm below.</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <Checkbox
          checked={vetted}
          disabled={disabled}
          label="Vetted"
          description="I have checked this listing and it is safe to show to seekers."
          onChange={(checked) =>
            onChange(
              checked
                ? { vetted: true, vettedById: vettedById || defaultVetterId, vettedOn: vettedOn || todayIsoDate() }
                : { vetted: false, vettedById: "", vettedOn: "" },
            )
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* inert while not vetted: the dropdown cannot be focused or opened, and it reads as unavailable */}
          <div inert={disabled || !vetted} className={cn((disabled || !vetted) && "opacity-60")}>
          <Field label="Vetted by" error={errors?.vettedBy}>
            <Select
              options={staff.map((person) => ({ value: person.id, label: person.name, description: person.title }))}
              value={vettedById}
              onChange={(value) => onChange({ vetted, vettedById: value, vettedOn })}
              placeholder="Choose who vetted it"
              sheetTitle="Vetted by"
            />
          </Field>
          </div>
          <Field label="Vetted on" error={errors?.vettedOn}>
            <Input type="date" value={vettedOn} disabled={disabled || !vetted} onChange={(event) => onChange({ vetted, vettedById, vettedOn: event.target.value })} />
          </Field>
        </div>
      </div>
    </section>
  );
}
