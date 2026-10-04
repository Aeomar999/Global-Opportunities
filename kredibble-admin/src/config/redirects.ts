/**
 * Route redirects, read by next.config.ts.
 *
 * The merged pages are real routes now:
 *   /reference-data   (was Seeker, Hirer and Grants Taxonomy)
 *   /notifications    (was Notification Composer and History)
 *   /team             (was Staff and Roles & Permissions)
 * and every old URL redirects to its new home, so bookmarks and typed URLs keep working.
 * They are permanent (308): the old pages no longer exist.
 *
 * Nothing in this list may point at another entry of this list (a destination is always a real page),
 * so a redirect can never chain or loop. tests/admin.e2e.spec.ts checks that.
 *
 * Not redirected on purpose: /staff/invite and /staff/[id]. They are still real pages (the invite form and
 * a member's detail page) that live under Team; only the bare /staff list moved.
 */
export interface RedirectRule {
  source: string;
  destination: string;
  permanent: boolean;
}

export const ACTIVE_REDIRECTS: RedirectRule[] = [
  { source: "/taxonomy/seeker", destination: "/reference-data", permanent: true },
  { source: "/taxonomy/hirer", destination: "/reference-data?tab=hirer", permanent: true },
  { source: "/taxonomy/grants", destination: "/reference-data?tab=grants", permanent: true },
  { source: "/notifications/compose", destination: "/notifications", permanent: true },
  { source: "/notifications/history", destination: "/notifications?tab=history", permanent: true },
  { source: "/staff", destination: "/team", permanent: true },
  { source: "/roles", destination: "/team?tab=roles", permanent: true },
];
