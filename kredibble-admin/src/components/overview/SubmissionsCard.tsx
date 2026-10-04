"use client";

/**
 * SubmissionsCard: "New submissions" with a 7/14/30-day control, a big total
 * with an inline change vs the previous period, and the 260px highlight bar chart
 * (latest or hovered/focused bar in orange, value labels up to 14 bars).
 *
 * Changing the range only slices the series already loaded by getOverview();
 * it never triggers a request. The series holds 60 days so each range also has
 * an equally long previous period to compare against.
 *
 * Props:
 * - series: daily points, oldest first (null = unavailable, shows "—")
 * - loading: show the skeleton with the same dimensions
 */
import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { SeriesPoint } from "@/lib/services/overview";
import { Card } from "@/components/ui/Card";
import { DeltaChip } from "@/components/ui/DeltaChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { HighlightBarChart } from "@/components/ui/HighlightBarChart";
import { UnavailableNote } from "./UnavailableNote";

type Range = "7" | "14" | "30";
const RANGE_OPTIONS = [
  { value: "7" as const, label: "7 days" },
  { value: "14" as const, label: "14 days" },
  { value: "30" as const, label: "30 days" },
];

const sum = (points: SeriesPoint[]) => points.reduce((total, p) => total + p.value, 0);

interface SubmissionsCardProps {
  series: SeriesPoint[] | null;
  loading: boolean;
  className?: string;
}

export function SubmissionsCard({ series, loading, className }: SubmissionsCardProps) {
  const [range, setRange] = useState<Range>("14");
  const days = Number(range);

  const { points, total, changePercent } = useMemo(() => {
    if (!series) return { points: [], total: 0, changePercent: null };
    const current = series.slice(-days);
    const previous = series.slice(-days * 2, -days);
    const previousTotal = sum(previous);
    return {
      points: current,
      total: sum(current),
      // No comparison when the previous period is empty or incomplete (avoids "+Infinity%").
      changePercent:
        previous.length === days && previousTotal > 0
          ? Math.round(((sum(current) - previousTotal) / previousTotal) * 100)
          : null,
    };
  }, [series, days]);

  return (
    <Card as="section" ariaLabel="New submissions" className={className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="card-title">New submissions</h2>
          <p className="text-sm text-muted">Verification requests and opportunities posted per day</p>
        </div>
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} ariaLabel="Chart date range" />
      </div>

      {/* Total row: fixed height so loading / loaded / unavailable all match. */}
      <div className="mb-4 flex h-10 items-center gap-3">
        {loading ? (
          <Skeleton className="h-9 w-40" />
        ) : !series ? (
          <p className="stat-value">
            <span role="img" aria-label="unavailable">
              —
            </span>
          </p>
        ) : (
          <>
            <p className="stat-value">{total.toLocaleString("en-US")}</p>
            {changePercent !== null && (
              <DeltaChip
                label={`${changePercent >= 0 ? "+" : ""}${changePercent}%`}
                direction={changePercent >= 0 ? "up" : "down"}
                goodDirection="up" // more submissions is the good direction
              >
                vs previous {days} days
              </DeltaChip>
            )}
          </>
        )}
      </div>

      <div className="h-chart">
        {loading ? (
          <Skeleton className="h-full w-full rounded-control" />
        ) : !series ? (
          <UnavailableNote />
        ) : total === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={BarChart3}
              title="No submissions in this period"
              description="New verification requests and postings will appear here."
            />
          </div>
        ) : (
          <HighlightBarChart
            data={points.map((p) => ({ label: p.label, tooltipLabel: formatDate(p.date), value: p.value }))} ariaLabel={`New submissions per day, last ${days} days`} unit="submissions" />
        )}
      </div>
    </Card>
  );
}
