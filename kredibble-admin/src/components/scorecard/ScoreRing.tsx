/**
 * ScoreRing: the composite score as a ring (a track, a status-coloured arc and the number in the middle). A role="meter" from 0 to 100,
 * so a screen reader hears "72 out of 100, Behind". Colour is never the only signal: the status word is in the meter's text and the
 * page puts a status chip beside the ring.
 *
 * Structure (an SVG track, a range arc and a centred value) follows the 21st.dev "Circular Progress" candidates; the look is the brand's:
 * status tokens for the arc, the track token for the rest, Jakarta numerals.
 *
 * Props:
 * - score: the composite, a whole number from 0 to 100; null in the first days of the month: the ring shows a dash (no arc, never a 0) and
 *   the meter says "Too early in the month to score"
 * - status: "green" | "amber" | "red": the arc's colour and the word in the meter text
 * - className: size classes; the default is 96px on a phone and 112px from 640px
 */
import { TOO_EARLY_MESSAGE } from "@/config/scorecard";
import { cn } from "@/lib/cn";
import type { KpiStatus } from "@/lib/kpi";
import { KPI_STATUS_LABELS } from "@/lib/status-map";

const ARC: Record<KpiStatus, string> = { green: "stroke-success-dot", amber: "stroke-warning-dot", red: "stroke-danger-dot" };

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreRing({ score, status, className }: { score: number | null; status: KpiStatus | null; className?: string }) {
  const filled = score === null ? 0 : Math.min(100, Math.max(0, score));
  const word = status ? KPI_STATUS_LABELS[status] : "";
  return (
    <div
      role="meter"
      aria-label="Composite score"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score ?? undefined}
      aria-valuetext={score === null ? TOO_EARLY_MESSAGE : `${score} out of 100${word ? `, ${word}` : ""}`}
      data-testid="score-ring"
      className={cn("relative size-24 shrink-0 sm:size-28", className)}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="9" className="stroke-track" />
        {score !== null && (
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - filled / 100)}
          className={status ? ARC[status] : "stroke-neutral-dot"}
        />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span data-testid="score-value" className="font-display text-3xl font-bold leading-8 tabular-nums text-ink">
          {score === null ? "—" : score}
        </span>
        <span className="caption">{score === null ? "no score yet" : "out of 100"}</span>
      </div>
    </div>
  );
}
