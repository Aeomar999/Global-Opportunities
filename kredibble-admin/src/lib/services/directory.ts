/**
 * Data loaders for the Seekers and Hirers directories and their detail pages.
 *
 * They follow the same switch as the Overview (see mock-mode.ts):
 * - Mock mode: the mock accounts WITH this session's changes laid over them (mock-store.ts).
 * - Real mode: the admin data API (GET /admin/seekers, /admin/hirers and their /:id routes, via lib/api.ts),
 *   mapped to the same shapes the pages already use. The API has no suspension flag, so every real account
 *   is shown as "active"; counts the API does not send are 0 and text it does not send is "—".
 *
 * The list loaders return ALL rows (the API is read page by page, 100 at a time); the pages filter and count on
 * the client, as they do for the mock data. Errors reject with the server's message and the pages show them
 * inline with a retry button. A missing record resolves with undefined (the pages show "not found").
 */
import { getHirerById, getHirers, getSeekerById, getSeekers, type HirerAccount as ApiHirer, type SeekerProfile } from "@/lib/api";
import { hirerAccounts, type HirerAccount } from "@/lib/mock-hirers";
import { seekerAccounts, type SeekerAccount } from "@/lib/mock-seekers";
import { overlayRows } from "@/lib/mock-store";
import { MISSING, fetchAll, orMissing } from "./api-helpers";
import { isMockMode } from "./mock-mode";

function toSeeker(profile: SeekerProfile): SeekerAccount {
  return {
    id: profile.id,
    name: profile.fullName || profile.name || profile.email,
    email: profile.email,
    profession: profile.profession || MISSING,
    university: MISSING, // the API has no university field
    country: profile.country || MISSING,
    joinedDate: profile.createdAt,
    applicationsCount: profile.applicationsCount ?? 0,
    savedCount: profile.savedCount ?? 0,
    status: "active",
  };
}

function toHirer(account: ApiHirer): HirerAccount {
  // The review page approves a case as "approved"; on a hirer that reads "verified".
  const caseStatus = account.overallStatus === "approved" ? "verified" : account.overallStatus;
  const summary = caseStatus === "verified" || caseStatus === "rejected" || caseStatus === "pending" ? caseStatus : account.verified ? "verified" : "pending";
  return {
    id: account.id,
    companyName: account.companyName,
    recruiterName: account.recruiterName || account.user?.name || MISSING,
    recruiterEmail: account.recruiterEmail || account.companyEmail,
    industry: account.industry || MISSING,
    location: account.location || MISSING,
    joinedDate: account.createdAt,
    postingsCount: account.postingsCount ?? 0,
    verification: summary,
    status: "active",
    linkedVerificationId: account.linkedVerificationId,
  };
}

export async function loadSeekerRows(): Promise<SeekerAccount[]> {
  if (isMockMode()) return overlayRows("seekers", seekerAccounts);
  return (await fetchAll((page, limit) => getSeekers({ page, limit }))).map(toSeeker);
}

export async function loadSeeker(id: string): Promise<SeekerAccount | undefined> {
  if (isMockMode()) return seekerAccounts.find((seeker) => seeker.id === id);
  return getSeekerById(id).then(toSeeker, orMissing<SeekerAccount>);
}

export async function loadHirerRows(): Promise<HirerAccount[]> {
  if (isMockMode()) return overlayRows("hirers", hirerAccounts);
  return (await fetchAll((page, limit) => getHirers({ page, limit }))).map(toHirer);
}

export async function loadHirer(id: string): Promise<HirerAccount | undefined> {
  if (isMockMode()) return hirerAccounts.find((hirer) => hirer.id === id);
  return getHirerById(id).then(toHirer, orMissing<HirerAccount>);
}
