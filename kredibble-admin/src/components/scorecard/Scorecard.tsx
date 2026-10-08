"use client";

/**
 * Scorecard: ONE component for both modes of /scorecard.
 *
 *   scope "me"    the viewer's own scorecard: the composite ring with its status, the strongest and weakest result (or one "Focus"), one row
 *                 for each metric the viewer's roles own, and a six-month trend. It receives only the viewer (people has one entry): no other
 *                 person's name, number or role is in the page.
 *   scope "team"  every person, ranked by composite: summary tiles, a role filter, a ranked list (24px avatar, name, role pills, composite and
 *                 status, strongest and weakest chips, an expand control for the person's metric rows). People who own no metric are listed last,
 *                 under "No metrics assigned", not ranked. There are no edit actions.
 *
 * People who share a role share a score: the KPIs are desk-wide counts. Individual attribution needs backend data (see lib/scorecard.ts).
 *
 * Props:
 * - scope: "me" | "team"
 * - month: the month shown ("2026-10"); a past month is a read-only snapshot and says which targets and thresholds it used
 * - people: the scored people (scope "me": exactly the viewer)
 * - series: scope "me": the composite of the last six months
 * - tooEarly: the current month is before SCORE_FROM_DAY: no composite and no ranking yet ("Too early in the month to score", "Scores start on day 5")
 * - loading: show the skeleton with the final shape
 * - notConnected: real-API mode: a calm "Not available yet" (the page shows the sample-data notice above)
 */
import { useId, useMemo, useState } from "react";
import { ChevronDown, ListChecks, Users } from "lucide-react";
import { NotAvailableYet } from "@/components/overview/NotAvailableYet";
import { StatusChip } from "@/components/overview/KpiGrid";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiniStat } from "@/components/ui/MiniStat";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { IconTextButton } from "@/components/ui/IconTextButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { TagPill } from "@/components/ui/TagPill";
import { ROLE_IDS, ROLES, type Role } from "@/config/roles";
import { formatMonth } from "@/lib/format";
import type { MonthKey } from "@/lib/mock-entities";
import { SCORE_FROM_DAY, TOO_EARLY_MESSAGE } from "@/config/scorecard";
import { highlightLabels, teamSummary, type CompositePoint, type Highlight, type ScorecardPerson } from "@/lib/scorecard";
import { AttainmentFigure } from "./AttainmentFigure";
import { CompositeTrend } from "./CompositeTrend";
import { MetricRow } from "./MetricRow";
import { ScoreRing } from "./ScoreRing";
import { StrengthPair } from "./StrengthPair";

interface ScorecardProps {
  scope: "me" | "team";
  month: MonthKey;
  people: ScorecardPerson[];
  series?: CompositePoint[] | null;
  loading?: boolean;
  notConnected?: boolean;
  /** The current month is too young to score (before SCORE_FROM_DAY). */
  tooEarly?: boolean;
  /** The month is in the past (read-only snapshot). */
  isPast?: boolean;
}

const MUTED_LINE = "Each metric counts up to 100% so one strong result can't hide a weak one.";

/** The note for a past month. */
function PastNote({ month }: { month: MonthKey }) {
  return (
    <p data-testid="scorecard-past-note" className="caption">
      Showing the targets and thresholds that applied in {formatMonth(month)}
    </p>
  );
}

// ---- my scorecard -------------------------------------------------------------------------------------------------------

function MyScorecard({ person, series, month, isPast }: { person: ScorecardPerson; series: CompositePoint[] | null; month: MonthKey; isPast: boolean }) {
  if (person.metrics.length === 0) {
    return (
      <Card as="section" ariaLabel="My scorecard" testId="my-scorecard">
        <EmptyState icon={ListChecks} title="No metrics are assigned to your role" description="A Desk Lead can assign metrics." />
      </Card>
    );
  }
  return (
    <div className="space-y-4" data-testid="my-scorecard">
      {isPast && <PastNote month={month} />}
      <Card as="section" ariaLabel="My scorecard">
        <div className="flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-center">
          <div className="flex items-center gap-4">
            <ScoreRing score={person.composite} status={person.status} />
            <div className="space-y-2">
              <p data-testid="my-name" className="table-text font-semibold text-ink break-words">
                {person.name}
              </p>
              <div data-testid="my-roles" className="flex flex-wrap gap-1.5">
                {person.roles.map((role) => (
                  <TagPill key={role}>{ROLES[role].label}</TagPill>
                ))}
              </div>
              {person.composite === null ? (
                <p data-testid="too-early" className="body-sm font-medium text-ink">
                  {TOO_EARLY_MESSAGE}
                </p>
              ) : (
                <StatusChip status={person.status} />
              )}
            </div>
          </div>
          <p data-testid="composite-note" className="caption min-[640px]:max-w-72">
            {MUTED_LINE}
          </p>
        </div>
        {person.highlight && (
          <div className="mt-4">
            <StrengthPair highlight={person.highlight} />
          </div>
        )}
      </Card>
      <Card as="section" ariaLabel="My metrics">
        <CardHeader title="My metrics" subtitle={isPast ? "What was reached against the full target" : "Each against the target it has earned so far"} />
        <ul data-testid="metric-list" className="divide-y divide-line">
          {person.metrics.map((row) => (
            <MetricRow key={row.key} row={row} />
          ))}
        </ul>
      </Card>
      {series && (
        <Card as="section" ariaLabel="Composite trend" testId="composite-trend">
          <CardHeader title="Composite over six months" subtitle="Each month scored with its own targets and thresholds" />
          <CompositeTrend series={series} />
        </Card>
      )}
    </div>
  );
}

// ---- team ---------------------------------------------------------------------------------------------------------------

const rowOf = (highlight: Highlight, which: "strongest" | "weakest" | "focus") =>
  highlight.kind === "focus" ? highlight.focus : which === "weakest" ? highlight.weakest : highlight.strongest;

/** "Strongest: Website views 118%" (above 300% the figure reads "300%+", exact in a Tooltip). */
function Chip({ testId, label, highlight, which }: { testId: string; label: string; highlight: Highlight; which: "strongest" | "weakest" | "focus" }) {
  const row = rowOf(highlight, which);
  return (
    <span data-testid={testId} data-kpi={row.key} className="caption rounded-pill bg-surface-2 px-2.5 py-1 text-ink">
      {label}: {row.label} <AttainmentFigure value={row.attainment} />
    </span>
  );
}

function PersonRow({ person }: { person: ScorecardPerson }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ranked = person.composite !== null;
  return (
    <li data-testid="team-row" data-person={person.id} className="py-3 first:pt-0 last:pb-0 print:py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
          <Avatar name={person.name} size="xs" />
          <div className="min-w-0">
            <p className="table-text font-semibold text-ink break-words">{person.name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {person.roles.map((role) => (
                <TagPill key={role}>{ROLES[role].label}</TagPill>
              ))}
            </div>
          </div>
        </div>
        {ranked && (
          <div className="flex shrink-0 items-center gap-2">
            <span data-testid="team-composite" className="font-display text-xl font-bold tabular-nums text-ink">
              {person.composite}
            </span>
            <StatusChip status={person.status} />
          </div>
        )}
        {ranked && person.highlight && (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {person.highlight.kind === "pair" ? (
              <>
                <Chip testId="team-strongest" label={highlightLabels(person.highlight).high} highlight={person.highlight} which="strongest" />
                <Chip testId="team-weakest" label={highlightLabels(person.highlight).low} highlight={person.highlight} which="weakest" />
              </>
            ) : (
              <Chip testId="team-focus" label="Focus" highlight={person.highlight} which="focus" />
            )}
          </div>
        )}
        {ranked && (
          <IconTextButton
            icon={ChevronDown}
            label={open ? "Hide metrics" : "Show metrics"}
            ariaLabel={`${open ? "Hide" : "Show"} metrics for ${person.name}`}
            expanded={open}
            controls={panelId}
            className="print:hidden"
            testId="team-expand"
            onClick={() => setOpen((value) => !value)}
          />
        )}
      </div>
      {ranked && open && (
        <ul id={panelId} data-testid="team-metrics" className="mt-3 divide-y divide-line rounded-control bg-surface-2 px-4 py-3">
          {person.metrics.map((row) => (
            <MetricRow key={row.key} row={row} />
          ))}
        </ul>
      )}
    </li>
  );
}

function TeamScorecard({ people, month, isPast, tooEarly }: { people: ScorecardPerson[]; month: MonthKey; isPast: boolean; tooEarly: boolean }) {
  const [role, setRole] = useState<Role | "all">("all");
  const options = useMemo<SelectOption<string>[]>(() => {
    const present = ROLE_IDS.filter((id) => people.some((person) => person.roles.includes(id)));
    return [{ value: "all", label: "All roles" }, ...present.map((id) => ({ value: id, label: ROLES[id].label }))];
  }, [people]);
  const shown = people.filter((person) => role === "all" || person.roles.includes(role));
  const ranked = shown.filter((person) => person.composite !== null);
  const heldBack = shown.filter((person) => person.composite === null && person.metrics.length > 0);
  const unranked = shown.filter((person) => person.metrics.length === 0);
  const summary = teamSummary(people);

  if (people.length === 0) {
    return (
      <Card as="section" ariaLabel="Team scorecard" testId="team-scorecard">
        <EmptyState icon={Users} title="No one to score yet" description="People appear here once they are added to the team." />
      </Card>
    );
  }
  return (
    <div className="space-y-4" data-testid="team-scorecard">
      {isPast && <PastNote month={month} />}
      <div data-testid="team-summary" className="grid gap-3 min-[640px]:grid-cols-3">
        <MiniStat compact value={tooEarly ? "—" : summary.scored} label="People scored" caption={tooEarly ? `Scores start on day ${SCORE_FROM_DAY}` : undefined} />
        <MiniStat compact value={tooEarly || summary.average === null ? "—" : summary.average} label="Average composite" caption={tooEarly ? `Scores start on day ${SCORE_FROM_DAY}` : undefined} />
        <MiniStat compact value={tooEarly ? "—" : summary.belowAmber} label="Below the amber threshold" caption={tooEarly ? `Scores start on day ${SCORE_FROM_DAY}` : undefined} />
      </div>
      <Card as="section" ariaLabel="Team scorecard">
        <CardHeader
          title="Ranked by composite"
          subtitle="People who share a role share a score: the figures are desk-wide counts."
          action={
            <div className="print:hidden">
              <Select className="w-56 max-w-full" ariaLabel="Filter by role" sheetTitle="Filter by role" options={options} value={role} onChange={(value) => setRole(value as Role | "all")} />
            </div>
          }
        />
        {tooEarly && heldBack.length > 0 ? (
          <div data-testid="team-too-early">
            <p className="body-sm font-medium text-ink">{TOO_EARLY_MESSAGE}</p>
            <p className="caption">Scores start on day {SCORE_FROM_DAY}, so no one is ranked yet.</p>
            <ul className="mt-3 space-y-2">
              {heldBack.map((person) => (
                <li key={person.id} data-testid="team-heldback-row" className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Avatar name={person.name} size="xs" />
                  <span className="table-text font-semibold text-ink">{person.name}</span>
                  {person.roles.map((id) => (
                    <TagPill key={id}>{ROLES[id].label}</TagPill>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ) : ranked.length === 0 ? (
          <p className="body-sm text-muted">No one with that role has a score.</p>
        ) : (
          <ol data-testid="team-ranked" className="divide-y divide-line">
            {ranked.map((person) => (
              <PersonRow key={person.id} person={person} />
            ))}
          </ol>
        )}
        {unranked.length > 0 && (
          <div data-testid="team-unranked" className="mt-4 border-t border-line pt-4">
            <h3 className="font-display text-sm font-bold text-ink">No metrics assigned</h3>
            <p className="caption mt-1">These roles have no metrics assigned to them.</p>
            <ul className="mt-3 space-y-2">
              {unranked.map((person) => (
                <li key={person.id} data-testid="team-unranked-row" className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Avatar name={person.name} size="xs" />
                  <span className="table-text font-semibold text-ink">{person.name}</span>
                  {person.roles.map((id) => (
                    <TagPill key={id}>{ROLES[id].label}</TagPill>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---- the shared component -----------------------------------------------------------------------------------------------

function ScorecardSkeleton({ scope }: { scope: "me" | "team" }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading the scorecard" data-testid="scorecard-skeleton">
      {scope === "team" && (
        <div className="grid gap-3 min-[640px]:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-control" />
          ))}
        </div>
      )}
      <Card>
        <div className="flex items-center gap-4">
          <Skeleton className="size-24 rounded-full sm:size-28" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-6 w-24 rounded-pill" />
          </div>
        </div>
        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-1.5 w-full rounded-pill" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function Scorecard({ scope, month, people, series = null, loading = false, notConnected = false, tooEarly = false, isPast = false }: ScorecardProps) {
  if (loading) return <ScorecardSkeleton scope={scope} />;
  if (notConnected) {
    return (
      <Card as="section" ariaLabel={scope === "team" ? "Team scorecard" : "My scorecard"}>
        <NotAvailableYet icon={ListChecks} />
      </Card>
    );
  }
  if (scope === "me") {
    const me = people[0];
    return me ? <MyScorecard person={me} series={series} month={month} isPast={isPast} /> : <MyScorecard person={{ id: "me", name: "", roles: [], composite: null, status: null, highlight: null, metrics: [], tooEarly: false }} series={null} month={month} isPast={isPast} />;
  }
  return <TeamScorecard people={people} month={month} isPast={isPast} tooEarly={tooEarly} />;
}
