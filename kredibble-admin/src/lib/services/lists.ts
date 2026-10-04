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
 * Each loader returns ALL rows once; the pages filter and count on the client, so a filter change
 * never triggers a request.
 */
import { getOpportunities, getVerifications } from "@/lib/api";
import { pendingCompanies } from "@/lib/mock-data";
import { overlayRows } from "@/lib/mock-store";
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

export interface OpportunityRow {
  id: string;
  type: string;
  title: string;
  company: string;
  date: string;
  moderationStatus: string;
  applicantsCount: number;
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

export function loadOpportunityRows(): Promise<OpportunityRow[]> {
  if (isMockMode()) {
    return afterDelay(
      overlayRows("opportunities", postedOpportunities).map((opportunity) => ({
        id: opportunity.id,
        type: opportunity.type,
        title: opportunity.title,
        company: opportunity.company,
        date: opportunity.date,
        moderationStatus: opportunity.moderationStatus,
        applicantsCount: opportunity.applicantsCount,
      })),
    );
  }
  return getOpportunities() as Promise<OpportunityRow[]>;
}
