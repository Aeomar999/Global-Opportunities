"use client";

/**
 * SegmentedBar: the Insights chart for "parts of a whole", per the design brief.
 *
 *   ┌ inset box (surface-2) ─────────────────────────────┐
 *   │ Total postings                                      │
 *   │ 8                                                   │
 *   │ [████████ ███ ██ █]   one 12px bar, split           │
 *   │ ● Jobs        3   38%                               │
 *   │ ● Internships 2   25%     <- legend: dot, label, value, percent
 *   └─────────────────────────────────────────────────────┘
 *
 * Segment styles (the brief's order): purple-500, orange-500, purple-400, then orange-100 with an orange
 * border. A fifth or later segment repeats the sequence, and the legend dot always matches its segment.
 * The legend carries every number, so colour is never the only signal.
 *
 * Accessibility: the bar is a decorative image (aria-hidden); the legend list and a visually hidden
 * <table> are the text alternative. An empty total shows an empty state instead of a bar.
 *
 * Props:
 * - segments: [{ label, value }] (values are counts; zero-value segments stay in the legend but get no width)
 * - totalLabel: what the total counts ("Total postings")
 * - ariaLabel: names the chart for the hidden table ("Postings by type")
 * - emptyTitle: shown when the total is 0
 */
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "./EmptyState";

export interface Segment {
  label: string;
  value: number;
}

// The brief's four styles. Applied to both the bar segment and the legend dot.
const STYLES = ["bg-purple-500", "bg-orange-500", "bg-purple-400", "bg-orange-100 border border-orange-500"] as const;

interface SegmentedBarProps {
  segments: Segment[];
  totalLabel: string;
  ariaLabel: string;
  emptyTitle?: string;
}

export function SegmentedBar({ segments, totalLabel, ariaLabel, emptyTitle = "Nothing to show yet" }: SegmentedBarProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const percentOf = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

  if (total === 0) {
    return <EmptyState icon={BarChart3} title={emptyTitle} description="Data appears here once there is something to count." />;
  }

  return (
    <figure className="rounded-inset bg-surface-2 p-4" aria-label={ariaLabel}>
      <figcaption className="caption">{totalLabel}</figcaption>
      <p className="stat-value mt-0.5">{total.toLocaleString("en-US")}</p>

      {/* The bar is decorative: the legend below and the hidden table carry the same numbers. */}
      <div aria-hidden="true" className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-pill">
        {segments.map((segment, index) =>
          segment.value > 0 ? (
            // Width is data-driven, so it is the one legitimate inline style here.
            <div key={segment.label} className={cn("h-full rounded-pill", STYLES[index % STYLES.length])} style={{ width: `${(segment.value / total) * 100}%` }} />
          ) : null,
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {segments.map((segment, index) => (
          <li key={segment.label} className="body-sm flex items-center gap-2">
            <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-pill", STYLES[index % STYLES.length])} />
            <span className="min-w-0 flex-1 truncate text-ink">{segment.label}</span>
            <span className="font-semibold tabular-nums text-ink">{segment.value}</span>
            <span className="w-10 text-right tabular-nums text-muted">{percentOf(segment.value)}%</span>
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Count</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((segment) => (
            <tr key={segment.label}>
              <th scope="row">{segment.label}</th>
              <td>{segment.value}</td>
              <td>{percentOf(segment.value)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
