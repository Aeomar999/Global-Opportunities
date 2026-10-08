"use client";

/**
 * useListData: the one hook every list page uses to load its rows.
 *
 * It returns { rows, isLoading, error, retry }:
 * - rows is null until the first load finishes (or after a failed one);
 * - error is a plain message string. Failures are kept in component STATE only:
 *   nothing here calls console.error, so handled errors never turn the Next.js dev
 *   badge red;
 * - retry re-runs the loader (there are no automatic retries).
 *
 * Dev-only state switch: in mock mode and never in production, adding
 * ?state=loading | error | empty to the page URL forces that state so every
 * layout can be reviewed:
 *   loading  never finishes, so the skeleton stays on screen
 *   error    fails with a message (and "Try again" re-runs the same forced state)
 *   empty    loads successfully with no rows
 *
 * Params:
 * - load: returns the rows. Must be a STABLE reference (a module-level function or useCallback),
 *   otherwise the list would reload on every render.
 * - options.subscribe: optional "something changed" subscription (for live in-memory stores such
 *   as the staff list). It is called with a function to run on every change and returns an
 *   unsubscribe function.
 */
import { ApiError } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import { isMockMode } from "@/lib/services/mock-mode";

export const LIST_FORCED_STATES = ["loading", "error", "empty"] as const;
export type ListForcedState = (typeof LIST_FORCED_STATES)[number];

/** The ?state= value on the current URL, or null. Mock mode and non-production only. */
export function readListForcedState(): ListForcedState | null {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production" || !isMockMode()) return null;
  const value = new URLSearchParams(window.location.search).get("state");
  return LIST_FORCED_STATES.find((state) => state === value) ?? null;
}

interface ListState<T> {
  rows: T[] | null;
  error: string | null;
  isLoading: boolean;
}

interface UseListDataOptions {
  subscribe?: (notify: () => void) => () => void;
}

export function useListData<T>(load: () => Promise<T[]>, options: UseListDataOptions = {}) {
  const { subscribe } = options;
  const [state, setState] = useState<ListState<T>>({ rows: null, error: null, isLoading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const forced = readListForcedState();
    if (forced === "loading") return; // never resolves: the skeleton stays

    const run = () => {
      const request =
        forced === "error"
          ? Promise.reject(new Error("Could not load this list. (forced: ?state=error)"))
          : forced === "empty"
            ? Promise.resolve<T[]>([])
            : load();
      request
        .then((rows) => !cancelled && setState({ rows, error: null, isLoading: false }))
        .catch((error: unknown) => {
          if (cancelled) return;
          setState({ rows: null, error: error instanceof ApiError ? "We could not load this list. Please try again." : error instanceof Error ? error.message : "Could not load this list.", isLoading: false });
        });
    };

    run();
    const unsubscribe = !forced && subscribe ? subscribe(run) : undefined;
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [load, subscribe, attempt]);

  // Called from a click handler, so showing the skeleton again is not an effect-time setState.
  const retry = useCallback(() => {
    setState({ rows: null, error: null, isLoading: true });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
