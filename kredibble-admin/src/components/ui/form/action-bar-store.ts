"use client";

/**
 * Tracks the StickyActionBar currently on screen (at most one), so the Toast can sit 24px above
 * its top edge instead of covering it. StickyActionBar registers itself on mount and clears on unmount;
 * ToastProvider reads it.
 */
import { useSyncExternalStore } from "react";

let current: HTMLElement | null = null;
const listeners = new Set<() => void>();

export function registerActionBar(element: HTMLElement | null) {
  current = element;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The mounted action bar element, or null. */
export function useActionBar(): HTMLElement | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
