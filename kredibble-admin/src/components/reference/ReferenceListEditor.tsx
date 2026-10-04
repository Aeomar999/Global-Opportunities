"use client";

/**
 * ReferenceListEditor: the content card for ONE reference list (this replaces TaxonomyManager's card;
 * the three old taxonomy pages and the merged Reference data page all use it).
 *
 *   Universities                                              21 items
 *   [ Add a new university...            ] [+ Add]
 *   (!) "MIT" is already in this list.                     <- duplicate: inline error
 *   [ Search universities... ]                             <- only when the list has more than 12 items
 *   ( Ashesi University (x) ) ( MIT (x) ) ...              <- removable chips
 *
 * Rules (same as before, plus the new ones from the brief):
 * - Enter in the field submits, like the Add button
 * - an empty (or spaces-only) field disables Add
 * - a duplicate is refused with an inline error (compared ignoring case and spaces at the ends)
 * - each chip's x is a real <button> labelled "Remove <name>"
 * - the placeholder uses the list's explicit singular ("Add a new university...")
 *
 * Props: label ("Universities"), singular ("university"), items, onChange(items)
 */
import { useRef, useState, type FormEvent } from "react";
import { Plus, SearchX, X } from "lucide-react";
import { SEARCH_THRESHOLD } from "@/lib/reference-data";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";

interface ReferenceListEditorProps {
  label: string;
  singular: string;
  items: string[];
  onChange: (items: string[]) => void;
}

const normalise = (value: string) => value.trim().toLowerCase();

export function ReferenceListEditor({ label, singular, items, onChange }: ReferenceListEditorProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const addRef = useRef<HTMLInputElement>(null);

  const searchable = items.length > SEARCH_THRESHOLD;
  const needle = normalise(query);
  const visible = searchable && needle ? items.filter((item) => normalise(item).includes(needle)) : items;

  const add = (event: FormEvent) => {
    event.preventDefault();
    const next = value.trim();
    if (!next) return;
    if (items.some((item) => normalise(item) === normalise(next))) {
      setError(`"${next}" is already in this list.`);
      return;
    }
    // TODO(backend): persist this change
    onChange([...items, next]);
    setValue("");
    setError(null);
  };

  const remove = (item: string) => {
    // TODO(backend): persist this change
    onChange(items.filter((existing) => existing !== item));
    addRef.current?.focus(); // the chip with focus is gone: keep the keyboard place in the card
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="card-title">{label}</h2>
        <p className="caption tabular-nums" aria-live="polite">
          {items.length} {items.length === 1 ? "item" : "items"}
        </p>
      </div>

      <form onSubmit={add} noValidate className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Field label={`Add a new ${singular}`} hideLabel error={error ?? undefined}>
            <Input
              ref={addRef}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              placeholder={`Add a new ${singular}...`}
              autoComplete="off"
            />
          </Field>
        </div>
        <Button type="submit" icon={Plus} disabled={!value.trim()} className="shrink-0">
          Add
        </Button>
      </form>

      {searchable && (
        <div className="mt-3">
          <Input
            type="search"
            aria-label={`Search ${label.toLowerCase()}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            autoComplete="off"
          />
          {needle && (
            <p className="caption mt-1.5" aria-live="polite">
              Showing {visible.length} of {items.length}
            </p>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="body-sm mt-4 text-muted">No entries yet. Add one above.</p>
      ) : visible.length === 0 ? (
        <div className="mt-2">
          <EmptyState icon={SearchX} title={`No ${label.toLowerCase()} match "${query.trim()}"`} />
        </div>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label={label}>
          {visible.map((item) => (
            <li
              key={item}
              className="input-text flex max-w-full items-center gap-1 rounded-pill border border-line bg-surface-2 py-1 pl-3 pr-1 text-ink"
            >
              <span className="min-w-0 break-words">{item}</span>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => remove(item)}
                className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-pill text-muted transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-danger-soft hover:text-danger"
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
