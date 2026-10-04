/**
 * Data and actions for the Opportunities Queue and the review page (opportunities/[id]).
 *
 * Same switch as the other loaders (see mock-mode.ts):
 * - Mock mode: mock postings (src/lib/mock-opportunities.ts) after ~400ms, with this session's changes laid over
 *   them. Actions resolve with the changed record and the page keeps it in the shared mock store.
 * - Real mode: every page of GET /admin/opportunities, and GET/PATCH /admin/opportunities/:id, mapped by
 *   toOpportunity(). The API's singular types ("job") become the queue's type keys ("jobs"). Its statuses are kept:
 *   approving vets and publishes a posting, so an approved posting reads "published", which is what the API stores.
 *   Errors reject with the server's message; a missing posting resolves with undefined (the page shows "not found").
 *
 * The queue loader returns ALL rows once; the page filters and counts on the client.
 */
import { getOpportunityById, getOpportunityPage, moderateOpportunity, type OpportunityRecord } from "@/lib/api";
import { overlayRows } from "@/lib/mock-store";
import { postedOpportunities, type PostedOpportunity } from "@/lib/mock-opportunities";
import { fetchAll, orMissing } from "./api-helpers";
import { isMockMode } from "./mock-mode";

const MOCK_DELAY_MS = 400;
const afterDelay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS));

/** One posting, as the queue and the review page show it. */
export interface Opportunity extends Omit<PostedOpportunity, "type" | "moderationStatus"> {
  /** jobs, internships, events or grants in mock data; the API adds competitions, fellowships and trainings. */
  type: string;
  /** pending, approved or rejected in mock data; on the API an approved posting is "published". */
  moderationStatus: string;
}

export type OpportunityRow = Pick<Opportunity, "id" | "type" | "title" | "company" | "date" | "moderationStatus" | "applicantsCount">;

export type ModerationDecision = "approve" | "reject";

/** The API's posting types, as the queue's type keys. */
const TYPE_KEYS: Record<string, string> = {
  job: "jobs",
  internship: "internships",
  competition: "competitions",
  fellowship: "fellowships",
  "training-workshop": "trainings",
};

/** Approved in mock data, published on the API: either way there is nothing left to approve. */
export const isApprovedStatus = (status: string): boolean => status === "approved" || status === "published";

function toOpportunity(record: OpportunityRecord): Opportunity {
  return {
    id: record.id,
    title: record.title,
    type: TYPE_KEYS[record.type] ?? record.type,
    company: record.company,
    location: record.location,
    description: record.description,
    applicantsCount: record.applicantsCount ?? 0,
    date: record.date || record.createdAt,
    moderationStatus: record.moderationStatus,
    workType: record.workType,
    salary: record.salary,
    eventDateTime: record.eventDateTime,
    eventCategory: record.eventCategory,
    grantBudgetRange: record.grantBudgetRange,
    grantSector: record.grantSector,
  };
}

const toRow = ({ id, type, title, company, date, moderationStatus, applicantsCount }: Opportunity): OpportunityRow => ({
  id,
  type,
  title,
  company,
  date,
  moderationStatus,
  applicantsCount,
});

export async function loadOpportunityRows(): Promise<OpportunityRow[]> {
  if (isMockMode()) return afterDelay(overlayRows("opportunities", postedOpportunities).map(toRow));
  const records = await fetchAll((page, limit) => getOpportunityPage({ page, limit }));
  return records.map((record) => toRow(toOpportunity(record)));
}

/** One posting, or undefined when it does not exist. */
export async function loadOpportunity(id: string): Promise<Opportunity | undefined> {
  if (isMockMode()) return postedOpportunities.find((opportunity) => opportunity.id === id);
  return getOpportunityById(id).then(toOpportunity, orMissing<Opportunity>);
}

/** Approves (vets and publishes) or rejects a posting and resolves with it as saved. */
export async function decideOpportunity(opportunity: Opportunity, decision: ModerationDecision): Promise<Opportunity> {
  if (isMockMode()) return { ...opportunity, moderationStatus: decision === "approve" ? "approved" : "rejected" };
  return toOpportunity(await moderateOpportunity(opportunity.id, decision));
}
