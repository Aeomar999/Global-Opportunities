"use client";

/**
 * KpiGrid: the ten KPI cards of the Overview, from config/kpis.ts.
 *
 * Grid: 5 columns from 1440px (two rows of five), 4 columns from 1025px, 2 columns from 640px, 1 column below 640px.
 *
 * Each card has two layers: an upper area (the label, the big value, "of {target} {unit}") and a footer (a status chip: dot plus
 * text, never colour alone; a progress-to-target bar with a thin tick where the month's pace is; the one-line note).
 * A card is one link to the screen that owns the metric, only when the viewer may see that screen; otherwise it is a plain card.
 *
 * Props:
 * - cards: the ten KpiCardData, or null when they could not be loaded (every card then shows "—", never 0)
 * - loading: show ten skeleton cards with the final shape
 * - notConnected: real-API mode, no live figures: every card is one greyed, compact "Not available yet" card (same height, no bar, no status)
 * - isPast: a past month: the bar has no pace tick (the month is over) and the chip is the final status
 */
import Link from "next/link";
import { KPI_KEYS, KPIS, kpisOwnedBy, type KpiKey } from "@/config/kpis";
import { useRoles } from "@/components/access/RoleProvider";
import type { Role } from "@/config/roles";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import type { KpiStatus } from "@/lib/kpi";
import type { KpiCardData } from "@/lib/services/dashboard-types";
import { hrefForScreen } from "@/lib/nav";
import { kpiUnit } from "@/lib/plural";
import { KPI_STATUS_LABELS } from "@/lib/status-map";
import { Tooltip } from "@/components/ui/Tooltip";
import { TruncatedText } from "@/components/ui/TruncatedText";
import { formatMonth } from "@/lib/format";
import { monthProgress } from "@/lib/kpi";
import type { MonthKey } from "@/lib/mock-entities";
import { Info } from "lucide-react";

/** The words on the chip: the one vocabulary of status-map.ts (On track, Behind, Off track). */
export const CARD_STATUS_WORDS: Record<KpiStatus, string> = KPI_STATUS_LABELS;

const CHIP: Record<KpiStatus, { pill: string; dot: string; bar: string }> = {
  green: { pill: "bg-success-soft text-success", dot: "bg-success-dot", bar: "bg-success-dot" },
  amber: { pill: "bg-warning-soft text-warning", dot: "bg-warning-dot", bar: "bg-warning-dot" },
  red: { pill: "bg-danger-soft text-danger", dot: "bg-danger-dot", bar: "bg-danger-dot" },
};

const format = (value: number) => value.toLocaleString("en-US");

export function StatusChip({ status }: { status: KpiStatus | null }) {
  if (!status) {
    return (
      <span data-testid="kpi-status" className="inline-flex h-6 w-fit items-center rounded-pill bg-neutral-soft px-2.5 text-xs font-semibold text-neutral">
        No target
      </span>
    );
  }
  const styles = CHIP[status];
  return (
    <span data-testid="kpi-status" data-status={status} className={cn("inline-flex h-6 items-center gap-1.5 rounded-pill px-2.5 text-xs font-semibold", styles.pill)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", styles.dot)} />
      {CARD_STATUS_WORDS[status]}
    </span>
  );
}

/** The progress-to-target bar: the fill is the share of the target reached (capped at the full bar), the tick is the month's pace. */
export function TargetBar({ card, label, showPace }: { card: KpiCardData; label: string; showPace: boolean }) {
  const reached = card.attainment === null ? 0 : Math.min(1, Math.max(0, card.attainment));
  const status = card.status;
  return (
    <div
      role="progressbar"
      aria-label={`${label}: progress to target`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={card.attainment === null ? undefined : Math.round(card.attainment * 100)}
      aria-valuetext={card.attainment === null ? "No target" : `${Math.round(card.attainment * 100)}% of the target`}
      className="relative h-1.5 w-full rounded-pill bg-track"
    >
      <div data-testid="kpi-bar-fill" className={cn("h-full rounded-pill", status ? CHIP[status].bar : "bg-neutral-dot")} style={{ width: `${reached * 100}%` }} />
      {showPace && card.prorated !== false && card.pace !== null && card.target ? (
        <span
          data-testid="kpi-pace-tick"
          aria-hidden="true"
          className="absolute -top-0.5 h-2.5 w-0.5 -translate-x-1/2 rounded-full bg-ink"
          style={{ left: `${Math.min(1, card.pace) * 100}%` }}
        />
      ) : null}
    </div>
  );
}

function KpiCardView({ card, isPast }: { card: KpiCardData; isPast: boolean }) {
  const { can } = useRoles();
  const definition = KPIS[card.key];
  const linked = can(definition.screen, "view");
  const unavailable = card.value === null;
  const body = (
    <>
      {/* Upper layer */}
      <div className="flex flex-1 flex-col gap-1 bg-surface-2 p-4">
        <p className="kpi-label">{definition.label}</p>
        <p data-testid="kpi-value" className="stat-value">
          {unavailable ? (
            <span role="img" aria-label="unavailable">
              —
            </span>
          ) : (
            format(card.value!)
          )}
        </p>
        <p data-testid="kpi-of" className="caption">
          {card.target ? `of ${format(card.target)} ${kpiUnit(card.key, card.target)}` : card.target === 0 ? `No target for ${definition.unit}` : `Target ${definition.unit}: —`}
        </p>
      </div>
      {/* Footer layer */}
      <div className="flex flex-col gap-2.5 bg-white p-4">
        {unavailable ? <span className="caption">Status unavailable</span> : <StatusChip status={card.status} />}
        <TargetBar card={card} label={definition.label} showPace={!isPast && !unavailable} />
        {/* One line; the full text is in the shared Tooltip on hover and on keyboard focus (while it is cut off). */}
        <TruncatedText text={definition.note} className="caption" />
      </div>
    </>
  );
  const shell = "card-surface relative flex h-full flex-col overflow-hidden transition-colors duration-150 ease-out";
  return linked ? (
    <Link
      href={hrefForScreen(definition.screen)}
      data-testid={`kpi-card-${card.key}`}
      data-status={card.status ?? undefined}
      aria-label={`${definition.label}: ${unavailable ? "unavailable" : format(card.value!)}${card.target ? ` of ${format(card.target)} ${kpiUnit(card.key, card.target)}` : ""}${card.status ? `, ${CARD_STATUS_WORDS[card.status]}` : ""}`}
      className={cn(shell, "outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus")}
    >
      {body}
    </Link>
  ) : (
    <div data-testid={`kpi-card-${card.key}`} data-status={card.status ?? undefined} className={shell}>
      {body}
    </div>
  );
}

/** The greyed card of real-API mode. It keeps the loaded card's height with invisible spacers, so nothing jumps when data arrives. */
function NotAvailableCard({ cardKey }: { cardKey: KpiKey }) {
  return (
    <div data-testid={`kpi-card-${cardKey}`} data-state="not-available" className="card-surface flex h-full flex-col overflow-hidden bg-surface-2 opacity-75">
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="kpi-label">{KPIS[cardKey].label}</p>
        <p aria-hidden="true" className="stat-value invisible">0</p>
        <p className="caption">Not available yet</p>
      </div>
      <div aria-hidden="true" className="invisible flex flex-col gap-2.5 p-4">
        <span className="h-6" />
        <span className="h-1.5" />
        <span className="h-4" />
      </div>
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div data-testid="kpi-skeleton" className="card-surface flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-1 bg-surface-2 p-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex flex-col gap-2.5 bg-white p-4">
        <Skeleton className="h-6 w-20 rounded-pill" />
        <Skeleton className="h-1.5 w-full rounded-pill" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/**
 * The order of the ten cards for a set of roles: the KPIs the roles OWN first (their scorecard, from config/kpis.ts; two roles own the
 * union), then a muted "Other metrics" heading, then the rest, each group in the default order. A role that owns all ten (Desk Lead) or
 * none (Super Admin, Admin Support) sees the default order with no heading.
 */
export function orderCards(roles: readonly Role[]): { mine: KpiKey[]; others: KpiKey[]; heading: boolean } {
  const owned = new Set(kpisOwnedBy(roles).map((kpi) => kpi.key));
  if (owned.size === 0 || owned.size === KPI_KEYS.length) return { mine: [...KPI_KEYS], others: [], heading: false };
  return { mine: KPI_KEYS.filter((key) => owned.has(key)), others: KPI_KEYS.filter((key) => !owned.has(key)), heading: true };
}

/** The muted line under the cards: how the status is judged, with a worked example; for a past month, which targets were used. */
export function ProRatingNote({ month, isPast, loading }: { month: MonthKey; isPast: boolean; loading: boolean }) {
  if (loading) return <Skeleton className="h-4 w-80 max-w-full" />;
  if (isPast) {
    return (
      <p data-testid="pro-rating-note" className="caption">
        Showing the targets and thresholds that applied in {formatMonth(month)}
      </p>
    );
  }
  const { dayOfMonth, daysInMonth } = monthProgress(month);
  const expected = Math.round((12000 * dayOfMonth) / daysInMonth / 100) * 100;
  return (
    <p data-testid="pro-rating-note" className="caption flex flex-wrap items-center gap-x-1.5">
      Targets are monthly. Status compares each figure with where it should be by today.
      <Tooltip label={`Day ${dayOfMonth} of ${daysInMonth}: a 12,000 target expects about ${expected.toLocaleString("en-US")} by now. Running totals, such as Active ambassadors, are judged against the full target.`} wrap>
        <button type="button" aria-label="How status is worked out" data-testid="pro-rating-help" className="inline-flex size-6 items-center justify-center rounded-pill text-muted hover:text-ink">
          <Info size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </Tooltip>
    </p>
  );
}

export function KpiGrid({ cards, loading, isPast, notConnected = false }: { cards: KpiCardData[] | null; loading: boolean; isPast: boolean; notConnected?: boolean }) {
  const { roles } = useRoles();
  const { mine, others, heading } = orderCards(roles);
  const byKey = new Map<KpiKey, KpiCardData>((cards ?? []).map((card) => [card.key, card]));
  return (
    <section aria-label="Key numbers" aria-busy={loading || undefined}>
      <div data-testid="kpi-grid" className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1025px]:grid-cols-4 min-[1440px]:grid-cols-5">
        {[...mine, ...(heading ? (["__heading__"] as const) : []), ...others].map((key) =>
          key === "__heading__" ? (
            <h2 key={key} data-testid="other-metrics-heading" className="col-span-full pt-2 text-sm font-semibold text-muted">
              Other metrics
            </h2>
          ) : loading ? (
            <KpiCardSkeleton key={key} />
          ) : notConnected ? (
            <NotAvailableCard key={key} cardKey={key} />
          ) : (
            <KpiCardView key={key} isPast={isPast} card={byKey.get(key) ?? { key, value: null, target: null, status: null, pace: null, attainment: null }} />
          ),
        )}
      </div>
    </section>
  );
}
