"use client";

/**
 * Field: the wrapper every form control sits in.
 *
 *   Label (13/18, 600)  [Optional]
 *   <control>
 *   helper text (12/16, muted)        or        (!) inline error (12/16, danger, with an icon)
 *
 * The control inside (Input, Textarea, Select, FileDrop) reads the field's id, description and
 * invalid state from context, so the label, helper and error are wired up for screen readers
 * without the page passing ids around:
 * - the label's htmlFor matches the control's id
 * - helper and error are listed in aria-describedby
 * - an error sets aria-invalid on the control
 *
 * Props:
 * - label: visible label text
 * - hideLabel: keep the label for screen readers only (the control is explained by its surroundings)
 * - optional: shows a muted "Optional" tag after the label (required is the default, so it is not marked)
 * - helper: one short line of guidance under the control
 * - error: the message (text, or text with a link in it) to show NOW. The page decides when: after the field was blurred (touched) or
 *   after a submit attempt (see useTouched). While an error shows, it replaces the helper.
 * - children: the control
 *
 * CONTROL_CLASSES is the shared look of text-like controls: 40px tall, 12px radius, 1px
 * border-input boundary (3.3:1), one flush focus ring (purple, or danger when invalid).
 */
import { createContext, useContext, useId, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Attributes a control spreads onto its focusable element. Empty outside a Field. */
export function useFieldControlProps() {
  const field = useContext(FieldContext);
  if (!field) return {};
  return {
    id: field.id,
    "aria-describedby": field.describedBy,
    "aria-invalid": field.invalid || undefined,
  };
}

export const CONTROL_CLASSES = cn(
  // "form-control" carries the ONE focus treatment (globals.css): purple border + a flush 3px ring.
  "form-control input-text w-full rounded-control border border-input bg-surface px-3 text-ink",
  "placeholder:text-muted transition-colors duration-150",
  "hover:border-purple-400",
  "aria-invalid:border-danger",
  "disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-muted",
);

interface FieldProps {
  label: string;
  hideLabel?: boolean;
  optional?: boolean;
  helper?: string;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hideLabel, optional, helper, error, className, children }: FieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: !!error }}>
      <div className={cn("min-w-0", className)}>
        <div className={cn("mb-1.5 flex items-baseline gap-2", hideLabel && "sr-only")}>
          <label htmlFor={id} className="field-label text-ink">
            {label}
          </label>
          {optional && <span className="caption">Optional</span>}
        </div>
        {children}
        {helper && (
          <p id={helperId} className="caption mt-1.5">
            {helper}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="caption mt-1.5 flex items-start gap-1.5 text-danger">
            <AlertCircle size={14} strokeWidth={2} aria-hidden="true" className="mt-px shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
