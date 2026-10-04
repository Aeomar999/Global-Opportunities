"use client";

import { useCallback, useEffect, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

/**
 * Runs an async loader on mount and exposes loading / error / data plus a
 * `reload` for "Try again" buttons.
 *
 * `load` must be a stable reference (a module-level function, or wrapped in
 * useCallback), otherwise it would refetch on every render.
 * Stale responses are ignored if the component unmounts or reloads first.
 */
export function useAsync<T>(load: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, isLoading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ data, error: null, isLoading: false }))
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          data: null,
          error: error instanceof Error ? error : new Error("Something went wrong"),
          isLoading: false,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  // Called from a click handler, so showing the skeleton again is not an effect-time setState.
  const reload = useCallback(() => {
    setState({ data: null, error: null, isLoading: true });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
