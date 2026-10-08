"use client";

/**
 * useDetailData: the one hook every detail page uses to load its record.
 *
 * Returns { status, record, setRecord, error, retry }:
 * - status: "loading" | "ready" | "notfound" | "error"
 * - record: the loaded record (only when status is "ready")
 * - setRecord(update): changes the record in LOCAL state (approve, suspend, ... all work this way
 *   today; each handler carries a TODO(backend) comment)
 * - error: a plain message string. Errors stay in component state; nothing calls console.error.
 *
 * Params:
 * - load: resolves to the record, or undefined when it does not exist. Must be a stable reference
 *   (a module-level function or useCallback).
 * - options.subscribe: optional live subscription (for the in-memory staff store); whenever it fires
 *   the record is read again.
 *
 * Dev-only state switch (mock mode, never production): ?state=loading | notfound | error forces that
 * state so the skeleton, not-found and error layouts can be reviewed. "loading" never finishes.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { readOverride, updateOverride, useMockStoreVersion, type MockCollection } from "@/lib/mock-store";
import { ApiError } from "@/lib/api";
import { isMockMode } from "@/lib/services/mock-mode";

export type DetailStatus = "loading" | "ready" | "notfound" | "error";
const FORCED = ["loading", "notfound", "error"] as const;
type DetailForced = (typeof FORCED)[number];

function readForcedState(): DetailForced | null {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production" || !isMockMode()) return null;
  const value = new URLSearchParams(window.location.search).get("state");
  return FORCED.find((state) => state === value) ?? null;
}

interface DetailState<T> {
  status: DetailStatus;
  record: T | null;
  error: string | null;
}

interface Options {
  subscribe?: (notify: () => void) => () => void;
  /**
   * Mock mode only: keep changes in the shared mock store (see mock-store.ts) so lists, counts and
   * other pages show them too. In real-API mode, or without this option, changes stay in local state.
   */
  collection?: MockCollection;
}

const idOf = (record: unknown) => (record as { id?: string }).id ?? "";

export function useDetailData<T>(load: () => Promise<T | undefined>, options: Options = {}) {
  const { subscribe, collection } = options;
  const storeVersion = useMockStoreVersion();
  const [state, setState] = useState<DetailState<T>>({ status: "loading", record: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const forced = readForcedState();
    if (forced === "loading") return; // never resolves: the skeleton stays

    const run = () => {
      const request =
        forced === "error"
          ? Promise.reject(new Error("Could not load this record. (forced: ?state=error)"))
          : forced === "notfound"
            ? Promise.resolve(undefined)
            : load();
      request
        .then((record) => {
          if (cancelled) return;
          setState(record === undefined ? { status: "notfound", record: null, error: null } : { status: "ready", record, error: null });
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          // An id the server cannot read (a malformed id) or does not know is a record that is not there: the calm not-found state, never the server's own words
          // (a database "Cast to ObjectId failed..." must not reach the screen). Any other failure shows a plain sentence (the forced dev error keeps its own).
          if (error instanceof ApiError && (error.status === 400 || error.status === 404)) {
            setState({ status: "notfound", record: null, error: null });
            return;
          }
          const message = error instanceof ApiError ? "We could not load this record. Please try again." : error instanceof Error && isMockMode() ? error.message : "We could not load this record. Please try again.";
          setState({ status: "error", record: null, error: message });
        });
    };

    run();
    const unsubscribe = !forced && subscribe ? subscribe(run) : undefined;
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [load, subscribe, attempt]);

  const loaded = state.record;
  const useStore = !!collection && isMockMode();

  // With the store, the record shown is the loaded one with any saved change laid over it.
  const record = useMemo(
    () => (loaded && collection && useStore ? readOverride(collection, idOf(loaded), loaded) : loaded),
    // storeVersion: read again after every store change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, collection, useStore, storeVersion],
  );

  /** Update the loaded record. TODO(backend): callers persist the change. */
  const setRecord = useCallback(
    (update: (previous: T) => T) => {
      if (!loaded) return;
      if (collection && useStore) {
        updateOverride(collection, idOf(loaded), loaded, update);
        return;
      }
      setState((current) => (current.record ? { ...current, record: update(current.record) } : current));
    },
    [loaded, collection, useStore],
  );

  const retry = useCallback(() => {
    setState({ status: "loading", record: null, error: null });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, record, setRecord, retry };
}
