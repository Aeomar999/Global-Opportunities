/**
 * Pipeline health: is there enough OPEN business in the partner pipeline to hit next month's "Partners onboarded" target?
 * It looks forward, from how the pipeline has behaved in the past six months:
 *
 *   close rate   = deals that CLOSED in the last six months / deals that reached Outreach in the last six months
 *   needed       = next month's target / close rate, rounded UP (the open deals it takes, at that rate)
 *   open deals   = partners now in Prospect, Outreach, Proposal or MOU (anything not yet closed)
 *   ratio        = open deals / needed
 *   status       = healthy at 1.0 or more, thin from 0.6 up to (not including) 1.0, critical below 0.6
 *
 * Edge cases (all explicit, never a silent 0):
 *   - nothing reached Outreach in the window: there is no rate to learn from, so the status is "unknown";
 *   - deals reached Outreach but none closed: the rate is 0, so no number of open deals is enough: "critical";
 *   - a target of 0 needs no deals: "healthy".
 * A deal counts once, however many moves it made. A move into Onboard or Renew from an open stage is a close (a move
 * from Onboard to Renew keeps the same deal closed). Pure: no store, no clock (pass `today`), so it is easy to test.
 */
import { CLOSED_STAGES, type PartnerStage } from "@/lib/mock-entities";

/** One step of a deal: partner `partnerId` moved `from` a stage `to` another on `at` (ISO date). `from` is undefined when it was added. */
export interface StageMove {
  partnerId: string;
  from?: PartnerStage;
  to: PartnerStage;
  at: string;
}

export type PipelineStatus = "healthy" | "thin" | "critical" | "unknown";

export interface PipelineHealth {
  /** Deals in Prospect, Outreach, Proposal or MOU right now. */
  openDeals: number;
  /** Open deals it takes to hit the target at the historical close rate; null when it cannot be worked out. */
  needed: number | null;
  /** openDeals / needed; null when there is no `needed`. */
  ratio: number | null;
  status: PipelineStatus;
  /** Closed / reached Outreach over the window (0 to 1); null when nothing reached Outreach. */
  closeRate: number | null;
  /** The two counts behind the rate. */
  closedInWindow: number;
  reachedOutreachInWindow: number;
}

/** Stages that count as open: everything before a deal is closed. */
export const OPEN_STAGES: readonly PartnerStage[] = ["prospect", "outreach", "proposal", "mou"];

/** The ratio (open deals / deals needed) from which a pipeline is healthy, and from which it is at least thin. The gauge and its tooltip read these too. */
export const HEALTHY_FROM = 1;
export const THIN_FROM = 0.6;

/** The status for a ratio: healthy from HEALTHY_FROM, thin from THIN_FROM, critical below. */
export function statusForRatio(ratio: number): Exclude<PipelineStatus, "unknown"> {
  if (ratio >= HEALTHY_FROM) return "healthy";
  if (ratio >= THIN_FROM) return "thin";
  return "critical";
}

const pad = (n: number) => String(n).padStart(2, "0");
// The day is the UTC day (midnight UTC), the same one the seed (lib/mock-seed.ts) and the KPIs (lib/kpi.ts) use. A local day would
// move the six-month window by a day for anyone not on UTC, so the same data gave different figures at different hours.
const isoDay = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
/** "YYYY-MM-DD" of the day `months` before `today` (UTC). */
const monthsBefore = (today: Date, months: number) => isoDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - months, today.getUTCDate())));

/**
 * @param partners the partners as they are now (only their stage is used)
 * @param history every stage move of every partner (see flattenMoves in services/partners.ts)
 * @param target next month's "Partners onboarded" target
 * @param today the day to count back from (default: now)
 * @param windowMonths how far back to learn the close rate (default 6)
 */
export function pipelineHealth(
  partners: readonly { stage: PartnerStage }[],
  history: readonly StageMove[],
  target: number,
  today: Date = new Date(),
  windowMonths = 6,
): PipelineHealth {
  const start = monthsBefore(today, windowMonths);
  const end = isoDay(today);
  const inWindow = (at: string) => at.slice(0, 10) >= start && at.slice(0, 10) <= end;

  const reached = new Set<string>();
  const closed = new Set<string>();
  for (const move of history) {
    if (!inWindow(move.at)) continue;
    if (move.to === "outreach") reached.add(move.partnerId);
    // A close is a move INTO a closed stage from an open one (onboard -> renew is the same deal staying closed).
    if (CLOSED_STAGES.includes(move.to) && !(move.from && CLOSED_STAGES.includes(move.from))) closed.add(move.partnerId);
  }

  const openDeals = partners.filter((partner) => OPEN_STAGES.includes(partner.stage)).length;
  const base = { openDeals, closedInWindow: closed.size, reachedOutreachInWindow: reached.size };
  const closeRate = reached.size > 0 ? closed.size / reached.size : null;

  if (target <= 0) return { ...base, needed: 0, ratio: null, status: "healthy", closeRate };
  if (closeRate === null) return { ...base, needed: null, ratio: null, status: "unknown", closeRate };
  if (closeRate === 0) return { ...base, needed: null, ratio: null, status: "critical", closeRate };
  // Whole numbers only (target * reached / closed), so 2 / (2 / 17) can never come out as 17.0000000001 and round up to 18.
  const needed = Math.ceil((target * reached.size) / closed.size);
  const ratio = openDeals / needed;
  return { ...base, needed, ratio, status: statusForRatio(ratio), closeRate };
}
