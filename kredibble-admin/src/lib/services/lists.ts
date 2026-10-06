/**
 * Data loaders for the Verification Queue and Opportunities Queue list pages.
 *
 * They follow the same switch as the Overview (see mock-mode.ts):
 * - Mock mode (NEXT_PUBLIC_USE_MOCKS=true, or unset in development): realistic mock rows after
 *   ~400ms. They come from the same mock records the detail pages use, so every row link opens a
 *   real detail page. Together the rows cover every status these pages can show (pending,
 *   approved, rejected).
 * - Real mode: GET /verification/companies and GET /opportunities (existing helpers in lib/api.ts).
 *   Errors reject with the server's message, and the page shows them inline with a retry button.
 *
 * The Opportunities Queue is ONE list for two sources: postings submitted by hirers (moderated: pending, approved,
 * rejected) and listings curated by the desk (draft or published, with a vetting flag). Curated listings live in the
 * shared store in every mode (services/listings.ts), so they are merged into the rows in real mode too.
 *
 * Each loader returns ALL rows once; the pages filter and count on the client, so a filter change
 * never triggers a request.
 */
import { getOpportunities, getVerifications } from "@/lib/api";
import { pendingCompanies } from "@/lib/mock-data";
import { getMockCollection, overlayRows } from "@/lib/mock-store";
import type { ListingType } from "@/lib/mock-entities";
import { postedOpportunities } from "@/lib/mock-opportunities";
import { isMockMode } from "./mock-mode";

const MOCK_DELAY_MS = 400;
const afterDelay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS));

export interface VerificationRow {
  id: string;
  name: string;
  recruiterEmail: string;
  industry: string;
  submittedDate: string;
  overallStatus: string;
}

/** Where a listing came from: a hirer posted it (moderated here) or the desk curated it. */
export type OpportunitySource = "hirer" | "curated";

export interface OpportunityRow {
  id: string;
  source: OpportunitySource;
  /** One of the six listing types (a hirer's "jobs" is "job"...). */
  type: ListingType;
  title: string;
  company: string;
  /** Undefined when it cannot be told (a hirer's "Pan-African"). */
  country?: string;
  date: string;
  /** pending / approved / rejected (hirer-submitted) or draft / published (curated). */
  status: string;
  /** Curated rows only. */
  vetting?: "vetted" | "unvetted";
  /** Undefined when not known (a curated draft has no applications yet). */
  applicantsCount?: number;
}

const HIRER_TYPES: Record<string, ListingType> = { jobs: "job", internships: "internship", events: "event", grants: "grant" };

/** "Accra, Ghana (Hybrid)" -> "Ghana"; "Pan-African" -> undefined (no single country). */
export function countryOfLocation(location: string): string | undefined {
  const parts = location.replace(/\s*\([^)]*\)\s*$/, "").split(",");
  return parts.length > 1 ? parts[parts.length - 1].trim() : undefined;
}

export function loadVerificationRows(): Promise<VerificationRow[]> {
  if (isMockMode()) {
    return afterDelay(
      overlayRows("verification", pendingCompanies).map((company) => ({
        id: company.id,
        name: company.name,
        recruiterEmail: company.recruiterEmail,
        industry: company.industry,
        submittedDate: company.submittedDate,
        overallStatus: company.overallStatus,
      })),
    );
  }
  return getVerifications() as Promise<VerificationRow[]>;
}

/** The desk's curated listings as rows, newest first. */
function curatedRows(): OpportunityRow[] {
  const metrics = getMockCollection("listingMetrics");
  return getMockCollection("listings")
    .map((listing): OpportunityRow => {
      const reach = metrics.find((entry) => entry.listingId === listing.id);
      return {
        id: listing.id,
        source: "curated",
        type: listing.type,
        title: listing.title,
        company: listing.organisation,
        country: listing.country,
        date: listing.publishedAt ?? listing.createdAt,
        status: listing.status,
        vetting: listing.vetted ? "vetted" : "unvetted",
        applicantsCount: reach ? reach.applications.website + reach.applications.app : undefined,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function loadOpportunityRows(): Promise<OpportunityRow[]> {
  if (isMockMode()) {
    const hirer = overlayRows("opportunities", postedOpportunities).map(
      (opportunity): OpportunityRow => ({
        id: opportunity.id,
        source: "hirer",
        type: HIRER_TYPES[opportunity.type] ?? "job",
        title: opportunity.title,
        company: opportunity.company,
        country: countryOfLocation(opportunity.location),
        date: opportunity.date,
        status: opportunity.moderationStatus,
        applicantsCount: opportunity.applicantsCount,
      }),
    );
    return afterDelay([...curatedRows(), ...hirer]);
  }
  const posted = (await getOpportunities()) as { id: string; type: string; title: string; company: string; location?: string; date: string; moderationStatus: string; applicantsCount?: number }[];
  const hirer = posted.map(
    (opportunity): OpportunityRow => ({
      id: opportunity.id,
      source: "hirer",
      type: HIRER_TYPES[opportunity.type] ?? "job",
      title: opportunity.title,
      company: opportunity.company,
      country: opportunity.location ? countryOfLocation(opportunity.location) : undefined,
      date: opportunity.date,
      status: opportunity.moderationStatus,
      applicantsCount: opportunity.applicantsCount,
    }),
  );
  return [...curatedRows(), ...hirer];
}
