/**
 * The ONE source of every mock-mode count, derived from the mock lists so the numbers
 * agree everywhere they appear:
 *
 *   sidebar pills, the breadcrumb pill and the Overview's "Needs your attention" card all read from here, and the list pages show the same
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
import { getMockCollection, overlayRows } from "@/lib/mock-store";
import { reports as baseReports } from "@/lib/mock-reports";

/**
 * The mock lists with this session's changes laid over them (see mock-store.ts). Approve the last
 * pending document and these counts drop by one everywhere at once.
 */
const pendingCompanies = () => overlayRows("verification", basePendingCompanies);
const reports = () => overlayRows("reports", baseReports);

export function getMockCounts() {
  return {
    pendingVerifications: pendingCompanies().filter((company) => company.overallStatus === "pending").length,
    openReports: reports().filter((report) => report.status === "open").length,
    // Database records still waiting to be verified (live: verifying one moves the sidebar pill at once).
    pendingRecords: getMockCollection("databaseRecords").filter((record) => !record.verified).length,
    // Testimonials waiting for a decision (live: approving or rejecting one moves the sidebar pill at once).
    pendingTestimonials: getMockCollection("testimonials").filter((testimonial) => testimonial.status === "pending").length,
    // Listings still waiting to be vetted: drafts that are not vetted yet (live: the Overview's "Needs your attention" card).
    draftListings: getMockCollection("listings").filter((listing) => listing.status === "draft" && !listing.vetted).length,
    // Scale placeholders (see the header): intentionally NOT derived from their lists.
    activeSeekers: 1284,
    activeHirers: 142,
  };
}

/** The counts before any change is made (a fresh page load). Live values: getMockCounts(). */
export const MOCK_COUNTS = getMockCounts();

/** The two counts the sidebar pills and breadcrumb pill can show (live). */
export function getMockNavCounts() {
  const { pendingVerifications, openReports, pendingRecords, pendingTestimonials } = getMockCounts();
  return { pendingVerifications, openReports, pendingRecords, pendingTestimonials };
}

/** The same counts before any change (a fresh page load). */
export const MOCK_NAV_COUNTS = getMockNavCounts();

