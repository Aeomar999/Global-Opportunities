"use client";

/**
 * useTouched: decides WHEN a field's error becomes visible.
 *
 * An error shows after the person has left the field (blur) or after they tried to submit, never
 * while they are still typing their first attempt.
 *
 *   const { show, touch, touchAll } = useTouched();
 *   <Field error={show("title") ? errors.title : undefined}>
 *     <Input onBlur={() => touch("title")} />
 *   ...
 *   onSubmit: touchAll(); if (hasErrors) return;
 *
 * - show(name): true once that field was touched or a submit was attempted
 * - touch(name): mark one field
 * - touchAll(): mark that a submit was attempted (every field's error shows)
 * - reset(): forget all of it (a form that was saved and emptied starts clean, with no errors showing)
 */
import { useCallback, useState } from "react";

export function useTouched() {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const touch = useCallback((name: string) => setTouched((current) => (current[name] ? current : { ...current, [name]: true })), []);
  const touchAll = useCallback(() => setSubmitted(true), []);
  const show = useCallback((name: string) => submitted || !!touched[name], [submitted, touched]);

  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
  }, []);

  return { show, touch, touchAll, reset };
}

/** After a failed submit: moves focus to the first control marked aria-invalid (waits for the errors to render). */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()),
  );
}
