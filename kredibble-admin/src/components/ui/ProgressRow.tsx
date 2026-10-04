/**
 * ProgressRow: label and bold percent on one line, a 6px bar on a soft track,
 * then a 12/16 muted caption.
 *
 * Props:
 * - label: what is measured
 * - percent: 0-100, or null when unknown / the queue is empty (shows "—")
 * - caption: small muted line under the bar ("94 of 120 requests decided")
 * - tone: bar colour (accent = purple-500, default | brand = orange |
 *   accent-light = purple-400 | success | warning | danger)
 * Exposes role="progressbar" with aria-valuenow (omitted when percent is null).
 */
import { cn } from "@/lib/cn";

const BAR_CLASSES = {
  accent: "bg-purple-500",
  brand: "bg-orange-500",
  "accent-light": "bg-purple-400",
  success: "bg-success-dot",
  warning: "bg-warning-dot",
  danger: "bg-danger-dot",
} as const;

interface ProgressRowProps {
  label: string;
  percent: number | null;
  caption?: string;
  tone?: keyof typeof BAR_CLASSES;
}

export function ProgressRow({ label, percent, caption, tone = "accent" }: ProgressRowProps) {
  const clamped = percent === null ? 0 : Math.min(100, Math.max(0, percent));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 body-sm">
        <span className="font-medium text-ink">{label}</span>
        {percent === null ? (
          <span role="img" aria-label="unavailable" className="font-bold text-muted">
            —
          </span>
        ) : (
          <span className="font-bold tabular-nums text-ink">{clamped}%</span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent === null ? undefined : clamped}
        className="h-1.5 overflow-hidden rounded-pill bg-track"
      >
        {/* Width is data-driven, so it is the one legitimate inline style here. */}
        <div className={cn("h-full rounded-pill", BAR_CLASSES[tone])} style={{ width: `${clamped}%` }} />
      </div>
      {caption && <p className="caption mt-2">{caption}</p>}
    </div>
  );
}
