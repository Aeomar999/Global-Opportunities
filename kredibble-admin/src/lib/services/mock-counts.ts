/**
 * The ONE source of every mock-mode count, derived from the mock lists so the numbers
 * agree everywhere they appear:
 *
 *   sidebar pills, the breadcrumb pill, the Overview KPI cards, the "Needs your attention"
 *   card and the Review queues rows all read from here, and the list pages show the same
 *   rows these numbers are counted from.
 *
 * - pendingVerifications = pending rows in the Verification Queue mock list
 * - openReports          = open rows in the Reports Queue mock list
 *
 * ACTIVE SEEKERS and ACTIVE HIRERS are the only counts that intentionally DIFFER from their
 * lists: the Seekers and Hirers mock directories hold a handful of sample accounts, while the
 * KPI cards need a believable platform scale, so they stay as fixed placeholders.
 *
 * This module imports only mock data (never mock-mode), so it cannot form an import cycle.
 */
import { pendingCompanies as basePendingCompanies } from "@/lib/mock-data";
import { overlayRows } from "@/lib/mock-store";
import { postedOpportunities as basePostedOpportunities } from "@/lib/mock-opportunities";
import { reports as baseReports } from "@/lib/mock-reports";

/**
 * The mock lists with this session's changes laid over them (see mock-store.ts). Approve the last
 * pending document and these counts drop by one everywhere at once.
 */
const pendingCompanies = () => overlayRows("verification", basePendingCompanies);
const postedOpportunities = () => overlayRows("opportunities", basePostedOpportunities);
const reports = () => overlayRows("reports", baseReports);

export function getMockCounts() {
  return {
    pendingVerifications: pendingCompanies().filter((company) => company.overallStatus === "pending").length,
    openReports: reports().filter((report) => report.status === "open").length,
    // Scale placeholders (see the header): intentionally NOT derived from their lists.
    activeSeekers: 1284,
    activeHirers: 142,
  };
}

/** The counts before any change is made (a fresh page load). Live values: getMockCounts(). */
export const MOCK_COUNTS = getMockCounts();

/** The two counts the sidebar pills and breadcrumb pill can show (live). */
export function getMockNavCounts() {
  const { pendingVerifications, openReports } = getMockCounts();
  return { pendingVerifications, openReports };
}

/** The same counts before any change (a fresh page load). */
export const MOCK_NAV_COUNTS = getMockNavCounts();

const percentOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : null);

/** Review-queue progress rows, derived from the same three mock lists (live). */
export function getMockQueues() {
  const companies = pendingCompanies();
  const postings = postedOpportunities();
  const reportList = reports();
  const verificationDecided = companies.filter((c) => c.overallStatus !== "pending").length;
  const opportunitiesDecided = postings.filter((o) => o.moderationStatus !== "pending").length;
  const reportsClosed = reportList.filter((r) => r.status !== "open").length;
  return [
    {
      key: "verification",
      label: "Verification reviewed",
      percent: percentOf(verificationDecided, companies.length),
      caption: `${verificationDecided} of ${companies.length} requests decided`,
    },
    {
      key: "opportunities",
      label: "Opportunities moderated",
      percent: percentOf(opportunitiesDecided, postings.length),
      caption: `${opportunitiesDecided} of ${postings.length} postings decided`,
    },
    {
      key: "reports",
      label: "Reports resolved",
      percent: percentOf(reportsClosed, reportList.length),
      caption: `${reportsClosed} of ${reportList.length} reports closed`,
    },
  ];
}
