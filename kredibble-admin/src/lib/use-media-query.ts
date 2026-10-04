"use client";

import { useSyncExternalStore } from "react";

/**
 * True while `query` matches (e.g. "(min-width: 1024px)").
 * Subscribes to the browser's media query, so it updates on resize. During
 * server rendering it reports false (the dashboard shell only renders its
 * children after mounting, so nothing flashes).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * The label for the "command" key on this device: "⌘" on Apple devices,
 * "Ctrl" elsewhere. Used in shortcut hints such as "⌘ K".
 */
export function useModifierLabel(): string {
  return useSyncExternalStore(
    () => () => {},
    () => (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}
