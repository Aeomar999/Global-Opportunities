/**
 * Types for the desk's entities. They stay SEPARATE in the data model and in the UI:
 *
 * - Listing         a curated Opportunity: a public listing, gated by vetting (not the same as a Program)
 * - Program         one of GOD's own activities (a training, a cohort, a campaign)
 * - Partner         an organisation in the six-stage pipeline, with the history of its stage changes
 * - Ambassador      someone who amplifies listings with a referral code (the Network)
 * - DatabaseRecord  a beneficiary kept in the desk's database
 * - SocialPost, Testimonial, MonthlyReport   the desk's content
 * - StaffMember     the people behind the roles: ONE collection read by the Team page, the invite form, the member
 *                   page and the scorecards
 * - Target          a monthly goal for one KPI (the Settings screen will edit them)
 *
 * Dates are ISO strings ("2026-10-03" or a full ISO time). Every foreign key (partnerId, ambassadorId, listingId,
 * authorId...) points at an id that exists in the seed; src/lib/mock-seed.ts builds the data and the tests check
 * the links. The shared mock store (mock-store.ts) holds one collection per type.
 */
import type { KpiKey } from "@/config/kpis";
import type { Role } from "@/config/roles";

/** A month as "YYYY-MM". */
export type MonthKey = string;

// ---- Listings (curated opportunities) ---------------------------------------------------------------
export const LISTING_TYPES = ["job", "internship", "scholarship", "fellowship", "grant", "event"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];
export type ListingStatus = "draft" | "published";
export const LISTING_FORMATS = ["online", "in-person", "hybrid"] as const;
export type ListingFormat = (typeof LISTING_FORMATS)[number];

export interface Listing {
  id: string;
  title: string;
  organisation: string;
  type: ListingType;
  country: string;
  status: ListingStatus;
  /** Public only after vetting: a published listing is always vetted. */
  vetted: boolean;
  createdAt: string;
  /** Set when status is "published". */
  publishedAt?: string;
  /** The application deadline. */
  closesAt: string;
  description: string;
  /** The official application link. */
  applyUrl: string;
  /** "Free", "USD 50"... */
  costLabel?: string;
  format: ListingFormat;
  /** Free text ("Accra, Ghana"). */
  location?: string;
  /** Local date and time of an event ("2026-11-12T10:00"). */
  eventAt?: string;
  /** "3 months", "2 days"... */
  durationLabel?: string;
  /** Image URLs (an object URL for a new pick, or a saved URL). */
  logoUrl?: string;
  imageUrl?: string;
  /** The staff member who writes about the listing. */
  writerId?: string;
  /** Adds the ambassador's referral code to the apply link. */
  referralOnApply: boolean;
  /** Who vetted it, and the day. Both are set together with `vetted`. */
  vettedById?: string;
  vettedOn?: string;
}

/** Views and applications of one listing, split by where they came from. */
export interface ListingMetrics {
  listingId: string;
  views: { website: number; app: number };
  applications: { website: number; app: number };
}

// ---- Programs ---------------------------------------------------------------------------------------
export const PROGRAM_TYPES = ["training", "bootcamp", "webinar", "outreach", "project", "mentorship", "event"] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];
export const PROGRAM_FORMATS = ["online", "in-person", "hybrid"] as const;
export type ProgramFormat = (typeof PROGRAM_FORMATS)[number];
export const PROGRAM_STATUSES = ["planned", "running", "delivered", "cancelled"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export interface Program {
  id: string;
  name: string;
  type: ProgramType;
  status: ProgramStatus;
  country: string;
  /** A date ("2026-10-03") or a local date and time ("2026-10-03T09:00"). */
  startAt: string;
  endAt: string;
  /** Set when status is "delivered": the day it was delivered. This decides the month it counts in. */
  deliveredAt?: string;
  partnerId?: string;
  /** How many people are in it now. */
  participants: number;
  /** How many people it aims for (at least 1). */
  target: number;
  format: ProgramFormat;
  /** Free text ("Accra", "Online"). */
  location?: string;
  /** Names of the people who run it. */
  facilitators: string[];
  notes?: string;
}

// ---- Partners ---------------------------------------------------------------------------------------
/** The six stages, in order. Moving to "onboard" or "renew" closes the deal and counts as onboarding a partner. */
export const PARTNER_STAGES = ["prospect", "outreach", "proposal", "mou", "onboard", "renew"] as const;
export type PartnerStage = (typeof PARTNER_STAGES)[number];

export const PARTNER_STAGE_LABELS: Record<PartnerStage, string> = {
  prospect: "Prospect",
  outreach: "Outreach",
  proposal: "Proposal",
  mou: "MOU",
  onboard: "Onboard",
  renew: "Renew",
};

/** The stages in which a deal is closed. */
export const CLOSED_STAGES: readonly PartnerStage[] = ["onboard", "renew"];

/**
 * A partner is CLOSED when its stage is onboard or renew. It is derived from the stage and never stored
 * on its own, so it cannot disagree with it.
 */
export const isPartnerClosed = (partner: Pick<Partner, "stage">): boolean => CLOSED_STAGES.includes(partner.stage);

/** The day a partner first reached onboard or renew, or undefined while it is still open. Derived from the history. */
export const partnerClosedAt = (partner: Pick<Partner, "stageHistory">): string | undefined =>
  partner.stageHistory.find((entry) => CLOSED_STAGES.includes(entry.stage))?.at;

export interface PartnerStageEntry {
  stage: PartnerStage;
  at: string;
}

export interface Partner {
  id: string;
  name: string;
  country: string;
  sector: string;
  contactName: string;
  /** The current stage: always the last entry of stageHistory. */
  stage: PartnerStage;
  stageHistory: PartnerStageEntry[];
}

// ---- Ambassadors (the Network) ----------------------------------------------------------------------
export const AMBASSADOR_TIERS = ["starter", "rising", "champion"] as const;
export type AmbassadorTier = (typeof AMBASSADOR_TIERS)[number];
export const AMBASSADOR_STATUSES = ["applicant", "onboarding", "active", "dormant"] as const;
export type AmbassadorStatus = (typeof AMBASSADOR_STATUSES)[number];

export interface Ambassador {
  id: string;
  name: string;
  email: string;
  /** The code that credits a referral to this ambassador, unique ("GOD-7K2M4Q"). */
  referralCode: string;
  campus: string;
  country: string;
  tier: AmbassadorTier;
  status: AmbassadorStatus;
  joinedAt: string;
  /** For a dormant ambassador: when they went quiet (they counted as active before that). */
  dormantSince?: string;
}

/** One amplification: an ambassador shared a listing on a channel and it brought clicks and applications. */
export interface AmplificationLog {
  id: string;
  ambassadorId: string;
  listingId: string;
  channel: SocialPlatform;
  at: string;
  clicks: number;
  applications: number;
}

// ---- Database records (beneficiaries) ---------------------------------------------------------------
export const RECORD_SOURCES = ["ambassador", "website", "event", "partner", "referral", "social"] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

export interface DatabaseRecord {
  id: string;
  name: string;
  country: string;
  institution: string;
  source: RecordSource;
  verified: boolean;
  createdAt: string;
  /** Set when verified. This decides the month it counts in. */
  verifiedAt?: string;
  ambassadorId?: string;
  listingId?: string;
}

// ---- Social, testimonials, reports ------------------------------------------------------------------
export const SOCIAL_PLATFORMS = ["instagram", "linkedin", "x", "facebook", "tiktok", "whatsapp"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialPostStatus = "draft" | "scheduled" | "published";

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  text: string;
  status: SocialPostStatus;
  /** The publish (or planned) date. */
  postedAt: string;
  reach: number;
  engagement: number;
  authorId: string;
}

export const TESTIMONIAL_STATUSES = ["pending", "approved", "unpublished", "rejected"] as const;
export type TestimonialStatus = (typeof TESTIMONIAL_STATUSES)[number];

export interface Testimonial {
  id: string;
  author: string;
  /** "Software engineer, Accra" */
  role: string;
  quote: string;
  status: TestimonialStatus;
  submittedAt: string;
}

/**
 * A generated monthly report. `reportMonth` is the month it COVERS; `generatedAt` is the day it was generated.
 * The "Monthly reports" KPI counts reports by the calendar month of generatedAt (see config/kpis.ts).
 */
export interface MonthlyReport {
  id: string;
  reportMonth: MonthKey;
  generatedAt: string;
}

/** Website audience for one month. The current month is month-to-date. */
export interface WebsiteMonth {
  month: MonthKey;
  views: number;
  /** Averages per day. */
  dailyFirstVisits: number;
  dailyVisitors: number;
  /** Where the visits came from; the visits add up to `views`. */
  channels: { channel: string; views: number }[];
}

// ---- People and goals -------------------------------------------------------------------------------
export type StaffStatus = "active" | "suspended";

/**
 * A member of the team: the ONE staff collection. The Team page, the invite form, /staff/[id] and the scorecards
 * all read it, so a person exists once. Ids of the first three accounts (staff-1, staff-2, staff-3) are kept, so
 * existing links keep working.
 */
export interface StaffMember {
  id: string;
  name: string;
  email: string;
  /** One or two roles. */
  roles: Role[];
  status: StaffStatus;
  /** ISO date. */
  joinedDate: string;
  title?: string;
  country?: string;
  /** True for the one person that the signed-in dev user is mapped to. */
  isCurrentUser?: boolean;
}

/** The monthly target for one KPI. */
export interface Target {
  id: string;
  kpi: KpiKey;
  target: number;
}

/** When a KPI turns green, amber or red: attainment (value / pro-rated target) at or above `green` is green, at or above `amber` is amber. */
export interface KpiThresholds {
  green: number;
  amber: number;
}

/** Every entity collection of the mock store, by name. */
export interface EntityCollections {
  programs: Program[];
  partners: Partner[];
  ambassadors: Ambassador[];
  databaseRecords: DatabaseRecord[];
  socialPosts: SocialPost[];
  testimonials: Testimonial[];
  listings: Listing[];
  listingMetrics: ListingMetrics[];
  amplificationLogs: AmplificationLog[];
  monthlyReports: MonthlyReport[];
  websiteMonths: WebsiteMonth[];
  staff: StaffMember[];
  targets: Target[];
}

export type EntityName = keyof EntityCollections;
