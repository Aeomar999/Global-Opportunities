"use client";

/**
 * PrioritiesCard: the three KPIs furthest behind their pace, each as a bar toward the monthly target. "See all" expands the list to
 * all ten (worst first) and "Show fewer" folds it back.
 *
 * "Behind" is measured against the pace: the share of the target the month has earned so far (day 10 of 30 = a third). A KPI
 * with no target is left out (nothing to be behind). The bar's colour follows the card's status (never colour alone: the percent
 * and the status word are printed).
 *
 * Props:
 * - cards: the ten KpiCardData, or null when unavailable
 * - loading: show the skeleton with the same size
 * - isPast: a past month (the bar has no pace tick)
 * - notConnected: real-API mode: "Not available yet" (not an error)
 */
import { useState } from "react";
import { ListChecks } from "lucide-react";
import { KPIS } from "@/config/kpis";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { furthestBehind, paceAttainment, rankByPace } from "@/lib/services/dashboard";
import { formatAttainment } from "@/lib/scorecard";
import type { KpiCardData } from "@/lib/services/dashboard-types";
import { CARD_STATUS_WORDS, TargetBar } from "./KpiGrid";
import { NotAvailableYet } from "./NotAvailableYet";
import { UnavailableNote } from "./UnavailableNote";

const format = (value: number) => value.toLocaleString("en-US");

export function PrioritiesCard({ cards, loading, isPast, notConnected = false, className }: { cards: KpiCardData[] | null; loading: boolean; isPast: boolean; notConnected?: boolean; className?: string }) {
  const [all, setAll] = useState(false);
  const ranked = cards ? rankByPace(cards) : [];
  const shown = all ? ranked : cards ? furthestBehind(cards) : [];

  return (
    <Card as="section" ariaLabel="Priorities" testId="priorities-card" className={className}>
      <CardHeader
        title="Priorities"
        subtitle={isPast ? "Ranked by how far each fell short of its full target" : "Ranked by how far each is from where it should be today"}
        action={
          !loading && cards && ranked.length > 3 ? (
            <Button type="button" variant="secondary" aria-expanded={all} onClick={() => setAll((open) => !open)}>
              {all ? "Show fewer" : "See all"}
            </Button>
          ) : undefined
        }
      />
      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading priorities">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-1.5 w-full rounded-pill" />
            </div>
          ))}
        </div>
      ) : notConnected ? (
        <NotAvailableYet icon={ListChecks} />
      ) : !cards ? (
        <UnavailableNote message="The priorities could not be loaded." />
      ) : shown.length === 0 ? (
        <EmptyState icon={ListChecks} title="No targets set" description="Set a monthly target in Settings and the KPIs furthest behind show here." />
      ) : (
        <ul data-testid="priorities-list" className="space-y-4">
          {shown.map((card) => {
            const definition = KPIS[card.key];
            return (
              <li key={card.key} data-testid="priority-row" data-kpi={card.key}>
                <div className="mb-2 flex items-baseline justify-between gap-3 body-sm">
                  <span className="min-w-0 font-medium text-ink">{definition.label}</span>
                  <span className="shrink-0 font-bold tabular-nums text-ink">
                    {format(card.value ?? 0)} <span className="font-normal text-muted">of {format(card.target ?? 0)}</span>
                  </span>
                </div>
                <TargetBar card={card} label={definition.label} showPace={!isPast} />
                <p className="caption mt-1.5">
                  {card.status ? CARD_STATUS_WORDS[card.status] : "No target"}
                  {paceAttainment(card) !== null ? ` · ${formatAttainment(paceAttainment(card)).text} ${isPast ? "of the target" : "of where it should be today"}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
