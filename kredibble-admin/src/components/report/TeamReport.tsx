"use client";

/**
 * TeamReport: the INTERNAL report ("Internal. Not for partners."), on the same paper as the partner report.
 *
 *   Key figures: the ten KPIs with their target, value and status (the Overview's cards; Active ambassadors is a running total, judged against the full target)
 *   Partner pipeline: the pipeline health gauge of Partners
 *   Database: the verification pace gauge and the records verified in the month by source (the Database page's card)
 *   Network: size, active ambassadors and the activity rate; the top five ambassadors of the month's leaderboard
 *   Social: posts, reach and engagement against their targets, by platform
 *   Team scoreboard: EXACTLY the Team scorecard for the month (the same component, not recalculated): the grace period ("Scores start on day 5"),
 *   "300%+", "Highest/Lowest" when everyone owns only on-target metrics, and people with no metrics under "No metrics assigned"
 *
 * Props: data (null while loading: a skeleton), month, toDate (the current month: "Month to date")
 */
import { PipelineHealthCard } from "@/components/partners/PipelineHealthCard";
import { RecordsPaceCard } from "@/components/database/RecordsPaceCard";
import { StatusChip } from "@/components/overview/KpiGrid";
import { Scorecard } from "@/components/scorecard/Scorecard";
import { MiniStat } from "@/components/ui/MiniStat";
import { KPIS } from "@/config/kpis";
import { formatMonth } from "@/lib/format";
import { isPastMonth } from "@/lib/kpi";
import type { MonthKey } from "@/lib/mock-entities";
import { pluralize } from "@/lib/plural";
import type { TeamReportData } from "@/lib/report";
import { PartnerReportSkeleton } from "./PartnerReport";
import { ReportPaper, ReportSection } from "./ReportPaper";

const format = (value: number) => value.toLocaleString("en-US");

export function TeamReport({ data, month, toDate }: { data: TeamReportData | null; month: MonthKey; toDate: boolean }) {
  if (!data) return <PartnerReportSkeleton />;
  const rate = data.network.activityRate;
  return (
    <ReportPaper testId="team-report" title="Team report" month={month} toDate={toDate} note="Internal. Not for partners.">
      {data.kpis.every((card) => card.value === 0) && (
        <p data-testid="report-empty" className="caption rounded-control bg-surface-2 px-3 py-2">
          No figures were recorded for {formatMonth(month)}.
        </p>
      )}
      <ReportSection title="Key figures" subtitle="The ten KPIs against their monthly targets" testId="team-kpis">
        <table data-testid="kpi-table" className="w-full text-left">
          <caption className="sr-only">The ten KPIs with target, value and status</caption>
          <thead>
            <tr className="table-head">
              <th scope="col" className="py-2 pr-3">KPI</th>
              <th scope="col" className="px-3 py-2 text-right">Value</th>
              <th scope="col" className="px-3 py-2 text-right">Target</th>
              <th scope="col" className="py-2 pl-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.kpis.map((card) => (
              <tr key={card.key} data-testid={`team-kpi-${card.key}`}>
                <td className="table-text py-2 pr-3 font-semibold print:py-1">{KPIS[card.key].label}</td>
                <td data-testid="team-kpi-value" className="table-text px-3 py-2 text-right tabular-nums print:py-1">{card.value === null ? "—" : format(card.value)}</td>
                <td className="table-text px-3 py-2 text-right tabular-nums print:py-1">{card.target ? format(card.target) : "—"}</td>
                <td className="py-2 pl-3 print:py-1">
                  <StatusChip status={card.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>
      {/* Side by side in print (two cards that each need half the width), one under the other on screen. */}
      <div className="space-y-8 print:grid print:grid-cols-2 print:items-start print:gap-4 print:space-y-0">
      <ReportSection title="Partner pipeline" subtitle="Is the open pipeline big enough for the Partners onboarded target?" testId="team-pipeline">
        <PipelineHealthCard health={data.pipeline} target={data.pipelineTarget} />
      </ReportSection>
      <ReportSection title="Database" subtitle="Verification pace this month and the records verified by source" testId="team-database">
        <RecordsPaceCard pace={data.pace} sources={data.sources} />
      </ReportSection>
      </div>
      <ReportSection title="Network" subtitle="Ambassadors and who is leading this month" testId="team-network">
        <div className="grid gap-2 min-[640px]:grid-cols-3">
          <MiniStat compact value={data.network.size} label="Network size" caption="All statuses" />
          <MiniStat compact value={data.network.active} label="Active ambassadors" />
          <MiniStat compact value={rate === null ? "—" : `${Math.round(rate * 100)}%`} label="Activity rate" caption="Active ambassadors who shared this month" />
        </div>
        <ol data-testid="top-five" className="mt-4 divide-y divide-line">
          {data.top.map((row) => (
            <li key={row.ambassador.id} data-testid="top-row" className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 print:py-1">
              <span className="table-text font-semibold text-ink">
                {row.rank}. {row.ambassador.name}
              </span>
              <span className="caption tabular-nums">
                {pluralize(row.signups, "verified signup")} · {pluralize(row.clicks, "referred click")} · {pluralize(row.shares, "share")}
              </span>
            </li>
          ))}
        </ol>
      </ReportSection>
      <ReportSection title="Social" subtitle={`Posts published in ${formatMonth(month)}`} testId="team-social">
        <div className="grid gap-2 min-[640px]:grid-cols-3">
          <MiniStat compact value={data.social.posts} label="Posts" caption={`Target ${format(data.social.targets.posts)}`} />
          <MiniStat compact value={data.social.reach} label="Reach" caption={`Target ${format(data.social.targets.reach)}`} />
          <MiniStat compact value={data.social.engagement} label="Engagement" caption={`Target ${format(data.social.targets.engagement)}`} />
        </div>
      </ReportSection>
      <ReportSection title="Team scoreboard" subtitle="As on the Team scorecard for this month" testId="team-scoreboard">
        <Scorecard scope="team" month={month} people={data.people} tooEarly={data.tooEarly} isPast={isPastMonth(month)} />
      </ReportSection>
    </ReportPaper>
  );
}
