"use client";

/**
 * SegmentedControl: a small set of mutually exclusive options (range picker,
 * status filter).
 *
 * Structure follows the WAI-ARIA radio-group pattern (the idea used by the
 * 21st.dev "Segmented Control" candidates): role="radiogroup", one tab stop
 * (roving tabindex), Arrow keys move AND select, Home/End jump to the ends.
 *
 * Look: an inset track (surface-2) with the selected segment raised as a white
 * pill with a purple border and purple-700 text. Purple marks selection;
 * orange is not used here.
 *
 * Props:
 * - options: [{ value, label, count? }]; a count is shown after the label in tabular numerals
 * - value: currently selected value
 * - onChange: called with the new value
 * - ariaLabel: accessible name for the group (required)
 */
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const next = (index + options.length) % options.length; // wrap around
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const target: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: options.length - 1,
    };
    if (event.key in target) {
      event.preventDefault();
      select(target[event.key]);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex w-fit gap-1 rounded-control border border-line bg-surface-2 p-0.5"
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "button-text h-10 rounded-inset border px-3 transition-colors duration-150 ease-out",
              // Inactive segments keep a transparent border so nothing shifts when the selection changes.
              selected
                ? "border-purple-200 bg-surface text-purple-700 shadow-card"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {option.label}
            {/* A real space keeps the accessible name readable: "All 4", not "All4". */}
            {option.count !== undefined && " "}
            {option.count !== undefined && (
              <span className={cn("badge-text ml-1", selected ? "text-purple-700" : "text-muted")}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
