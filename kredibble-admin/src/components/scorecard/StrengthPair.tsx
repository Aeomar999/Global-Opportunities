/**
 * StrengthPair: the two highlighted results, "Strongest: <metric> 118%" and "Weakest: <metric> 40%". With exactly one metric it is a single
 * "Focus" card. The percentages are the uncapped attainment (value against the pro-rated target in the current month).
 *
 * Props:
 * - highlight: from lib/scorecard.ts (strengths / highlightOf)
 */
import { Crosshair, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { TruncatedText } from "@/components/ui/TruncatedText";
import { AttainmentFigure } from "./AttainmentFigure";
import { highlightLabels, type Highlight, type MetricResult } from "@/lib/scorecard";

function Tile({ testId, icon: Icon, caption, row }: { testId: string; icon: LucideIcon; caption: string; row: MetricResult }) {
  return (
    <div data-testid={testId} data-kpi={row.key} className="flex min-w-0 items-center gap-3 rounded-control bg-surface-2 px-4 py-3">
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="caption">{caption}</p>
        <TruncatedText text={row.label} className="table-text font-semibold text-ink" />
      </div>
      <AttainmentFigure value={row.attainment} testId={`${testId}-percent`} className="font-display text-xl font-bold tabular-nums text-ink" />
    </div>
  );
}

export function StrengthPair({ highlight }: { highlight: Highlight }) {
  if (highlight.kind === "focus") {
    return (
      <div className="grid gap-3">
        <Tile testId="focus" icon={Crosshair} caption="Focus" row={highlight.focus} />
      </div>
    );
  }
  const labels = highlightLabels(highlight); // "Highest" and "Lowest" when every owned metric is at or above target
  return (
    <div className="grid gap-3 min-[640px]:grid-cols-2">
      <Tile testId="strongest" icon={TrendingUp} caption={labels.high} row={highlight.strongest} />
      <Tile testId="weakest" icon={TrendingDown} caption={labels.low} row={highlight.weakest} />
    </div>
  );
}
