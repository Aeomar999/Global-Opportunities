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
 * The queue is ONE list for two sources: postings submitted by hirers (the rows above, moderated here) and listings the
 * desk curates (services/listings.ts, kept in the shared store). Curated listings have no backend yet, so in real mode
 * only the ones created in this session are listed: the seeded sample listings never appear next to real postings.
 *
 * The queue loader returns ALL rows once; the page filters and counts on the client.
 */
import { getOpportunityById, getOpportunityPage, moderateOpportunity, type OpportunityRecord } from "@/lib/api";
import { getMockCollection, overlayRows } from "@/lib/mock-store";
import type { ListingType } from "@/lib/mock-entities";
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

/** Where a row came from: a hirer posted it (moderated here) or the desk curated it. */
export type OpportunitySource = "hirer" | "curated";

export type OpportunityRow = Pick<Opportunity, "id" | "type" | "title" | "company" | "date" | "moderationStatus"> & {
  source: OpportunitySource;
  /** Undefined when not known (a curated draft has no applications yet). */
  applicantsCount?: number;
  /** Undefined when it cannot be told (a hirer's "Pan-African"). */
  country?: string;
  /** Curated rows only. */
  vetting?: "vetted" | "unvetted";
};

/** "Accra, Ghana (Hybrid)" -> "Ghana"; "Pan-African" -> undefined (no single country). */
export function countryOfLocation(location: string): string | undefined {
  const parts = location.replace(/\s*\([^)]*\)\s*$/, "").split(",");
  return parts.length > 1 ? parts[parts.length - 1].trim() : undefined;
}

/** A curated listing's type, as the queue's type key. */
const LISTING_TYPE_KEYS: Record<ListingType, string> = {
  job: "jobs",
  internship: "internships",
  scholarship: "scholarships",
  fellowship: "fellowships",
  grant: "grants",
  event: "events",
};

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

const toRow = ({ id, type, title, company, date, moderationStatus, applicantsCount, location }: Opportunity): OpportunityRow => ({
  id,
  source: "hirer",
  type,
  title,
  company,
  country: countryOfLocation(location),
  date,
  moderationStatus,
  applicantsCount,
});

/** The desk's curated listings as rows, newest first. In real mode only those created in this session. */
function curatedRows(): OpportunityRow[] {
  const metrics = getMockCollection("listingMetrics");
  return getMockCollection("listings")
    .filter((listing) => isMockMode() || listing.id.startsWith("lst-new-"))
    .map((listing): OpportunityRow => {
      const reach = metrics.find((entry) => entry.listingId === listing.id);
      return {
        id: listing.id,
        source: "curated",
        type: LISTING_TYPE_KEYS[listing.type],
        title: listing.title,
        company: listing.organisation,
        country: listing.country,
        date: listing.publishedAt ?? listing.createdAt,
        moderationStatus: listing.status,
        vetting: listing.vetted ? "vetted" : "unvetted",
        applicantsCount: reach ? reach.applications.website + reach.applications.app : undefined,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function loadOpportunityRows(): Promise<OpportunityRow[]> {
  if (isMockMode()) return afterDelay([...curatedRows(), ...overlayRows("opportunities", postedOpportunities).map(toRow)]);
  const records = await fetchAll((page, limit) => getOpportunityPage({ page, limit }));
  return [...curatedRows(), ...records.map((record) => toRow(toOpportunity(record)))];
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
