"use client";

/**
 * Mock store: ONE in-memory place for the changes an admin makes to mock records (account status,
 * document statuses, application statuses, capacity, removed channels and posts...).
 *
 * Why: the detail pages, the list pages, the sidebar pills, the breadcrumb pill and the Overview
 * counts must tell the same story. Suspend a seeker and the Seekers list shows Suspended; approve
 * the last pending document and the Verification Queue row becomes Approved while the pending count
 * drops by one everywhere.
 *
 * How it works
 * - The mock arrays (mock-seekers.ts and friends) stay untouched: they are the starting data.
 * - A change is saved here as a full replacement record, keyed by collection and id.
 * - Readers lay the saved records over the originals: overlayRows(collection, rows) for lists and
 *   counts, readOverride(...) for one record.
 * - Module scope only: a full page reload resets everything. Nothing goes to localStorage.
 * - Mock mode only: useDetailData writes here only when isMockMode() is true. In real-API mode this
 *   store is never written, so overlayRows returns the rows unchanged.
 * - useMockStoreVersion() re-renders a component whenever anything in the store changes.
 */
import { useSyncExternalStore } from "react";
import { PARTNER_STAGE_LABELS, type EntityCollections, type EntityName, type PartnerStage } from "@/lib/mock-entities";
import { buildSeed } from "@/lib/mock-seed";
import { isMockMode } from "@/lib/services/mock-mode";

export type MockCollection =
  | "seekers"
  | "hirers"
  | "verification"
  | "opportunities"
  | "reports"
  | "channels"
  | "events"
  | "grants";

const overrides = new Map<string, unknown>();
const listeners = new Set<() => void>();
let version = 0;

const keyOf = (collection: MockCollection, id: string) => `${collection}:${id}`;

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeMockStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getMockStoreVersion = () => version;

/** Re-renders the caller whenever the store changes. Returns a version number (the value itself is not needed). */
export function useMockStoreVersion(): number {
  return useSyncExternalStore(subscribeMockStore, getMockStoreVersion, () => 0);
}

/** The saved version of one record, or `base` when it was never changed. */
export function readOverride<T>(collection: MockCollection, id: string, base: T): T {
  const key = keyOf(collection, id);
  return overrides.has(key) ? (overrides.get(key) as T) : base;
}

/**
 * Applies `update` to the current version of a record (saved or original) and saves the result.
 * TODO(backend): every caller also carries a "persist this change" comment; this store is the stand-in.
 */
export function updateOverride<T>(collection: MockCollection, id: string, base: T, update: (previous: T) => T): T {
  const next = update(readOverride(collection, id, base));
  overrides.set(keyOf(collection, id), next);
  emit();
  return next;
}

/** A list of records with every saved change laid over it (same order, same length). */
export function overlayRows<T extends { id: string }>(collection: MockCollection, rows: readonly T[]): T[] {
  return rows.map((row) => readOverride(collection, row.id, row));
}

// ---------------------------------------------------------------------------------------------
// Entity collections (programs, partners, ambassadors, database records, social posts, testimonials, listings,
// listing metrics, amplification logs, monthly reports, website months, desk staff and the KPI targets) and the
// KPI thresholds. They start from the deterministic seed (mock-seed.ts), which components never import: they read
// the store (or a service in src/lib/services). Memory only (a reload resets them), written only in mock mode.
// ---------------------------------------------------------------------------------------------
const initial = buildSeed();
let collections: EntityCollections = initial.collections;

/** The current rows of one entity collection. */
export const getMockCollection = <K extends EntityName>(name: K): EntityCollections[K] => collections[name];

/**
 * Replaces a collection. Mock mode only: in real-API mode this does nothing, except for `{ always: true }`, which the
 * Team screens use (they were in-memory in every mode before the staff collection moved here).
 * TODO(backend): persist this change.
 */
export function setMockCollection<K extends EntityName>(name: K, rows: EntityCollections[K], options: { always?: boolean } = {}) {
  if (!options.always && !isMockMode()) return;
  collections = { ...collections, [name]: rows };
  emit();
}

/** The rows of a collection; re-renders the caller whenever the store changes. */
export function useMockCollection<K extends EntityName>(name: K): EntityCollections[K] {
  useMockStoreVersion();
  return collections[name];
}

/**
 * The labels of the six partner stages. The KEYS are fixed (prospect ... renew); only the words can change, and the
 * Settings screen will edit them. The Partners board reads them from here, never from PARTNER_STAGE_LABELS directly.
 */
let partnerStageLabels: Record<PartnerStage, string> = { ...PARTNER_STAGE_LABELS };

export const getPartnerStageLabels = (): Record<PartnerStage, string> => partnerStageLabels;

/** Replaces the stage labels (a blank label keeps the default). TODO(backend): persist this change. */
export function setPartnerStageLabels(next: Partial<Record<PartnerStage, string>>) {
  const merged = { ...PARTNER_STAGE_LABELS };
  for (const key of Object.keys(merged) as PartnerStage[]) if (next[key]?.trim()) merged[key] = next[key]!.trim();
  partnerStageLabels = merged;
  emit();
}

/** The stage labels; re-renders the caller whenever the store changes. */
export function usePartnerStageLabels(): Record<PartnerStage, string> {
  useMockStoreVersion();
  return partnerStageLabels;
}
