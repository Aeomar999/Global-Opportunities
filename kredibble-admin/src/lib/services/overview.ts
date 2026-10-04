/**
 * Overview data service: ONE `getOverview()` returns everything the Overview
 * page shows, so the page makes a single call on mount.
 *
 * - Mock mode (see mock-mode.ts): returns realistic mock data after ~400ms.
 * - Real mode: GET /dashboard/summary plus the verification and opportunity
 *   lists (existing helpers in lib/api.ts), combined into the same shape.
 *
 * Design rules:
 * - It never throws for expected failures. It resolves with `issue` set, and
 *   every section that could not be loaded is `null` (the UI shows "—").
 * - Dev only: in mock mode, ?state=loading|error|429|401|partial|empty on the page URL forces that
 *   state (see overview-mock.ts) so every loading / error / empty layout can be reviewed. It is ignored
 *   in production builds and in real-API mode.
 * - No automatic retries. The UI re-calls getOverview() when asked.
 * - The in-flight promise is shared, so React Strict Mode's double effect (or
 *   any double call) results in ONE network round trip.
 * - The series covers SERIES_DAYS days so the 7/14/30 tabs and the "vs previous
 *   period" delta are computed on the client from one fetch.
 */
import { formatDate } from "@/lib/format";
import {
  ApiError,
  getDashboardSummary,
  getOpportunities,
  getVerifications,
} from "@/lib/api";
import { isMockMode } from "./mock-mode";
import { buildForcedMockOverview, buildMockOverview, FORCED_STATES, type ForcedState } from "./overview-mock";
import {
  SERIES_DAYS,
  type KpiValue,
  type OverviewData,
  type OverviewIssue,
  type OverviewResult,
  type SeriesPoint,
} from "./overview-types";

export * from "./overview-types";

/** The ?state= value on the current page URL, or null. Mock mode and non-production only. */
function readForcedState(): ForcedState | null {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production" || !isMockMode()) return null;
  const value = new URLSearchParams(window.location.search).get("state");
  return FORCED_STATES.find((state) => state === value) ?? null;
}

const DEFAULT_RETRY_SECONDS = 30;
const MOCK_DELAY_MS = 400;

/* --------------------------------------------------------------- real API */

interface VerificationRecord {
  id: string;
  name: string;
  industry: string;
  submittedDate: string;
  overallStatus: string;
}

interface OpportunityRecord {
  id: string;
  title: string;
  company: string;
  type: string;
  date: string;
  moderationStatus: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Counts submissions per day for the last SERIES_DAYS days. Unparseable dates are skipped, not guessed. */
function bucketSubmissions(dates: string[]): SeriesPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: SERIES_DAYS }, (_, i) => {
    const start = today.getTime() - (SERIES_DAYS - 1 - i) * DAY_MS;
    return { date: new Date(start).toISOString(), label: formatDate(new Date(start), "short"), start, value: 0 };
  });
  for (const raw of dates) {
    const time = new Date(raw).getTime();
    if (Number.isNaN(time)) continue;
    const day = days.find((d) => time >= d.start && time < d.start + DAY_MS);
    if (day) day.value += 1;
  }
  return days.map(({ date, label, value }) => ({ date, label, value }));
}

const percentOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : null);

async function fetchRealOverview(): Promise<OverviewResult> {
  const [summary, verifications, opportunities] = await Promise.allSettled([
    getDashboardSummary() as Promise<unknown> as Promise<Record<string, number>>,
    getVerifications() as Promise<VerificationRecord[]>,
    getOpportunities() as Promise<OpportunityRecord[]>,
  ]);

  const kpiOf = (key: string): KpiValue => ({
    value: summary.status === "fulfilled" && typeof summary.value[key] === "number" ? summary.value[key] : null,
  });

  const data: OverviewData = {
    source: "api",
    kpis: {
      pendingVerifications: kpiOf("pendingVerifications"),
      activeSeekers: kpiOf("activeSeekers"),
      activeHirers: kpiOf("activeHirers"),
      openReports: kpiOf("openReports"),
    },
    submissions: null,
    queues: null,
    queuesNote: null, // the median review time is not available from the API
    latestOpportunities: null,
    activity: null,
  };

  // The three lists-derived sections need both lists; if either failed, leave them unavailable.
  if (verifications.status === "fulfilled" && opportunities.status === "fulfilled") {
    const vers = verifications.value;
    const opps = opportunities.value;

    data.submissions = bucketSubmissions([...vers.map((v) => v.submittedDate), ...opps.map((o) => o.date)]);

    const decided = (items: { status: string }[]) => items.filter((i) => i.status !== "pending").length;
    const verStatuses = vers.map((v) => ({ status: v.overallStatus }));
    const oppStatuses = opps.map((o) => ({ status: o.moderationStatus }));
    // Real mode only has verification and opportunity lists. "Reports resolved" needs a reports
    // list the overview does not fetch, so it is not shown here rather than guessed.
    data.queues = [
      {
        key: "verification",
        label: "Verification requests decided",
        percent: percentOf(decided(verStatuses), vers.length),
        caption: `${decided(verStatuses)} of ${vers.length} requests`,
      },
      {
        key: "opportunities",
        label: "Opportunities moderated",
        percent: percentOf(decided(oppStatuses), opps.length),
        caption: `${decided(oppStatuses)} of ${opps.length} postings`,
      },
    ];

    const byDateDesc = <T,>(items: T[], getDate: (item: T) => string) =>
      [...items].sort((a, b) => (new Date(getDate(b)).getTime() || 0) - (new Date(getDate(a)).getTime() || 0));

    data.latestOpportunities = byDateDesc(opps, (o) => o.date)
      .slice(0, 3)
      .map((o) => ({
        id: o.id,
        title: o.title,
        company: o.company,
        type: o.type,
        status: o.moderationStatus,
        posted: formatDate(o.date),
      }));

    data.activity = [
      ...vers.map((v) => ({
        key: `v-${v.id}`,
        kind: "verification" as const,
        title: `${v.name} requested verification`,
        description: v.industry,
        date: v.submittedDate,
      })),
      ...opps.map((o) => ({
        key: `o-${o.id}`,
        kind: "opportunity" as const,
        title: o.title,
        description: `${o.company} · ${o.type}`,
        date: o.date,
      })),
    ]
      .sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0))
      .slice(0, 4)
      .map(({ date, ...entry }) => ({ ...entry, time: formatDate(date) }));
  }

  return { data, issue: classifyIssue([summary, verifications, opportunities]) };
}

/** Turns the three settled requests into at most one banner-worthy issue. */
function classifyIssue(results: PromiseSettledResult<unknown>[]): OverviewIssue | null {
  const errors = results.flatMap((r) => (r.status === "rejected" ? [r.reason as unknown] : []));
  if (errors.length === 0) return null;

  const api = errors.filter((e): e is ApiError => e instanceof ApiError);

  // Priority: an expired session explains everything, then rate limiting.
  if (api.some((e) => e.status === 401)) {
    return { kind: "unauthorized", message: "Your session has expired." };
  }
  const limited = api.find((e) => e.status === 429);
  if (limited) {
    return {
      kind: "rate_limited",
      message: "Too many requests. Please wait before trying again.",
      retryAfter: limited.retryAfter ?? DEFAULT_RETRY_SECONDS,
    };
  }

  const firstMessage = errors[0] instanceof Error ? errors[0].message : "Something went wrong.";
  return errors.length === results.length
    ? { kind: "failed", message: `Could not load the overview. ${firstMessage}` }
    : { kind: "partial", message: `Some sections could not be loaded. ${firstMessage}` };
}

/* ----------------------------------------------------------------- public */

// The shared in-flight promise (see "one round trip" in the header comment).
// The shared in-flight promise, keyed by the forced dev state so switching ?state= never reuses a stale one.
let inflight: { key: string; promise: Promise<OverviewResult> } | null = null;

export function getOverview(): Promise<OverviewResult> {
  const forced = readForcedState();
  const key = forced ?? "live";
  if (inflight?.key === key) return inflight.promise;

  // ?state=loading: never resolve, so the skeletons stay on screen for review.
  if (forced === "loading") return new Promise<OverviewResult>(() => {});

  const run = isMockMode()
    ? new Promise<OverviewResult>((resolve) =>
        setTimeout(
          () => resolve(forced ? buildForcedMockOverview(forced) : { data: buildMockOverview(), issue: null }),
          MOCK_DELAY_MS,
        ),
      )
    : fetchRealOverview();

  const promise = run.finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { key, promise };
  return promise;
}
