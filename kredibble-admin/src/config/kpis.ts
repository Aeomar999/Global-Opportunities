/**
 * KPIs: the ten numbers the desk is measured on every month.
 *
 * Each definition has a stable key, a label, the unit it is counted in, the roles that OWN it (the people held
 * to the number on their scorecard), a one-line note on exactly what is counted, and the screen it links to.
 *
 * The role ownership below is EDITABLE: change the lists in OWNERS and every scorecard, dashboard card and
 * filter follows. The desk lead owns all ten; admin support owns none; super admin owns none (it sees everything
 * through its all-access role, not through a scorecard).
 *
 * How two of them are counted (the rest are in kpi.ts):
 * - Partners onboarded: a partner counts in a month when it moved to Onboard or Renew in it. A partner is CLOSED when its
 *   stage is onboard or renew; "closed" is derived from the stage and never stored on its own.
 * - Monthly reports: each report is stored with reportMonth (the month it COVERS) and generatedAt (when it was generated).
 *   The KPI counts reports by the calendar month of generatedAt. The Download PDF step will add ONE record for the viewed
 *   reportMonth with generatedAt = now, at most once for each reportMonth in each calendar month of generation
 *   (shouldRecordReport in kpi.ts decides). The report for last month is normally generated early this month.
 *
 * Targets and the green/amber thresholds are NOT here: they are stored values (see mock-store.ts) that the
 * Settings screen will edit. Values are computed by src/lib/kpi.ts.
 */
import type { Screen } from "@/config/permissions";
import type { Role } from "@/config/roles";

export const KPI_KEYS = [
  "opportunities_published",
  "programs_organised",
  "active_ambassadors",
  "partners_onboarded",
  "beneficiaries_verified",
  "social_reach",
  "social_engagement",
  "posts_published",
  "website_views",
  "monthly_reports",
] as const;

export type KpiKey = (typeof KPI_KEYS)[number];

export interface KpiDefinition {
  key: KpiKey;
  label: string;
  /** What one unit is, as a plural noun: "listings", "views". */
  unit: string;
  /** Roles held to this number. */
  owners: Role[];
  /** One line: exactly what is counted. */
  note: string;
  /** The screen to open for the detail behind the number. */
  screen: Screen;
}

/** Who owns what (editable). The desk lead is added to every KPI below. */
const OWNERS: Record<KpiKey, Role[]> = {
  opportunities_published: ["opportunities_officer"],
  programs_organised: ["training_officer"],
  active_ambassadors: ["country_lead"],
  partners_onboarded: ["partnerships_officer"],
  beneficiaries_verified: ["database_officer"],
  social_reach: ["social_media_manager"],
  social_engagement: ["social_media_manager"],
  posts_published: ["social_media_manager"],
  website_views: ["communications_officer"],
  monthly_reports: ["communications_officer"],
};

const owned = (key: KpiKey): Role[] => [...OWNERS[key], "desk_lead"];

export const KPIS: Record<KpiKey, KpiDefinition> = {
  opportunities_published: {
    key: "opportunities_published",
    label: "Opportunities published",
    unit: "listings",
    owners: owned("opportunities_published"),
    note: "Vetted listings published this month",
    screen: "opportunities_queue",
  },
  programs_organised: {
    key: "programs_organised",
    label: "Programs organised",
    unit: "programs",
    owners: owned("programs_organised"),
    note: "Delivered programs this month",
    screen: "programs",
  },
  active_ambassadors: {
    key: "active_ambassadors",
    label: "Active ambassadors",
    unit: "ambassadors",
    owners: owned("active_ambassadors"),
    note: "Running total: ambassadors who are active at the end of the month",
    screen: "network",
  },
  partners_onboarded: {
    key: "partners_onboarded",
    label: "Partners onboarded",
    unit: "partners",
    owners: owned("partners_onboarded"),
    note: "Partners that moved to Onboard or Renew (a closed deal) this month",
    screen: "partners",
  },
  beneficiaries_verified: {
    key: "beneficiaries_verified",
    label: "Beneficiaries verified",
    unit: "records",
    owners: owned("beneficiaries_verified"),
    note: "Database records verified this month",
    screen: "database",
  },
  social_reach: {
    key: "social_reach",
    label: "Social reach",
    unit: "people reached",
    owners: owned("social_reach"),
    note: "Total reach of posts published this month",
    screen: "social",
  },
  social_engagement: {
    key: "social_engagement",
    label: "Social engagement",
    unit: "interactions",
    owners: owned("social_engagement"),
    note: "Likes, comments, shares and clicks on posts published this month",
    screen: "social",
  },
  posts_published: {
    key: "posts_published",
    label: "Posts published",
    unit: "posts",
    owners: owned("posts_published"),
    note: "Social posts published this month",
    screen: "social",
  },
  website_views: {
    key: "website_views",
    label: "Website views",
    unit: "views",
    owners: owned("website_views"),
    note: "Page views on the website this month",
    screen: "monthly_report",
  },
  monthly_reports: {
    key: "monthly_reports",
    label: "Monthly reports",
    unit: "reports",
    owners: owned("monthly_reports"),
    note: "Monthly reports generated this month",
    screen: "monthly_report",
  },
};

/** The KPIs a set of roles owns (their scorecard). A person with two roles owns the union, in the usual order. */
export const kpisOwnedBy = (roles: readonly Role[]): KpiDefinition[] =>
  KPI_KEYS.map((key) => KPIS[key]).filter((kpi) => kpi.owners.some((owner) => roles.includes(owner)));
