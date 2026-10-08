"use client";

/**
 * TrendCard: the last six months of ONE KPI as highlight bars (the newest bar is orange, every bar carries its value, and a
 * visually hidden data table is the text alternative). A Select over the ten KPIs picks which one; the choice is kept while the page is open.
 *
 * Props:
 * - trend: the six-month series of every KPI, or null when unavailable (the card says so and offers no chart)
 * - loading: show the skeleton with the same size
 * - notConnected: real-API mode: "Not available yet" (not an error)
 */
import { useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import { KPI_KEYS, KPIS, type KpiKey } from "@/config/kpis";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { HighlightBarChart } from "@/components/ui/HighlightBarChart";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import type { TrendPoint } from "@/lib/services/dashboard-types";
import { NotAvailableYet } from "./NotAvailableYet";
import { UnavailableNote } from "./UnavailableNote";

const OPTIONS: SelectOption<KpiKey>[] = KPI_KEYS.map((key) => ({ value: key, label: KPIS[key].label }));

export function TrendCard({ trend, loading, notConnected = false, className }: { trend: Record<KpiKey, TrendPoint[]> | null; loading: boolean; notConnected?: boolean; className?: string }) {
  const [key, setKey] = useState<KpiKey>("opportunities_published");
  const points = trend?.[key];
  const data = useMemo(() => points?.map((point) => ({ label: point.label, tooltipLabel: point.tooltipLabel, value: point.value })), [points]);
  const definition = KPIS[key];

  return (
    <Card as="section" ariaLabel="Trend" testId="trend-card" className={className}>
      <CardHeader
        title="Trend"
        subtitle={`${definition.label}, the last six months`}
        action={
          loading || !trend ? undefined : <Select<KpiKey> className="w-56 max-w-full" ariaLabel="KPI shown in the trend" sheetTitle="Choose a KPI" options={OPTIONS} value={key} onChange={setKey} />
        }
      />
      {loading ? (
        <div aria-busy="true" aria-label="Loading the trend">
          <Skeleton className="h-chart w-full rounded-control" />
        </div>
      ) : notConnected ? (
        <NotAvailableYet icon={LineChart} />
      ) : !data ? (
        <UnavailableNote message="The trend could not be loaded." />
      ) : data.every((point) => point.value === 0) ? (
        <EmptyState icon={LineChart} title="Nothing counted yet" description={`No ${definition.unit} in these six months.`} />
      ) : (
        <HighlightBarChart data={data} ariaLabel={`${definition.label}, last six months`} unit={definition.unit} />
      )}
    </Card>
  );
}
