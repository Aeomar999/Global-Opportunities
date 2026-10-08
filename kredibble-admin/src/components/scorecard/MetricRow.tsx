/**
 * MetricRow: one owned metric on the scorecard: the label, the value, "of <target>" (with the pro-rated target this month), the
 * attainment as a percentage (NOT capped: it can pass 100%), a bar with a thin tick at the month's pace, and a status chip.
 *
 * The percentage is the value against the target the month has earned so far (the full target in a past month, and for a running total such
 * as Active ambassadors): the same number the Overview's Priorities panel ranks by. Above 300% it reads "300%+" (exact figure in a Tooltip). The bar shows the progress to the FULL target, like the Overview card, with the tick where the
 * pace is.
 *
 * Props:
 * - row: the MetricResult from lib/scorecard.ts
 */
import { StatusChip, TargetBar } from "@/components/overview/KpiGrid";
import { TruncatedText } from "@/components/ui/TruncatedText";
import { AttainmentFigure } from "./AttainmentFigure";
import { kpiUnit } from "@/lib/plural";
import type { MetricResult } from "@/lib/scorecard";

const format = (value: number) => value.toLocaleString("en-US");
/** A pro-rated target is rarely whole: one decimal below 10 ("0.5"), so a small target never reads as 0. */
const formatPro = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: value < 10 ? 1 : 0 });

export function MetricRow({ row }: { row: MetricResult }) {
  // The shared bar reads value / full target and the pace; the percentage printed beside it is the pro-rated one.
  const bar = { key: row.key, value: row.value, target: row.target, status: row.status, pace: row.pace, prorated: row.prorated, attainment: row.target > 0 ? row.value / row.target : null };
  return (
    <li data-testid="metric-row" data-kpi={row.key} className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-40">
          <TruncatedText text={row.label} className="table-text font-semibold text-ink" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AttainmentFigure value={row.attainment} testId="metric-attainment" className="font-display text-base font-bold tabular-nums text-ink" />
          <StatusChip status={row.status} />
        </div>
      </div>
      <p className="body-sm mt-1 text-ink">
        <span data-testid="metric-value" className="font-bold tabular-nums">
          {format(row.value)}
        </span>{" "}
        <span data-testid="metric-of" className="text-muted">
          {row.target > 0
            ? `of ${format(row.target)} ${kpiUnit(row.key, row.target)}${row.isPast || !row.prorated ? "" : ` · pro-rated to ${formatPro(row.proratedTarget)} by today`}`
            : `No target for ${row.unit}`}
        </span>
      </p>
      <div className="mt-2">
        <TargetBar card={bar} label={row.label} showPace={!row.isPast && row.prorated} />
      </div>
    </li>
  );
}
