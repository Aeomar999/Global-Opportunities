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

/**
 * The day a partner closed: the first entry of the closed stretch it is in NOW (onboard, then maybe renew), or undefined
 * while it is open. A partner moved back out of onboard is open again, so it no longer counts as onboarded; if it closes
 * once more, the new closing day counts. Derived from the history.
 */
export const partnerClosedAt = (partner: Pick<Partner, "stageHistory">): string | undefined => {
  let at: string | undefined;
  for (let i = partner.stageHistory.length - 1; i >= 0; i--) {
    const entry = partner.stageHistory[i];
    if (!CLOSED_STAGES.includes(entry.stage)) break;
    at = entry.at;
  }
  return at;
};

/**
 * One step of a partner's history: it entered `stage` on `at`, coming `from` the stage before (undefined for the
 * first entry, when the partner was added). The from-to pair of every move is therefore always recorded.
 */
export interface PartnerStageEntry {
  stage: PartnerStage;
  at: string;
  from?: PartnerStage;
}

export const PARTNER_TYPES = ["corporate", "university", "foundation", "ngo", "government", "media_tech"] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];
export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  corporate: "Corporate",
  university: "University",
  foundation: "Foundation",
  ngo: "NGO",
  government: "Government",
  media_tech: "Media & tech",
};

export interface Partner {
  id: string;
  name: string;
  country: string;
  sector: string;
  type: PartnerType;
  /** The staff member who looks after this partner. */
  ownerId: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  /** One line: what they provide to the desk ("Graduate roles and internships"). */
  provides: string;
  /** How the desk found them ("Ambassador introduction"). */
  sourcedVia?: string;
  notes?: string;
  /** The current stage: always the last entry of stageHistory. */
  stage: PartnerStage;
  stageHistory: PartnerStageEntry[];
}

// ---- Ambassadors (the Network) ----------------------------------------------------------------------
export const AMBASSADOR_TIERS = ["ambassador", "senior", "lead"] as const;
export type AmbassadorTier = (typeof AMBASSADOR_TIERS)[number];
export const AMBASSADOR_TIER_LABELS: Record<AmbassadorTier, string> = {
  ambassador: "Ambassador",
  senior: "Senior Ambassador",
  lead: "Campus or Regional Lead",
};
/** Shorter wording for list columns (the full name stays in the form, the detail page and the filter). */
export const AMBASSADOR_TIER_SHORT_LABELS: Record<AmbassadorTier, string> = { ambassador: "Ambassador", senior: "Senior Ambassador", lead: "Regional Lead" };
export const MEMBER_TYPES = ["student", "graduate", "staff", "volunteer"] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];
export const MEMBER_TYPE_LABELS: Record<MemberType, string> = { student: "Student", graduate: "Graduate", staff: "Campus staff", volunteer: "Volunteer" };
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
  city: string;
  phone?: string;
  /** A picked image (an object URL for a new pick). Without one the initials avatar shows. */
  photoUrl?: string;
  memberType: MemberType;
  description?: string;
  /** "Campus Lead, KNUST" */
  roleTitle?: string;
  /** The staff member this ambassador reports to. */
  assignedLeadId?: string;
  /** Finished the desk's ambassador training. */
  trained: boolean;
  /** The seeker account this ambassador also has (optional). */
  linkedSeekerId?: string;
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
  /** The listing that was shared; a share logged by hand on the Network page may not name one. */
  listingId?: string;
  /** A note typed when the share was logged by hand. */
  note?: string;
  channel: SocialPlatform;
  at: string;
  clicks: number;
  applications: number;
}

// ---- Database records (beneficiaries) ---------------------------------------------------------------
export const RECORD_SOURCES = ["organic", "ambassador", "event", "partner", "import"] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];
/** The words for each source (the pill, the filter and the legend). */
export const RECORD_SOURCE_LABELS: Record<RecordSource, string> = {
  organic: "Organic",
  ambassador: "Ambassador referral",
  event: "Event",
  partner: "Partner channel",
  import: "Bulk import",
};

export interface DatabaseRecord {
  id: string;
  name: string;
  /** Used to spot a duplicate (compared without case or surrounding spaces). */
  email: string;
  /** Used to spot a duplicate (compared without spaces, dashes or the country prefix). */
  phone?: string;
  country: string;
  institution: string;
  source: RecordSource;
  verified: boolean;
  /** The day the record was added. */
  createdAt: string;
  /** The staff member who added it. */
  addedById?: string;
  /** Set when verified. This decides the month it counts in. */
  verifiedAt?: string;
  /** Only for the source "ambassador" (a referral). */
  ambassadorId?: string;
  /** The opportunity the person came in through (optional). */
  listingId?: string;
}

// ---- Social, testimonials, reports ------------------------------------------------------------------
export const SOCIAL_PLATFORMS = ["instagram", "linkedin", "x", "facebook", "tiktok", "whatsapp"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialPostStatus = "draft" | "scheduled" | "published";

/** The platforms a post can be logged on (a superset of the amplification channels above). */
export const SOCIAL_POST_PLATFORMS = ["facebook", "instagram", "x", "linkedin", "tiktok", "youtube", "whatsapp", "other"] as const;
export type PostPlatform = (typeof SOCIAL_POST_PLATFORMS)[number];
export const POST_PLATFORM_LABELS: Record<PostPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  other: "Other",
};

export interface SocialPost {
  id: string;
  platform: PostPlatform;
  /** The headline of the post (what the list shows). */
  title: string;
  /** The link to the post on the platform. */
  url?: string;
  /** The opportunity the post promotes (optional). */
  listingId?: string;
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
  /** Staff only: never shown in the public preview. */
  email: string;
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
  /** Which template it was generated from: the partner report or the internal team report. */
  view: "partner" | "team";
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

/** The monthly target for one KPI: the one that applied from the start. Changes made in Settings are TargetChange rows on top of it. */
export interface Target {
  id: string;
  kpi: KpiKey;
  target: number;
}

/**
 * A change of target, saved in Settings: from `effectiveFrom` (a month, "2026-10") the KPI's target is `value`. Rows are only ever
 * ADDED, never edited (a second save for the same KPI and month is a new row, and the later row wins): earlier months keep the target that
 * applied then. `previous` is the target that was in force in that month before the change, and `changedBy` and `changedAt` say who saved
 * it and on what day (the Change history list on Settings > Targets).
 */
export interface TargetChange {
  id: string;
  kpi: KpiKey;
  value: number;
  effectiveFrom: MonthKey;
  previous?: number;
  changedBy?: string;
  /** "YYYY-MM-DD", the day it was saved. */
  changedAt?: string;
  /** The order of saving across targets AND thresholds (1, 2, 3 ...): the Change history is sorted by it. */
  seq?: number;
}

/**
 * The status thresholds that apply from `effectiveFrom` (a month), exactly like a TargetChange. The seed has ONE row, effective from the
 * first month of the data (the default 95% and 70%); Settings only ever appends rows. `previous` is what applied in that month before a
 * change (a row without it is the starting point, not a change).
 */
export interface ThresholdChange extends KpiThresholds {
  id: string;
  effectiveFrom: MonthKey;
  previous?: KpiThresholds;
  changedBy?: string;
  changedAt?: string;
  seq?: number;
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
  targetHistory: TargetChange[];
  thresholdHistory: ThresholdChange[];
}

export type EntityName = keyof EntityCollections;
