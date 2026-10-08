/**
 * Network service: the ambassadors who amplify listings with their referral code, their amplification logs, and the
 * leaderboard built from them. One function per need; pages never touch the store or the seed. Everything lives in the
 * shared in-memory mock store, so the list, the detail page, the form, the leaderboard, the "Active ambassadors" KPI and
 * the scorecards see the same data. Writes use `{ always: true }` (ambassadors have no backend yet, so they are kept in
 * memory in every mode). TODO(backend): every write below must be persisted by the API.
 *
 * Rules kept here, not in the pages:
 * - The REFERRAL CODE is generated once, when the ambassador is created (GOD- and six letters or digits, unique), and no
 *   function here ever changes it: updateAmbassador takes no code, and keeps the one the ambassador has.
 * - Logging an amplification adds one entry to the log (today, the channel, an optional note) and so adds one share to
 *   this month's count, on the detail page and on the leaderboard.
 * - A share counts in the month of its date; a verified signup counts in the month it was verified. Past months are
 *   therefore snapshots: they are worked out from dated entries and never change.
 * - Leaderboard order: verified signups, then referred clicks, then shares logged (all highest first); a tie on all
 *   three is broken by name, so the order never jumps about.
 */
import { currentMonth } from "@/lib/kpi";
import { getMockCollection, setMockCollection, subscribeMockStore } from "@/lib/mock-store";
import { seekerAccounts } from "@/lib/mock-seekers";
import type { AmplificationLog, Ambassador, DatabaseRecord, MonthKey, SocialPlatform } from "@/lib/mock-entities";
import { todayIsoDate } from "@/lib/services/listings";

const MOCK_DELAY_MS = 300;
// The first load of a page takes a moment (a skeleton shows). Every later read is instant, so a change is on screen at once.
let loadedOnce = false;
const afterDelay = <T>(value: T) => {
  if (loadedOnce) return Promise.resolve(value);
  return new Promise<T>((resolve) =>
    setTimeout(() => {
      loadedOnce = true;
      resolve(value);
    }, MOCK_DELAY_MS),
  );
};

/** Re-run a loader whenever the network (or anything else in the store) changes. */
export const subscribeNetwork = subscribeMockStore;

/** The month ("YYYY-MM") of an ISO date or date-time. */
export const monthOf = (at: string): MonthKey => at.slice(0, 7);

// ---- pure maths (tested on their own) ---------------------------------------------------------------------------

export interface MonthStats {
  shares: number;
  clicks: number;
  signups: number;
}

/** One ambassador's activity in one month: shares logged, referred clicks, and verified signups attributed to them. */
export function ambassadorStats(
  ambassadorId: string,
  logs: readonly Pick<AmplificationLog, "ambassadorId" | "at" | "clicks">[],
  records: readonly Pick<DatabaseRecord, "ambassadorId" | "verified" | "verifiedAt">[],
  month: MonthKey,
): MonthStats {
  const mine = logs.filter((log) => log.ambassadorId === ambassadorId && monthOf(log.at) === month);
  return {
    shares: mine.length,
    clicks: mine.reduce((sum, log) => sum + log.clicks, 0),
    signups: records.filter((record) => record.ambassadorId === ambassadorId && record.verified && record.verifiedAt && monthOf(record.verifiedAt) === month).length,
  };
}

export interface NetworkSummaryData {
  /** Everyone in the network, applicants included. */
  size: number;
  /** Ambassadors whose status is Active. */
  active: number;
  /** Active ambassadors who logged at least one share in the month. */
  sharedActive: number;
  /** sharedActive / active (0 to 1), or null when there is no active ambassador (never a made-up 0). */
  activityRate: number | null;
}

/** The three numbers at the top of the Network page. The activity rate is for `month` (default: this month). */
export function networkSummary(
  ambassadors: readonly Pick<Ambassador, "id" | "status">[],
  logs: readonly Pick<AmplificationLog, "ambassadorId" | "at">[],
  month: MonthKey = currentMonth(),
): NetworkSummaryData {
  const active = ambassadors.filter((ambassador) => ambassador.status === "active");
  const shared = new Set(logs.filter((log) => monthOf(log.at) === month).map((log) => log.ambassadorId));
  const sharedActive = active.filter((ambassador) => shared.has(ambassador.id)).length;
  return { size: ambassadors.length, active: active.length, sharedActive, activityRate: active.length > 0 ? sharedActive / active.length : null };
}

export interface LeaderboardEntry extends MonthStats {
  ambassador: Ambassador;
}
export interface LeaderboardRow extends LeaderboardEntry {
  rank: number;
}

/** Orders entries by verified signups, then referred clicks, then shares logged (highest first), then by name; ranks them 1, 2, 3... */
export function rankAmbassadors(entries: readonly LeaderboardEntry[]): LeaderboardRow[] {
  return [...entries]
    .sort((a, b) => b.signups - a.signups || b.clicks - a.clicks || b.shares - a.shares || a.ambassador.name.localeCompare(b.ambassador.name))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** The leaderboard of one month: every ambassador who had joined by the end of it (applicants have not), ranked. */
export function buildLeaderboard(
  ambassadors: readonly Ambassador[],
  logs: readonly AmplificationLog[],
  records: readonly DatabaseRecord[],
  month: MonthKey,
): LeaderboardRow[] {
  const members = ambassadors.filter((ambassador) => ambassador.status !== "applicant" && monthOf(ambassador.joinedAt) <= month);
  return rankAmbassadors(members.map((ambassador) => ({ ambassador, ...ambassadorStats(ambassador.id, logs, records, month) })));
}

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0, O, 1, I
/** A referral code: "GOD-" and six letters or digits, never one already in `used`. `random` is a parameter so it can be tested. */
export function generateReferralCode(used: ReadonlySet<string>, random: () => number = Math.random): string {
  for (;;) {
    let code = "GOD-";
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
    if (!used.has(code)) return code;
  }
}

// ---- loaders ---------------------------------------------------------------------------------------------------------

const staffName = (id: string | undefined) => (id ? getMockCollection("staff").find((person) => person.id === id)?.name : undefined);

/** An ambassador with the names the list shows. */
export interface AmbassadorRow extends Ambassador {
  leadName?: string;
  /** Shares logged this month. */
  sharesThisMonth: number;
}

export function loadAmbassadorRows(): Promise<AmbassadorRow[]> {
  const logs = getMockCollection("amplificationLogs");
  const month = currentMonth();
  const rows = getMockCollection("ambassadors").map((ambassador): AmbassadorRow => ({
    ...ambassador,
    leadName: staffName(ambassador.assignedLeadId),
    sharesThisMonth: logs.filter((log) => log.ambassadorId === ambassador.id && monthOf(log.at) === month).length,
  }));
  return afterDelay(rows);
}

export interface AmbassadorDetailData {
  ambassador: Ambassador;
  leadName?: string;
  linkedSeekerName?: string;
  /** Newest first. */
  logs: AmplificationLog[];
  /** This month's numbers. */
  stats: MonthStats;
}

export function loadAmbassador(id: string): Promise<AmbassadorDetailData | undefined> {
  const ambassador = getMockCollection("ambassadors").find((entry) => entry.id === id);
  if (!ambassador) return afterDelay(undefined);
  const logs = getMockCollection("amplificationLogs").filter((log) => log.ambassadorId === id).sort((a, b) => b.at.localeCompare(a.at));
  return afterDelay({
    ambassador,
    leadName: staffName(ambassador.assignedLeadId),
    linkedSeekerName: seekerAccounts.find((seeker) => seeker.id === ambassador.linkedSeekerId)?.name,
    logs,
    stats: ambassadorStats(id, getMockCollection("amplificationLogs"), getMockCollection("databaseRecords"), currentMonth()),
  });
}

export function loadLeaderboard(month: MonthKey): Promise<LeaderboardRow[]> {
  return afterDelay(buildLeaderboard(getMockCollection("ambassadors"), getMockCollection("amplificationLogs"), getMockCollection("databaseRecords"), month));
}

/** People who can lead an ambassador: active team members. */
export function leadOptions(): { id: string; name: string; title?: string }[] {
  return getMockCollection("staff")
    .filter((person) => person.status === "active")
    .map((person) => ({ id: person.id, name: person.name, title: person.title }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Seeker accounts an ambassador can be linked to. */
export const seekerOptions = (): { id: string; name: string; email: string }[] => seekerAccounts.map(({ id, name, email }) => ({ id, name, email }));

// ---- writes ----------------------------------------------------------------------------------------------------------

/** What the form edits. The id, the referral code and the dates are decided by the service, never by the form. */
export type AmbassadorFields = Omit<Ambassador, "id" | "referralCode" | "joinedAt" | "dormantSince">;

const write = (ambassadors: Ambassador[]) => setMockCollection("ambassadors", ambassadors, { always: true });

export function createAmbassador(fields: AmbassadorFields): Ambassador {
  const existing = getMockCollection("ambassadors");
  const used = new Set(existing.map((ambassador) => ambassador.referralCode));
  const ambassador: Ambassador = {
    ...fields,
    id: `amb-new-${Date.now()}`,
    referralCode: generateReferralCode(used),
    joinedAt: todayIsoDate(),
    dormantSince: fields.status === "dormant" ? todayIsoDate() : undefined,
  };
  write([ambassador, ...existing]);
  return ambassador;
}

/** Saves the form. The referral code and the joining date are kept exactly as they were. */
export function updateAmbassador(id: string, fields: AmbassadorFields): Ambassador | undefined {
  const current = getMockCollection("ambassadors").find((ambassador) => ambassador.id === id);
  if (!current) return undefined;
  const next: Ambassador = {
    ...current,
    ...fields,
    referralCode: current.referralCode,
    joinedAt: current.joinedAt,
    // Going quiet is dated; coming back clears it.
    dormantSince: fields.status === "dormant" ? current.dormantSince ?? todayIsoDate() : undefined,
  };
  write(getMockCollection("ambassadors").map((ambassador) => (ambassador.id === id ? next : ambassador)));
  return next;
}

/** Logs one share by hand: today, the channel and an optional note. It counts toward this month's shares at once. */
export function logAmplification(ambassadorId: string, channel: SocialPlatform, note?: string): AmplificationLog {
  const log: AmplificationLog = {
    id: `amp-new-${Date.now()}`,
    ambassadorId,
    channel,
    at: todayIsoDate(),
    clicks: 0,
    applications: 0,
    note: note?.trim() || undefined,
  };
  setMockCollection("amplificationLogs", [log, ...getMockCollection("amplificationLogs")], { always: true });
  return log;
}
