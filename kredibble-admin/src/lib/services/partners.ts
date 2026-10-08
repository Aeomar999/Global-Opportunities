/**
 * Partners service: the six-stage partner pipeline. One function per need; pages never touch the store or the seed.
 * Everything lives in the shared in-memory mock store, so the board, the detail page, the form, the "Partners onboarded"
 * KPI and the scorecards see the same partners. Writes use `{ always: true }` (partners have no backend yet, so they
 * are kept in memory in every mode). TODO(backend): every write below must be persisted by the API.
 *
 * Rules kept here, not in the pages:
 * - "Closed" is NEVER stored: a partner is closed exactly when its stage is Onboard or Renew (isPartnerClosed). Moving a
 *   card into one of those stages closes it, moving it out re-opens it, and movePartner says which happened.
 * - Every move appends a history entry { stage, at, from }, so the date and the from-to of each step are kept, and the
 *   current stage is always the last entry.
 * - Removing a partner clears it from the programs that were linked to it (no program points at a missing partner).
 */
import { getMockCollection, setMockCollection, subscribeMockStore } from "@/lib/mock-store";
import { isPartnerClosed, partnerClosedAt, type Partner, type PartnerStage, type PartnerStageEntry, type Program } from "@/lib/mock-entities";
import { OPEN_STAGES, type StageMove } from "@/lib/pipeline-health";
import { kpiTarget } from "@/lib/kpi";
import { todayIsoDate } from "@/lib/services/listings";

const MOCK_DELAY_MS = 300;
// The first load of a page takes a moment (a skeleton shows). Every later read is instant: a card that was just moved
// must be in its new column at once, not 300ms later.
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

/** Re-run a loader whenever partners (or anything else in the store) change. */
export const subscribePartners = subscribeMockStore;

/** A partner with the names the board and the detail page show. */
export interface PartnerRow extends Partner {
  ownerName?: string;
  closed: boolean;
}

const withNames = (partner: Partner): PartnerRow => ({
  ...partner,
  ownerName: getMockCollection("staff").find((person) => person.id === partner.ownerId)?.name,
  closed: isPartnerClosed(partner),
});

/** Every partner, for the board. */
export function loadPartnerRows(): Promise<PartnerRow[]> {
  return afterDelay(getMockCollection("partners").map(withNames));
}

/** One partner, or undefined. */
export function loadPartner(id: string): Promise<PartnerRow | undefined> {
  const partner = getMockCollection("partners").find((entry) => entry.id === id);
  return afterDelay(partner ? withNames(partner) : undefined);
}

/** The programs linked to a partner. */
export const programsOfPartner = (partnerId: string): Program[] => getMockCollection("programs").filter((program) => program.partnerId === partnerId);

/** People who can own a partner: active team members. */
export function partnerOwnerOptions(): { id: string; name: string; title?: string }[] {
  return getMockCollection("staff")
    .filter((person) => person.status === "active")
    .map((person) => ({ id: person.id, name: person.name, title: person.title }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every stage move of every partner, oldest first: what pipelineHealth learns the close rate from. */
export function flattenMoves(partners: readonly Pick<Partner, "id" | "stageHistory">[]): StageMove[] {
  return partners
    .flatMap((partner) => partner.stageHistory.map((entry): StageMove => ({ partnerId: partner.id, from: entry.from, to: entry.stage, at: entry.at })))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * The numbers every partner summary shows: deals still open (Prospect to Proposal, plus MOU), partners that moved into
 * Onboard or Renew this calendar month and are still closed, and how many partners are closed in total (in Onboard or Renew now).
 */
export function partnerSummary(
  partners: readonly Pick<Partner, "stage" | "stageHistory">[],
  today: Date = new Date(),
): { open: number; closedThisMonth: number; closedTotal: number } {
  const month = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`; // the UTC month, like the seed
  return {
    open: partners.filter((partner) => OPEN_STAGES.includes(partner.stage)).length,
    closedThisMonth: partners.filter((partner) => partnerClosedAt(partner)?.startsWith(month)).length,
    closedTotal: partners.filter(isPartnerClosed).length,
  };
}

/** Next month's "Partners onboarded" target (the monthly target stored for that KPI; Settings edits it). */
export const nextMonthPartnersTarget = (): number => kpiTarget("partners_onboarded");

/** The fields a person fills in on the form. The id, the stage and the history are decided by the service. */
export type PartnerFields = Omit<Partner, "id" | "stage" | "stageHistory">;

const write = (partners: Partner[]) => setMockCollection("partners", partners, { always: true });

/** Adds a partner at Prospect, with the first history entry. */
export function createPartner(fields: PartnerFields): Partner {
  const entry: PartnerStageEntry = { stage: "prospect", at: todayIsoDate() };
  const partner: Partner = { ...fields, id: `ptn-new-${Date.now()}`, stage: "prospect", stageHistory: [entry] };
  write([partner, ...getMockCollection("partners")]);
  return partner;
}

/** Saves the form over a partner (the stage and the history are not touched). */
export function updatePartner(id: string, fields: PartnerFields): Partner | undefined {
  const current = getMockCollection("partners").find((partner) => partner.id === id);
  if (!current) return undefined;
  const next: Partner = { ...current, ...fields };
  write(getMockCollection("partners").map((partner) => (partner.id === id ? next : partner)));
  return next;
}

/** What a move did to the "closed" state of the deal. */
export type ClosedChange = "closed" | "reopened" | null;

export interface MoveResult {
  partner: Partner;
  from: PartnerStage;
  to: PartnerStage;
  closedChange: ClosedChange;
}

/** Moves a partner to another stage. Closed follows the stage by itself (see the file header). Undefined when nothing moved. */
export function movePartner(id: string, to: PartnerStage): MoveResult | undefined {
  const current = getMockCollection("partners").find((partner) => partner.id === id);
  if (!current || current.stage === to) return undefined;
  const wasClosed = isPartnerClosed(current);
  const next: Partner = { ...current, stage: to, stageHistory: [...current.stageHistory, { stage: to, at: todayIsoDate(), from: current.stage }] };
  write(getMockCollection("partners").map((partner) => (partner.id === id ? next : partner)));
  const nowClosed = isPartnerClosed(next);
  return { partner: next, from: current.stage, to, closedChange: wasClosed === nowClosed ? null : nowClosed ? "closed" : "reopened" };
}

/** Removes a partner and clears it from the programs linked to it. */
export function removePartner(id: string) {
  write(getMockCollection("partners").filter((partner) => partner.id !== id));
  const programs = getMockCollection("programs");
  if (programs.some((program) => program.partnerId === id)) {
    setMockCollection("programs", programs.map((program) => (program.partnerId === id ? { ...program, partnerId: undefined } : program)), { always: true });
  }
}
