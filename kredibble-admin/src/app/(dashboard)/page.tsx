"use client";

/**
 * Overview (route "/").
 *
 * The page calls getOverview() ONCE on mount (the service dedupes the
 * in-flight request, so React Strict Mode does not double-fetch) and passes
 * slices of the result to each section. There are no automatic retries; the
 * banner's "Try again" re-runs getOverview().
 *
 * Failure handling: a slim banner explains what went wrong, and only the
 * affected sections show "—". Every section keeps its final dimensions while
 * loading, loaded and unavailable, so the layout never jumps.
 */
import { BRAND } from "@/config/brand";
import { getOverview, type OverviewIssue } from "@/lib/services/overview";
import { useAsync } from "@/lib/use-async";
import { PageFooter } from "@/components/ui/PageFooter";
import { ActivityCard } from "@/components/overview/ActivityCard";
import { AttentionCard } from "@/components/overview/AttentionCard";
import { KpiRow } from "@/components/overview/KpiRow";
import { LatestOpportunities } from "@/components/overview/LatestOpportunities";
import { OverviewHeader } from "@/components/overview/OverviewHeader";
import { QueuesCard } from "@/components/overview/QueuesCard";
import { StatusBanner } from "@/components/overview/StatusBanner";
import { SubmissionsCard } from "@/components/overview/SubmissionsCard";

export default function DashboardHomePage() {
  const overview = useAsync(getOverview);
  const loading = overview.isLoading;
  const data = overview.data?.data ?? null; // null while loading, or if getOverview itself failed unexpectedly

  // getOverview() resolves with an `issue` for expected failures; a thrown error is the unexpected case.
  const issue: OverviewIssue | null =
    overview.data?.issue ?? (overview.error ? { kind: "failed", message: overview.error.message } : null);

  return (
    <div className="space-y-8">
      <OverviewHeader />

      {/* 16px between every block */}
      <div className="space-y-4">
        {issue && !loading && <StatusBanner issue={issue} onRetry={overview.reload} />}

        <KpiRow data={data?.kpis ?? null} loading={loading} />

        {/* Row 3 (2fr / 1fr): items-stretch makes both cards as tall as the taller one. */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          <SubmissionsCard series={data?.submissions ?? null} loading={loading} className="lg:col-span-2" />
          <QueuesCard data={data?.queues ?? null} note={data?.queuesNote ?? null} loading={loading} />
        </div>

        {/* Row 4 (2fr / 1fr): same stretch; the attention card pins its button to the bottom. */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          <LatestOpportunities data={data?.latestOpportunities ?? null} loading={loading} className="lg:col-span-2" />
          <AttentionCard
            pendingVerifications={data ? data.kpis.pendingVerifications.value : null}
            openReports={data ? data.kpis.openReports.value : null}
            loading={loading}
          />
        </div>

        {/* Row 5: full width, two timeline columns from 1024px. */}
        <ActivityCard data={data?.activity ?? null} loading={loading} />
      </div>

      <PageFooter crumbs={[BRAND.sub, "Overview"]} />
    </div>
  );
}
