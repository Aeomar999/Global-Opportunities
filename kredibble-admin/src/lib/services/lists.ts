/**
 * Data loader for the Verification Queue list page (the Opportunities Queue's is in opportunities.ts).
 *
 * They follow the same switch as the Overview (see mock-mode.ts):
 * - Mock mode (NEXT_PUBLIC_USE_MOCKS=true, or unset in development): realistic mock rows after
 *   ~400ms. They come from the same mock records the detail page uses, so every row link opens a
 *   real detail page. Together the rows cover every status the page can show (pending,
 *   approved, rejected).
 * - Real mode: GET /admin/verification/companies (existing helper in lib/api.ts).
 *   Errors reject with the server's message, and the page shows them inline with a retry button.
 *
 * Each loader returns ALL rows once; the pages filter and count on the client, so a filter change
 * never triggers a request.
 */
import { getVerifications } from "@/lib/api";
import { pendingCompanies } from "@/lib/mock-data";
import { overlayRows } from "@/lib/mock-store";
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
