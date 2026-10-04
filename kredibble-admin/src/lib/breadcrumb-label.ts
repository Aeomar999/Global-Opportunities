"use client";

/**
 * The entity name shown as the LAST breadcrumb segment of a detail page
 * ("People / Seekers / Enoch Mensah").
 *
 * The top bar (which draws the breadcrumbs) and the page (which owns the data) are far apart in the
 * component tree, so the label lives in a tiny external store that both sides use:
 *
 *   page:    useBreadcrumbLabel(name)           call it every render with
 *              undefined  -> still loading: the top bar shows a skeleton segment (never "Details")
 *              "Enoch Mensah" -> the loaded entity name
 *              "Not found" -> the record does not exist
 *   top bar: useCurrentBreadcrumbLabel()        reads it (and re-renders when it changes)
 *
 * The label is cleared when the page unmounts, so it can never leak onto the next page.
 * Because the page updates it in an effect, a status change that renames the record (rare) shows up
 * in the breadcrumb immediately too.
 */
import { useEffect, useSyncExternalStore } from "react";

let current: string | undefined;
const listeners = new Set<() => void>();

function setLabel(next: string | undefined) {
  if (current === next) return;
  current = next;
  listeners.forEach((notify) => notify());
}

/** Detail pages call this once their data state is known. See the file header for the values. */
export function useBreadcrumbLabel(name: string | undefined) {
  useEffect(() => {
    setLabel(name);
    return () => setLabel(undefined);
  }, [name]);
}

/** The current label, or undefined while loading / on pages that set none. Used by the top bar. */
export function useCurrentBreadcrumbLabel(): string | undefined {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => current,
    () => undefined,
  );
}
