"use client";

/**
 * PipelineHealthCard: is the open pipeline big enough to hit next month's "Partners onboarded" target? (the maths is
 * pipelineHealth() in lib/pipeline-health.ts.) A compact card, so the board below it starts as high as possible:
 *
 *   Pipeline health                                                              [ Healthy ]
 *   13 open deals, 3 needed     Open 13   Needed 3          <- headline 20px/26px, the two figures inline beside it
 *                         needed
 *   [ critical ][ thin  ][            healthy              ]     <- a 12px three-zone bar, 0 to 2.0 times what is needed,
 *            ^ marker = where the pipeline is now      |            with a marker for now and a tick where "needed" is (1.0)
 *    Critical   Thin     Healthy
 *   Based on the last 6 months: 5 closed, 11 reached Outreach (close rate 45%). Next month's target: 1 partner onboarded.
 *
 * The last line is ONE line: it fits at 1440px, and where it does not it ends in an ellipsis and shows in full in the
 * tooltip (and a title).
 * Zones (the ratio of open deals to deals needed): critical below 0.6, thin from 0.6 to 1.0, healthy from 1.0 up; the
 * scale stops at 2.0. Each zone is a tinted status colour AND has its word under it, the chip says the status in words,
 * and the bar is a role="meter" whose text value reads "13 open deals, 3 needed, 4.3 times the target, healthy", so colour is never the only signal.
 * "Not enough data" (nothing reached Outreach yet) shows the zones without a marker.
 *
 * Props:
 * - health: the result of pipelineHealth(), or null while the partners load (a skeleton, never a 0)
 * - target: next month's target (shown in the last line)
 * - demo?: set only by the dev-only ?health= override (lib/pipeline-health-demo.ts): a muted line says the numbers are demo data
 */
import { Card } from "@/components/ui/Card";
import { ZoneGauge, type GaugeZone } from "@/components/ui/ZoneGauge";
import { useMediaQuery } from "@/lib/use-media-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TruncatedText } from "@/components/ui/TruncatedText";
import { HEALTHY_FROM, THIN_FROM, type PipelineHealth } from "@/lib/pipeline-health";
import { pluralize } from "@/lib/plural";

/** The scale: the bar covers 0 to 2.0 times the deals needed (zones: 0-0.6, 0.6-1.0, 1.0-2.0). */
const SCALE_MAX = 2;

/** The three zones: critical 0 to 0.6, thin 0.6 to 1.0, healthy 1.0 to 2.0 (30%, 20%, 50% of the bar). */
const ZONES: GaugeZone[] = [
  { key: "critical", label: "Critical", tone: "danger", percent: (THIN_FROM / SCALE_MAX) * 100, testId: "zone-critical" },
  { key: "thin", label: "Thin", tone: "warning", percent: ((HEALTHY_FROM - THIN_FROM) / SCALE_MAX) * 100, testId: "zone-thin" },
  { key: "healthy", label: "Healthy", tone: "success", percent: ((SCALE_MAX - HEALTHY_FROM) / SCALE_MAX) * 100, testId: "zone-healthy" },
];
/** The thresholds in words, from the same constants the status uses (lib/pipeline-health.ts). */
const HINT = `Critical: below ${THIN_FROM.toFixed(1)} of the deals needed. Thin: ${THIN_FROM.toFixed(1)} to ${HEALTHY_FROM.toFixed(1)}. Healthy: ${HEALTHY_FROM.toFixed(1)} and above.`;

const STATUS_WORD: Record<PipelineHealth["status"], string> = { healthy: "healthy", thin: "thin", critical: "critical", unknown: "not enough data" };

export function PipelineHealthCard({ health, target, demo }: { health: PipelineHealth | null; target: number; demo?: string }) {
  // Below 640px the footer sentence is allowed two lines (the same words as on desktop, never cut mid-word); the full text is in the tooltip.
  const phone = useMediaQuery("(max-width: 639px)");
  if (!health) {
    return (
      <Card as="section" ariaLabel="Pipeline health" padding="sm" className="space-y-1.5 py-2.5 xl:h-full">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-4 w-full" />
      </Card>
    );
  }

  const deals = (n: number) => pluralize(n, "open deal", "open deals");
  const headline = health.needed === null ? deals(health.openDeals) : `${deals(health.openDeals)}, ${health.needed} needed`;
  // Marker position along the bar (0 to 100). Without a ratio: at the start for "critical", none for "not enough data".
  const markerAt = health.ratio !== null ? (Math.min(health.ratio, SCALE_MAX) / SCALE_MAX) * 100 : health.status === "critical" ? 0 : null;
  // Past the end of the scale the marker is pinned to the right end and the card says by how much.
  const capped = health.ratio !== null && health.ratio > SCALE_MAX;
  const multiple = health.ratio !== null ? health.ratio.toFixed(1) : null;
  const rate = health.closeRate === null ? "—" : `${Math.round(health.closeRate * 100)}%`;
  const detail =
    health.status === "unknown"
      ? "No deal has reached Outreach in the last 6 months, so there is no close rate to learn from yet."
      : health.status === "critical" && health.needed === null
        ? `${pluralize(health.reachedOutreachInWindow, "deal")} reached Outreach in the last 6 months and none closed, so no number of open deals is enough yet.`
        : `Based on the last 6 months: ${health.closedInWindow} closed, ${health.reachedOutreachInWindow} reached Outreach (close rate ${rate}).`;
  const sentence = `${detail} Next month's target: ${pluralize(target, "partner")} onboarded.`;

  // The meter works in deals: 0 up to twice the deals needed (or the open deals, if there are even more), so aria-valuenow is always the real number.
  const meterMax = Math.max(health.needed !== null ? health.needed * SCALE_MAX : 0, health.openDeals, 1);
  const meterText =
    health.needed === null
      ? `${deals(health.openDeals)}, ${health.status === "unknown" ? "not enough data to work out how many are needed" : STATUS_WORD[health.status]}`
      : `${deals(health.openDeals)}, ${health.needed} needed, ${multiple ? `${multiple} times the target, ` : ""}${STATUS_WORD[health.status]}`;

  return (
    <Card as="section" ariaLabel="Pipeline health" padding="sm" className="space-y-1.5 py-2.5 xl:h-full">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold leading-5 text-ink">Pipeline health</h2>
        <span data-testid="pipeline-status">
          <StatusBadge status={health.status} />
        </span>
      </div>

      <p data-testid="pipeline-headline" className="font-display text-xl font-extrabold leading-6.5 text-ink">
        {headline}
      </p>

      <ZoneGauge
        zones={ZONES}
        meter={{ label: "Open deals against deals needed", min: 0, max: meterMax, now: health.openDeals, text: meterText }}
        markerAt={markerAt}
        markerLabel={`${health.openDeals} open`}
        capped={capped ? { text: `${multiple}× the target` } : undefined}
        hint={HINT}
        tickAt={health.needed !== null ? 50 : null}
        tickLabel={health.needed !== null ? `${health.needed} needed` : undefined}
        testIds={{
          gauge: "pipeline-gauge",
          marker: "pipeline-marker",
          markerLabel: "pipeline-marker-label",
          tick: "pipeline-needed-tick",
          tickLabel: "pipeline-needed-label",
          labels: "pipeline-zone-labels",
          capped: "pipeline-capped",
          arrow: "pipeline-arrow",
        }}
      />

      <div data-testid="pipeline-detail">
        <TruncatedText text={sentence} lines={phone ? 2 : 1} className="caption" />
      </div>
      {demo && (
        <p data-testid="pipeline-demo" className="caption text-muted">
          Demo numbers for review (?health={demo}). Remove it from the address to see the real pipeline.
        </p>
      )}
    </Card>
  );
}
