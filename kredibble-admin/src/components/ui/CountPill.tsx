/**
 * CountPill: a small number pill for counts next to a label (sidebar child
 * rows, breadcrumbs, tabs). Tabular numerals, Inter 600 12/16.
 *
 * Props:
 * - count: the number (or short text) to show
 * - onDark: translucent white pill for the dark sidebar
 * - label: optional screen-reader text, e.g. "pending" (read after the number)
 */
import { cn } from "@/lib/cn";

interface CountPillProps {
  count: number | string;
  onDark?: boolean;
  label?: string;
}

export function CountPill({ count, onDark = false, label }: CountPillProps) {
  return (
    <span
      className={cn(
        "badge-text inline-flex min-w-6 items-center justify-center rounded-pill px-2",
        onDark ? "bg-white/10 text-sb-text" : "bg-purple-50 text-purple-700",
      )}
    >
      {count}
      {label && <span className="sr-only"> {label}</span>}
    </span>
  );
}
