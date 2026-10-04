"use client";

/**
 * Switch: an on/off setting that takes effect as soon as the form is saved (role="switch").
 * Space or Enter toggles it. State is always shown in words too, never by colour alone.
 *
 *   Published                         Draft  [ switch ]      <- one row, vertically centred
 *   Visible to seekers when on. Saved as a draft when off.   <- helper, the full width of the card
 *
 * Props:
 * - checked / onChange(checked)
 * - label: what the switch controls ("Published")
 * - statusText: a small text next to the switch that names the current state ("Published" / "Draft")
 * - description: a line that explains both states; it sits under the row, never squeezed into a narrow column
 * On = purple-600 track; off = neutral track with a visible border.
 */
import { useId } from "react";
import { cn } from "@/lib/cn";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  statusText?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, statusText, disabled }: SwitchProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div>
      <div className="flex items-center gap-3">
        <label htmlFor={id} className="input-text min-w-0 flex-1 cursor-pointer font-medium text-ink">
          {label}
        </label>
        {statusText && (
          <span className="caption shrink-0 font-semibold text-ink" data-testid="switch-status">
            {statusText}
          </span>
        )}
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={description ? descriptionId : undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill border before:absolute before:-inset-y-[9px] before:inset-x-0 before:content-[''] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
            checked ? "border-purple-600 bg-purple-600" : "border-input bg-neutral-soft",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-block size-4 rounded-pill shadow-card transition-transform duration-150",
              checked ? "translate-x-6 bg-white" : "translate-x-1 bg-muted",
            )}
          />
        </button>
      </div>
      {description && (
        <p id={descriptionId} className="caption mt-1.5">
          {description}
        </p>
      )}
    </div>
  );
}
