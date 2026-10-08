/**
 * Scorecard data service: what the Scorecard screen (/scorecard) shows. The maths is in lib/scorecard.ts; this file only loads, with the
 * delay, the dev states and the real-API case the other services have.
 *
 * - getMyScorecard(roles, month): the VIEWER's scorecard. It is worked out from the roles passed in (the viewer's current roles from the
 *   role context, so the dev switcher works) and carries nothing about anyone else: no other name, no team list.
 * - getTeamScorecard(month): every person in the staff collection, ranked. Only the Team tab calls it, and only for roles that may view it.
 * - Mock mode: worked out from the shared in-memory store with the same functions as the Overview, so a card, a priority and a scorecard
 *   row always agree. The first load takes a moment (skeletons); later ones are instant.
 * - Dev only: ?state=loading|error|empty on the page URL forces that state (mock mode, never in production).
 * - Real-API mode: the monthly figures have no live source yet, so `notConnected` is true and nothing is calculated.
 *
 * TODO(backend): the scorecard needs monthly figures per KPI from the API.
 */
import type { Role } from "@/config/roles";
import { currentMonth, isPastMonth } from "@/lib/kpi";
import type { MonthKey } from "@/lib/mock-entities";
import { compositeSeries, isTooEarly, scorecardFor, teamScorecards, type CompositePoint, type ScorecardPerson } from "@/lib/scorecard";
import { getAdminUser } from "@/lib/api";
import type { OverviewIssue } from "./dashboard-types";
import { isMockMode } from "./mock-mode";

export interface ScorecardData {
  month: MonthKey;
  /** The month is in the past: a read-only snapshot with the targets and thresholds that applied then. */
  isPast: boolean;
  /** Real-API mode: no live figures yet. Not an error. */
  notConnected: boolean;
  /** The current month is too young to score (before SCORE_FROM_DAY): every composite is null, for that reason only. */
  tooEarly: boolean;
  /** "me": exactly one person, the viewer. "team": everyone, ranked. */
  people: ScorecardPerson[];
  /** "me" only: the last six months of the viewer's composite. */
  series: CompositePoint[] | null;
}

export interface ScorecardResult {
  data: ScorecardData;
  issue: OverviewIssue | null;
}

const FORCED = ["loading", "error", "empty"] as const;
type Forced = (typeof FORCED)[number];
const MOCK_DELAY_MS = 400;
let loadedOnce = false;

function readForcedState(): Forced | null {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production" || !isMockMode()) return null;
  const value = new URLSearchParams(window.location.search).get("state");
  return FORCED.find((state) => state === value) ?? null;
}

const nothing = (month: MonthKey, notConnected = false): ScorecardData => ({ month, isPast: isPastMonth(month), notConnected, tooEarly: false, people: [], series: null });

/** Waits for the first load only, then answers at once (so a change on screen is instant). */
function afterDelay<T>(make: () => T): Promise<T> {
  if (loadedOnce) return Promise.resolve(make());
  return new Promise<T>((resolve) =>
    setTimeout(() => {
      loadedOnce = true;
      resolve(make());
    }, MOCK_DELAY_MS),
  );
}

function load(month: MonthKey, build: () => ScorecardData): Promise<ScorecardResult> {
  const forced = readForcedState();
  if (forced === "loading") return new Promise<ScorecardResult>(() => {});
  if (!isMockMode()) return Promise.resolve({ data: nothing(month, true), issue: null });
  if (forced === "error") return afterDelay(() => ({ data: nothing(month), issue: { kind: "failed", message: "Could not load the scorecard. (forced: ?state=error)" } as OverviewIssue }));
  if (forced === "empty") return afterDelay(() => ({ data: nothing(month), issue: null }));
  return afterDelay(() => ({ data: build(), issue: null }));
}

/** The viewer's own scorecard for a month. `roles` are the viewer's CURRENT roles (the role context). */
export function getMyScorecard(roles: readonly Role[], month: MonthKey = currentMonth()): Promise<ScorecardResult> {
  return load(month, () => {
    // "Me" is the SIGNED-IN user (the session), never a staff member picked from the collection.
    const name = getAdminUser()?.name ?? "You";
    const me = scorecardFor({ id: "me", name, roles: [...roles] }, month);
    return { month, isPast: isPastMonth(month), notConnected: false, tooEarly: isTooEarly(month), people: [me], series: me.metrics.length > 0 ? compositeSeries(roles, 6) : null };
  });
}

/** Everyone, scored and ranked, for a month. Only for roles that may view the team scorecard. */
export function getTeamScorecard(month: MonthKey = currentMonth()): Promise<ScorecardResult> {
  return load(month, () => ({ month, isPast: isPastMonth(month), notConnected: false, tooEarly: isTooEarly(month), people: teamScorecards(month), series: null }));
}
