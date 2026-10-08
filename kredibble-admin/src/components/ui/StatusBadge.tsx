/**
 * StatusBadge: pill with a coloured dot AND text (status is never shown by
 * colour alone). Tinted background, 12/16 600 text.
 * The tone and label come from `src/lib/status-map.ts`, the single mapping
 * file, so a status looks the same everywhere.
 *
 * Props:
 * - status: raw status string, e.g. "pending", "approved", "suspended"
 * - label: optional override for the displayed text
 * - tone: optional override for the tone (success | warning | danger | neutral | info)
 * - kind: "report" for the one word whose tone depends on context ("Open" report = warning)
 * - icon: optional lucide icon shown INSTEAD of the dot (e.g. a flag for flagged channels)
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { getStatusMeta, type StatusKind, type StatusTone } from "@/lib/status-map";

const TONE_CLASSES: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: "bg-success-soft text-success", dot: "bg-success-dot" },
  warning: { pill: "bg-warning-soft text-warning", dot: "bg-warning-dot" },
  danger: { pill: "bg-danger-soft text-danger", dot: "bg-danger-dot" },
  neutral: { pill: "bg-neutral-soft text-neutral", dot: "bg-neutral-dot" },
  // In progress: purple-50 background, purple-700 text (9.7:1), purple dot. Dot plus text, never colour alone.
  info: { pill: "bg-purple-50 text-purple-700", dot: "bg-purple-600" },
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  tone?: StatusTone;
  kind?: StatusKind;
  icon?: LucideIcon;
  className?: string;
}

export function StatusBadge({ status, label, tone, kind, icon: Icon, className }: StatusBadgeProps) {
  const meta = getStatusMeta(status, kind);
  const styles = TONE_CLASSES[tone ?? meta.tone];

  return (
    <span data-testid="status-badge" className={cn("badge-text inline-flex w-fit items-center gap-2 rounded-pill px-3 py-1", styles.pill, className)}>
      {Icon ? (
        <Icon size={12} strokeWidth={2} aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className={cn("size-2 rounded-full", styles.dot)} />
      )}
      {label ?? meta.label}
    </span>
  );
}
