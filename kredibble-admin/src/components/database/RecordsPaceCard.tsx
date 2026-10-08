"use client";

/**
 * RecordsPaceCard: the card at the top of Database. Two halves side by side from 1024px, stacked below:
 *
 *   Verified this month                          [ Behind ]      Records by source
 *   9 of 15 verified    Pace 11  Target 15                       [██████ ███ ██ █ ██]   a mini segmented bar
 *     pace 11          <- tick label                             ● Organic 25  ● Ambassador referral 24 ...
 *   9 verified > [ far behind ][ behind ][   on pace   ]
 *    Far behind   Behind   On pace
 *
 * The numbers and the status are NOT worked out here: they come from recordsPace() (services/database.ts), which uses
 * kpiValue, kpiTarget and kpiStatus, the same functions as the Overview. The gauge is the shared ZoneGauge: a role="meter"
 * whose text value reads "9 of 15 verified, pro-rated pace 11, behind", a marker for the verified count and a tick where the
 * pro-rated pace is. The status is a badge in words as well as colour. The bar of sources is decorative; its legend carries
 * every number and percentage.
 *
 * Props:
 * - pace: the result of recordsPace(), or null while the records load (a skeleton, never a 0)
 * - sources: the counts by source (all records, whatever the list's filters say), or null while loading
 * - error / onRetry: when the records could not be loaded
 * Test ids: records-pace, pace-status, pace-headline, pace-gauge, pace-marker, pace-marker-label, pace-tick, pace-tick-label,
 * pace-zone-labels, pace-capped and pace-arrow ("4.4× the pace" and an arrow when more is verified than the bar can show), source-bar, source-legend, source-legend-<source>.
 */
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ZoneGauge, type GaugeZone } from "@/components/ui/ZoneGauge";
import { cn } from "@/lib/cn";
import { RECORD_SOURCES, RECORD_SOURCE_LABELS } from "@/lib/mock-entities";
import { type PaceStatus, type RecordsPace, type SourceCount } from "@/lib/services/database";

const ZONE_TONE: Record<PaceStatus, GaugeZone["tone"]> = { far_behind: "danger", behind: "warning", on_pace: "success" };
const ZONE_LABEL: Record<PaceStatus, string> = { far_behind: "Far behind", behind: "Behind", on_pace: "On pace" };

/** One style for each source: the bar segment and its legend dot always match. */
const SOURCE_STYLES: Record<(typeof RECORD_SOURCES)[number], string> = {
  organic: "bg-purple-500",
  ambassador: "bg-orange-500",
  event: "bg-purple-300",
  partner: "bg-orange-100 border border-orange-500",
  import: "bg-neutral-400",
};

interface RecordsPaceCardProps {
  pace: RecordsPace | null;
  sources: SourceCount[] | null;
  error?: string | null;
  onRetry?: () => void;
}

function SourceBar({ sources }: { sources: SourceCount[] }) {
  const total = sources.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <div>
      <h3 className="font-display text-sm font-bold leading-5 text-ink">Records by source</h3>
      {total === 0 ? (
        <p data-testid="source-empty" className="caption mt-2">Nothing to chart yet.</p>
      ) : (
        <>
          <div aria-hidden="true" data-testid="source-bar" className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-pill">
            {sources
              .filter((entry) => entry.count > 0)
              .map((entry) => (
                <span key={entry.source} data-testid={`source-segment-${entry.source}`} className={cn("h-full", SOURCE_STYLES[entry.source])} style={{ flexGrow: entry.count, flexBasis: 0 }} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The legend of the source bar: a compact row of items, left-aligned, wrapping, with a 16px gap between them (it is not spread
 * across the card). Every item is ONE line: a dot, the label, the count and the percentage. Five fit on one row only where the
 * card is wide enough (about 1440px); otherwise the row wraps.
 */
function SourceLegend({ sources }: { sources: SourceCount[] }) {
  const total = sources.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) return null;
  const percent = (count: number) => Math.round((count / total) * 100);
  return (
    <ul data-testid="source-legend" className="flex flex-wrap justify-start gap-x-4 gap-y-1.5 lg:col-span-2">
      {sources.map((entry) => (
        <li key={entry.source} data-testid={`source-legend-${entry.source}`} className="caption flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", SOURCE_STYLES[entry.source])} />
          <span className="text-ink">
            {RECORD_SOURCE_LABELS[entry.source]}
          </span>
          <span className="shrink-0 tabular-nums">
            {entry.count} · {percent(entry.count)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RecordsPaceCard({ pace, sources, error, onRetry }: RecordsPaceCardProps) {
  if (error) {
    return (
      <Card as="section" ariaLabel="Verification pace" padding="sm" className="flex flex-wrap items-center justify-between gap-3 py-3">
        <p role="alert" className="body-sm text-danger">{error}</p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )}
      </Card>
    );
  }
  if (!pace || !sources) {
    return (
      <Card as="section" ariaLabel="Verification pace" padding="sm" className="grid gap-4 py-3 lg:grid-cols-2" testId="records-pace">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </Card>
    );
  }

  const zones: GaugeZone[] = pace.gauge.zones.map((zone) => ({ key: zone.key, label: ZONE_LABEL[zone.key], tone: ZONE_TONE[zone.key], percent: zone.percent, testId: `pace-zone-${zone.key}` }));
  return (
    <Card as="section" ariaLabel="Verification pace" padding="sm" className="grid gap-x-8 gap-y-4 py-3 lg:grid-cols-2" testId="records-pace">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold leading-5 text-ink">Verified this month</h2>
          <span data-testid="pace-status">
            <StatusBadge status={pace.status} />
          </span>
        </div>
        {pace.target > 0 ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p data-testid="pace-headline" className="font-display text-xl font-extrabold leading-6.5 text-ink">
                {pace.verified} of {pace.target} verified
              </p>
              <dl className="flex items-baseline gap-4">
                <div className="flex items-baseline gap-1.5">
                  <dt className="caption">Pace</dt>
                  <dd data-testid="pace-figure" className="font-display text-base font-bold leading-6 tabular-nums text-ink">{pace.paceRounded}</dd>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dt className="caption">Target</dt>
                  <dd data-testid="pace-target" className="font-display text-base font-bold leading-6 tabular-nums text-ink">{pace.target}</dd>
                </div>
              </dl>
            </div>
            <ZoneGauge
              zones={zones}
              meter={{ label: "Records verified this month against the pro-rated pace", min: 0, max: pace.gauge.max, now: pace.verified, text: pace.text }}
              markerAt={pace.gauge.markerAt}
              markerLabel={`${pace.verified} verified`}
              capped={pace.gauge.capped ? { text: `${pace.gauge.capped}× the pace` } : undefined}
              hint={pace.hint}
              tickAt={pace.gauge.paceAt}
              tickLabel={`pace ${pace.paceRounded}`}
              testIds={{
                gauge: "pace-gauge",
                marker: "pace-marker",
                markerLabel: "pace-marker-label",
                tick: "pace-tick",
                tickLabel: "pace-tick-label",
                capped: "pace-capped",
                arrow: "pace-arrow",
                labels: "pace-zone-labels",
              }}
            />
          </>
        ) : (
          <p data-testid="pace-no-target" className="body-sm text-muted">
            No target is set for this month, so there is no pace to judge. {pace.verified} verified so far.
          </p>
        )}
      </div>
      <SourceBar sources={sources} />
      <SourceLegend sources={sources} />
    </Card>
  );
}
