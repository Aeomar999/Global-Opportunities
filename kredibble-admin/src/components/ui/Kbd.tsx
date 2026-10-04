/**
 * Kbd: a small keyboard-key chip, e.g. "⌘ K" in the sidebar search field.
 *
 * Props:
 * - children: the key text ("⌘ K", "Ctrl B", "Esc")
 * - onDark: translucent style for dark surfaces (sb-muted on it is 7.7:1)
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Kbd({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <kbd
      className={cn(
        "badge-text inline-flex h-6 items-center rounded-inset border px-2 font-sans",
        onDark ? "border-white/10 bg-white/10 text-sb-muted" : "border-line bg-surface-2 text-muted",
      )}
    >
      {children}
    </kbd>
  );
}
