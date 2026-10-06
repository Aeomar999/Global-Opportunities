"use client";

/**
 * ChipsInput: a field that holds a LIST of short values (facilitator names, tags) shown as removable chips.
 *
 *   [ type a name, press Enter ......................... ]      <- a normal Input (same focus treatment)
 *   ( Kwabena Tetteh × ) ( Esi Mensah-Owusu × )                 <- the chips, each with a real remove button
 *
 * Adding: Enter or a comma adds what was typed; leaving the field adds it too (so nothing typed is lost); pasting
 * "Ama, Kofi" adds both. Duplicates (ignoring case) and empty values are skipped. Removing: the × on a chip, or
 * Backspace in the empty field removes the last chip. Put it inside a <Field> so the label, helper and error connect.
 * Structure ideas (Enter or comma adds, paste splits, dedupe, Backspace) come from the 21st.dev "Tag Input"
 * candidates; the look is ours (Input + TagPill-like chips).
 *
 * Props:
 * - value: the current chips; onChange(next): called with the new list
 * - placeholder?: hint in the empty field
 * - chipsLabel: accessible name of the chip list ("Facilitators")
 * - max?: most chips allowed (further values are ignored)
 * - onBlur?: forward to useTouched
 */
import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "./Input";

interface ChipsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  chipsLabel: string;
  max?: number;
  onBlur?: () => void;
}

export function ChipsInput({ value, onChange, placeholder, chipsLabel, max, onBlur }: ChipsInputProps) {
  const [draft, setDraft] = useState("");

  /** Adds one or more values (already split), skipping empty ones and duplicates. */
  const add = (raw: string[]) => {
    const next = [...value];
    for (const item of raw.map((text) => text.trim()).filter(Boolean)) {
      if (max !== undefined && next.length >= max) break;
      if (!next.some((existing) => existing.toLowerCase() === item.toLowerCase())) next.push(item);
    }
    if (next.length !== value.length) onChange(next);
  };

  const commit = () => {
    if (draft.trim()) add([draft]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault(); // Enter must not submit the form while a chip is being typed
      commit();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!/[,\n]/.test(text)) return; // a single value pastes into the field as usual
    event.preventDefault();
    add(text.split(/[,\n]/));
  };

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(",", ""))}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          commit();
          onBlur?.();
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {value.length > 0 && (
        <ul aria-label={chipsLabel} className="flex flex-wrap gap-2">
          {value.map((chip) => (
            <li key={chip} className="inline-flex items-center gap-1 rounded-pill bg-purple-50 py-1 pl-3 pr-1 text-sm font-medium text-purple-700">
              {chip}
              <button
                type="button"
                aria-label={`Remove ${chip}`}
                onClick={() => onChange(value.filter((existing) => existing !== chip))}
                className="flex size-6 items-center justify-center rounded-pill hover:bg-purple-100"
              >
                <X size={12} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
