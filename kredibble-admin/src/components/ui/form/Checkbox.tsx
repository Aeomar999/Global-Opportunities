"use client";

/**
 * Checkbox: a native checkbox (so keyboard, forms and screen readers just work) restyled with the
 * brand tokens. The label is clickable; an optional description sits under it.
 *
 * Props: checked, onChange(checked), label, description?, disabled?
 * Selected = purple-600 fill with a white check (never orange).
 */
import { useId } from "react";
import { Check } from "lucide-react";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, description, disabled }: CheckboxProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div className="flex items-start gap-3">
      <span className="relative mt-0.5 inline-flex size-5 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={description ? descriptionId : undefined}
          onChange={(event) => onChange(event.target.checked)}
          className="peer size-5 cursor-pointer appearance-none rounded-inset border border-input bg-surface transition-colors checked:border-purple-600 checked:bg-purple-600 disabled:cursor-not-allowed disabled:bg-neutral-soft"
        />
        <Check
          size={14}
          strokeWidth={3}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className="min-w-0">
        <label htmlFor={id} className="input-text cursor-pointer font-medium text-ink">
          {label}
        </label>
        {description && (
          <span id={descriptionId} className="caption block">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}
