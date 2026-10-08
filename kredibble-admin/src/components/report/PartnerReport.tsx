"use client";

/**
 * PartnerReport: the report prepared for partners. AGGREGATE ONLY: no staff name, no person's figures, no ambassador name and no scoreboard anywhere in it.
 *
 *   Progress report · <month>   (orange-to-purple rule)
 *   Intro: what the report is and which month it is compared with
 *   Ten figures (5 by 2 on the paper, 2 across below 640px): label, value, change since the previous month, a one-line description
 *   Website audience: the last six months as highlight bars (the latest orange, a value on every bar, a hidden data table)
 *   Channel performance: Channel, Posts, Reach, Engagement (sorted by reach); hidden, with a neutral note, when the month has no post
 *
 * The figures come from lib/report.ts (the same functions as the Overview, the lists and Social). A month with no data shows the paper with zeros and a neutral note.
 *
 * Props: data (null while loading: a skeleton in the paper's shape), month, toDate (the current month: "Month to date")
 */
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { HighlightBarChart } from "@/components/ui/HighlightBarChart";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatMonth } from "@/lib/format";
import type { MonthKey } from "@/lib/mock-entities";
import { isEmptyMonth, previousMonthLabel, type Delta } from "@/lib/report";
import type { PartnerReportData } from "@/lib/services/report";
import { ReportPaper, ReportSection } from "./ReportPaper";

const format = (value: number) => value.toLocaleString("en-US");

/** The change since the previous month: an arrow AND words (colour is never the only signal). */
function DeltaText({ delta }: { delta: Delta }) {
  const Icon = delta.kind === "up" ? ArrowUp : delta.kind === "down" ? ArrowDown : delta.kind === "flat" ? Minus : null;
  return (
    <p data-testid="metric-delta" data-kind={delta.kind} className={cn("mt-1 flex items-start gap-1 text-xs font-semibold", delta.kind === "up" ? "text-success" : delta.kind === "down" ? "text-danger" : "text-muted")}>
      {Icon && <Icon size={12} strokeWidth={2.25} aria-hidden="true" className="mt-0.5 shrink-0" />}
      <span>{delta.text}</span>
    </p>
  );
}

export function PartnerReportSkeleton() {
  return (
    <div data-testid="report-skeleton" aria-busy="true" aria-label="Loading the report" className="report-paper space-y-6 p-4 min-[640px]:p-10">
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-1 w-full rounded-pill" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-control" />
        ))}
      </div>
      <Skeleton className="h-chart w-full rounded-control" />
    </div>
  );
}

export function PartnerReport({ data, month, toDate }: { data: PartnerReportData | null; month: MonthKey; toDate: boolean }) {
  if (!data) return <PartnerReportSkeleton />;
  const previous = previousMonthLabel(month);
  const empty = isEmptyMonth(data.metrics);
  return (
    <ReportPaper testId="partner-report" title="Progress report" month={month} toDate={toDate}>
      <p data-testid="report-intro" className="body-sm text-ink">
        A summary of the Desk&apos;s reach and growth this month, prepared for our partners.{" "}
        {toDate ? `Figures so far this month are compared with the same period last month (${previous}), estimated.` : `Figures are compared with ${previous}.`}
      </p>
      {empty && (
        <p data-testid="report-empty" className="caption rounded-control bg-surface-2 px-3 py-2">
          No figures were recorded for {formatMonth(month)}.
        </p>
      )}
      <ReportSection title="The month in ten figures" testId="report-metrics">
        <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-5">
          {data.metrics.map((metric) => (
            <div key={metric.id} data-testid={`metric-${metric.id}`} className="report-cell rounded-control bg-surface-2 p-3">
              <p className="caption font-semibold text-ink">{metric.label}</p>
              <p data-testid="metric-value" className="mt-1 font-display text-2xl font-bold leading-8 tabular-nums text-ink">
                {format(metric.value)}
              </p>
              <DeltaText delta={metric.delta} />
              <p className="caption mt-2">{metric.description}</p>
            </div>
          ))}
        </div>
      </ReportSection>
      <ReportSection title="Website audience" subtitle="Website views over the last six months" testId="report-audience">
        {data.audience.length >= 2 ? (
          <HighlightBarChart data={data.audience.map((point) => ({ label: point.label, tooltipLabel: point.tooltipLabel, value: point.value }))} ariaLabel={`Website views, last ${data.audience.length} months`} unit="views" />
        ) : (
          <p data-testid="audience-none" className="caption">
            There are not enough months of website figures to chart yet.
          </p>
        )}
      </ReportSection>
      {data.channels.length > 0 ? (
        <ReportSection title="Channel performance" subtitle="From the social posts published this month, the channel with the most reach first" testId="report-channels">
          <table data-testid="channel-table" className="w-full text-left">
            <caption className="sr-only">Posts, reach and engagement by channel</caption>
            <thead>
              <tr className="table-head">
                <th scope="col" className="py-2 pr-3">Channel</th>
                <th scope="col" className="px-3 py-2 text-right">Posts</th>
                <th scope="col" className="px-3 py-2 text-right">Reach</th>
                <th scope="col" className="py-2 pl-3 text-right">Engagement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.channels.map((row) => (
                <tr key={row.platform} data-testid="channel-row">
                  <td className="table-text py-2 pr-3 font-semibold">{row.label}</td>
                  <td className="table-text px-3 py-2 text-right tabular-nums">{format(row.posts)}</td>
                  <td className="table-text px-3 py-2 text-right tabular-nums">{format(row.reach)}</td>
                  <td className="table-text py-2 pl-3 text-right tabular-nums">{format(row.engagement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      ) : (
        <p data-testid="channels-none" className="caption">
          No posts were published in {formatMonth(month)}, so there is no channel table.
        </p>
      )}
    </ReportPaper>
  );
}
