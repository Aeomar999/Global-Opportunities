/**
 * Mock seed for the desk entities: fully populated, typed and DETERMINISTIC.
 *
 * - Deterministic: a fixed random seed and fixed lists, so the same call gives the same data. Dates are built
 *   RELATIVE TO TODAY (the current month and the five before it), so the dashboard always looks current.
 * - Shape of the months: five of the six months look healthy (every KPI at or near its target) and one, three
 *   months ago, is a bit weak (a missed report, no partner onboarded, fewer posts and less reach).
 * - Integrity: every foreign key resolves (partnerId, ambassadorId, listingId, authorId), referral codes are
 *   unique, a published listing is always vetted, and a partner's stage is the last entry of its history. The
 *   KPIs (src/lib/kpi.ts) are computed FROM this data, so lists, KPIs and reports can never disagree.
 *
 * The CURRENT month is month-to-date: its website views, social reach and engagement are scaled by how far into the
 * month we are (with a little deterministic variation), so they compare fairly with the pro-rated targets.
 * Past months are complete.
 *
 * Volumes: 14 listings, 12 programs, 18 partners, 40 ambassadors, 120 database records, 60 social posts,
 * 9 testimonials, 13 staff (the 3 original admin accounts and the 10 desk staff), amplification logs, one report a month, 6 months of website audience and
 * per-listing views and applications.
 *
 * Only the mock store (mock-store.ts) imports this file; components read through the store and services.
 */
import { BRAND_EMAIL_DOMAIN } from "@/config/brand";
import type { KpiKey } from "@/config/kpis";
import type {
  Ambassador,
  AmbassadorStatus,
  AmbassadorTier,
  AmplificationLog,
  DatabaseRecord,
  StaffMember,
  EntityCollections,
  KpiThresholds,
  Listing,
  ListingMetrics,
  ListingType,
  MonthlyReport,
  Partner,
  PartnerStage,
  Program,
  ProgramStatus,
  ProgramType,
  RecordSource,
  SocialPlatform,
  SocialPost,
  Target,
  Testimonial,
  TestimonialStatus,
  WebsiteMonth,
} from "@/lib/mock-entities";
import { SOCIAL_PLATFORMS } from "@/lib/mock-entities";

/** Months in the history (the current one and five before it). */
export const SERIES_MONTHS = 6;
/** The month that looks a bit weak, as a number of months ago. */
const WEAK_MONTH = 3;

/** Green at 95% of the (pro-rated) target, amber at 70%. Stored in the store, edited in Settings. */
export const DEFAULT_THRESHOLDS: KpiThresholds = { green: 0.95, amber: 0.7 };

/** Default monthly targets, sized to the seed (Settings will edit them). */
export const DEFAULT_TARGETS: Record<KpiKey, number> = {
  opportunities_published: 2,
  programs_organised: 1,
  active_ambassadors: 21,
  partners_onboarded: 1,
  beneficiaries_verified: 15,
  social_reach: 10500,
  social_engagement: 800,
  posts_published: 8,
  website_views: 12000,
  monthly_reports: 1,
};

// ------------------------------------------------------------------------------------------ date helpers
const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/** "2026-10-03" plus `days` days. */
export const addDays = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
};

/** A deterministic random generator (mulberry32). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------------------------------ people data
const FIRST_NAMES = [
  "Kwame", "Ama", "Kofi", "Abena", "Yaw", "Efua", "Kwabena", "Akosua", "Kojo", "Adwoa", "Nana", "Esi", "Kwesi", "Afia", "Yaa", "Kobby",
  "Chidi", "Ngozi", "Tunde", "Folake", "Emeka", "Zainab", "Segun", "Amaka", "Ifeanyi", "Bisi", "Obinna", "Chiamaka", "Musa", "Halima",
  "Fatou", "Aminata", "Moussa", "Mariam", "Seydou", "Awa", "Ibrahim", "Isatu", "Mohamed", "Hawa", "Wanjiru", "Otieno", "Akello", "Mugisha",
  "Nakato", "Kiprono", "Amina", "Jelani", "Thandi", "Sipho", "Naledi", "Tendai", "Rudo", "Kagiso", "Imani", "Baraka", "Neema", "Juma",
];
const LAST_NAMES = [
  "Mensah", "Owusu", "Boateng", "Asante", "Appiah", "Adjei", "Darko", "Osei", "Bonsu", "Tetteh", "Agyeman", "Frimpong", "Quaye", "Amoah",
  "Okafor", "Eze", "Adeyemi", "Balogun", "Nwosu", "Bello", "Ojo", "Okonkwo", "Abubakar", "Adebayo", "Ndiaye", "Sow", "Traore", "Keita",
  "Coulibaly", "Conteh", "Kamara", "Sesay", "Kariuki", "Otieno", "Mwangi", "Nakamya", "Ssemakula", "Mukasa", "Niyonzima", "Habimana",
];

/** Campuses with their country (the Network is campus based). */
const CAMPUSES: { name: string; country: string }[] = [
  { name: "KNUST", country: "Ghana" },
  { name: "University of Ghana", country: "Ghana" },
  { name: "Ashesi University", country: "Ghana" },
  { name: "UCC", country: "Ghana" },
  { name: "University of Lagos", country: "Nigeria" },
  { name: "Covenant University", country: "Nigeria" },
  { name: "Makerere University", country: "Uganda" },
  { name: "University of Nairobi", country: "Kenya" },
  { name: "UCAD", country: "Senegal" },
  { name: "Fourah Bay College", country: "Sierra Leone" },
];

const fullName = (index: number, shift = 0) => {
  const first = FIRST_NAMES[(index + shift) % FIRST_NAMES.length];
  const last = LAST_NAMES[(index * 7 + 3 + shift * 5) % LAST_NAMES.length];
  return `${first} ${last}`;
};
const emailOf = (name: string, domain = "example.org") => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${domain}`;

// ------------------------------------------------------------------------------------------ the builder
export interface Seed {
  collections: EntityCollections;
  thresholds: KpiThresholds;
}

export function buildSeed(today: Date = new Date()): Seed {
  const todayIso = isoDate(today);
  const elapsed = today.getUTCDate();
  const rand = mulberry32(20260301);
  const between = (low: number, high: number) => low + Math.floor(rand() * (high - low + 1));

  const monthStart = (ago: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - ago, 1));
  const daysIn = (ago: number) => {
    const start = monthStart(ago);
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  };
  /** A day inside the month `ago` months ago; fraction 0..1 picks where. The current month only reaches today. */
  const dayIn = (ago: number, fraction: number): string => {
    const available = ago === 0 ? elapsed : daysIn(ago);
    const day = 1 + Math.min(available - 1, Math.floor(fraction * available));
    return isoDate(new Date(Date.UTC(monthStart(ago).getUTCFullYear(), monthStart(ago).getUTCMonth(), day)));
  };
  const monthKey = (ago: number) => `${monthStart(ago).getUTCFullYear()}-${pad(monthStart(ago).getUTCMonth() + 1)}`;
  /** Never later than today. */
  const clamp = (iso: string) => (iso > todayIso ? todayIso : iso);

  // ---- Staff: ONE collection -----------------------------------------------------------------------------
  // The three original admin accounts keep their ids (staff-1..3) so existing links work; then the ten desk staff.
  const originals: Omit<StaffMember, "email">[] = [
    { id: "staff-1", name: "Nana Adjei", roles: ["super_admin"], status: "active", joinedDate: "2026-01-01", title: "Super Admin", country: "Ghana" },
    { id: "staff-2", name: "Efua Mensimah", roles: ["moderator"], status: "active", joinedDate: "2026-03-15", title: "Moderator", country: "Ghana" },
    { id: "staff-3", name: "Yaw Antwi", roles: ["support"], status: "active", joinedDate: "2026-06-02", title: "Support", country: "Ghana" },
  ];
  const deskSpecs: Omit<StaffMember, "id" | "email" | "status" | "joinedDate">[] = [
    { name: "Esi Mensah-Owusu", title: "Desk Lead", country: "Ghana", roles: ["desk_lead"], isCurrentUser: true },
    { name: "Kojo Appiah", title: "Partnerships Officer", country: "Ghana", roles: ["partnerships_officer"] },
    { name: "Adaeze Okonkwo", title: "Opportunities Officer and Moderator", country: "Nigeria", roles: ["opportunities_officer", "moderator"] },
    { name: "Kwabena Tetteh", title: "Training Officer and Ghana Lead", country: "Ghana", roles: ["training_officer", "country_lead"] },
    { name: "Nana Yaa Boateng", title: "Database Officer", country: "Ghana", roles: ["database_officer"] },
    { name: "Fatou Ndiaye", title: "Communications Officer", country: "Senegal", roles: ["communications_officer"] },
    { name: "Samuel Kiprono", title: "Social Media Manager", country: "Kenya", roles: ["social_media_manager"] },
    { name: "Amara Kamara", title: "Sierra Leone Lead", country: "Sierra Leone", roles: ["country_lead"] },
    { name: "Chioma Eze", title: "Admin Support", country: "Nigeria", roles: ["admin_support"] },
    { name: "Yaw Frimpong", title: "Support Agent", country: "Ghana", roles: ["support"] },
  ];
  const staff: StaffMember[] = [
    ...originals.map((person) => ({ ...person, email: emailOf(person.name, BRAND_EMAIL_DOMAIN) })),
    ...deskSpecs.map((spec, index) => ({
      ...spec,
      id: `staff-${originals.length + index + 1}`,
      email: emailOf(spec.name, BRAND_EMAIL_DOMAIN),
      status: "active" as const,
      joinedDate: addDays(todayIso, -(240 - index * 18)),
    })),
  ];
  const socialManagerId = staff.find((person) => person.roles.includes("social_media_manager"))!.id;

  // ---- Listings (curated opportunities) -----------------------------------------------------------------
  // monthsAgo: the month a published listing went live (or, for a draft, was created).
  const listingSpecs: { title: string; organisation: string; type: ListingType; country: string; monthsAgo: number; draft?: boolean; vetted?: boolean }[] = [
    { title: "Graduate Software Engineer", organisation: "MTN Ghana", type: "job", country: "Ghana", monthsAgo: 0 },
    { title: "Operations Analyst", organisation: "Jumia", type: "job", country: "Côte d'Ivoire", monthsAgo: 0 },
    { title: "Mastercard Foundation Scholars Program", organisation: "Ashesi University", type: "scholarship", country: "Ghana", monthsAgo: 1 },
    { title: "Youth Innovation Fellowship", organisation: "Africa Leadership Initiative", type: "fellowship", country: "Nigeria", monthsAgo: 1 },
    { title: "Women in Agribusiness Grant", organisation: "AGRA", type: "grant", country: "Kenya", monthsAgo: 2 },
    { title: "Pan-African Career Fair 2026", organisation: "Global Opportunity Desk", type: "event", country: "Rwanda", monthsAgo: 2 },
    { title: "Junior Product Designer", organisation: "Paystack", type: "job", country: "Nigeria", monthsAgo: WEAK_MONTH },
    { title: "Data Analyst Internship", organisation: "Flutterwave", type: "internship", country: "Nigeria", monthsAgo: 4 },
    { title: "Climate Tech Fellowship", organisation: "Wangari Maathai Institute", type: "fellowship", country: "Kenya", monthsAgo: 4 },
    { title: "STEM Scholarship for Girls", organisation: "Africa Education Trust", type: "scholarship", country: "Uganda", monthsAgo: 5 },
    { title: "Public Health Research Internship", organisation: "University of Ghana School of Public Health", type: "internship", country: "Ghana", monthsAgo: 5 },
    // drafts: one vetted and waiting to go live, two still to be vetted
    { title: "Startup Seed Grant", organisation: "Tony Elumelu Foundation", type: "grant", country: "Nigeria", monthsAgo: 0, draft: true, vetted: true },
    { title: "Virtual Graduate Employability Summit", organisation: "Global Opportunity Desk", type: "event", country: "Sierra Leone", monthsAgo: 0, draft: true, vetted: false },
    { title: "Customer Success Associate", organisation: "Wave Mobile Money", type: "job", country: "Senegal", monthsAgo: 1, draft: true, vetted: false },
  ];
  const FORMATS = ["online", "in-person", "hybrid"] as const;
  const vettingStaff = staff.filter((person) => person.roles.includes("opportunities_officer") || person.roles.includes("desk_lead"));
  const writers = staff.filter((person) => person.roles.includes("opportunities_officer") || person.roles.includes("communications_officer"));
  const listings: Listing[] = listingSpecs.map((spec, index) => {
    const created = dayIn(spec.monthsAgo, 0.15 + (index % 4) * 0.2);
    const published = !spec.draft;
    const vetted = published ? true : !!spec.vetted;
    return {
      id: `lst-${pad(index + 1)}`,
      title: spec.title,
      organisation: spec.organisation,
      type: spec.type,
      country: spec.country,
      status: published ? "published" : "draft",
      vetted,
      createdAt: addDays(created, -3),
      publishedAt: published ? created : undefined,
      closesAt: addDays(todayIso, 14 + ((index * 9) % 45)),
      description: `${spec.organisation} is offering "${spec.title}" to candidates in ${spec.country}. Read the official page for the requirements and how to apply.`,
      applyUrl: `https://example.org/apply/${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      costLabel: spec.type === "event" ? (index % 2 === 0 ? "Free" : "USD 20") : "Free to apply",
      format: spec.type === "event" ? FORMATS[index % 3] : FORMATS[(index + 1) % 3],
      location: spec.country,
      eventAt: spec.type === "event" ? `${addDays(todayIso, 30 + index)}T10:00` : undefined,
      durationLabel: spec.type === "event" ? "1 day" : spec.type === "job" ? undefined : "6 months",
      writerId: writers[index % writers.length].id,
      referralOnApply: index % 2 === 0,
      vettedById: vetted ? vettingStaff[index % vettingStaff.length].id : undefined,
      vettedOn: vetted ? (published ? created : addDays(created, -1)).slice(0, 10) : undefined,
    };
  });
  const publishedListings = listings.filter((listing) => listing.status === "published");

  const listingMetrics: ListingMetrics[] = publishedListings.map((listing) => {
    const website = between(600, 2400);
    const app = between(300, 1200);
    return {
      listingId: listing.id,
      views: { website, app },
      applications: { website: Math.round(website * (0.03 + rand() * 0.03)), app: Math.round(app * (0.04 + rand() * 0.04)) },
    };
  });

  // ---- Partners (six stages, with their history) -----------------------------------------------------------
  // path: [stage, monthsAgo] in order, so each history walks prospect -> outreach -> proposal -> mou -> onboard -> renew.
  // Spread: 4 prospect, 4 outreach, 3 proposal, 2 mou, 3 onboard, 2 renew. A partner is closed at onboard or renew.
  // Moves to onboard or renew per month, oldest to newest: 1, 2, 0 (weak), 1, 3, 0.
  type Path = [PartnerStage, number][];
  const partnerSpecs: { name: string; country: string; sector: string; contact: string; path: Path }[] = [
    // onboard (3)
    { name: "MTN Ghana", country: "Ghana", sector: "Telecoms", contact: "Efua Darko", path: [["prospect", 8], ["outreach", 7], ["proposal", 6], ["mou", 6], ["onboard", 5]] },
    { name: "Ashesi University", country: "Ghana", sector: "Education", contact: "Kwame Asante", path: [["prospect", 5], ["outreach", 4], ["proposal", 3], ["mou", 3], ["onboard", 2]] },
    { name: "KNUST Careers Office", country: "Ghana", sector: "Education", contact: "Akosua Bonsu", path: [["prospect", 4], ["outreach", 3], ["proposal", 2], ["mou", 2], ["onboard", 1]] },
    // renew (2)
    { name: "Flutterwave", country: "Nigeria", sector: "Fintech", contact: "Tunde Adeyemi", path: [["prospect", 8], ["outreach", 7], ["proposal", 6], ["mou", 5], ["onboard", 4], ["renew", 1]] },
    { name: "Mastercard Foundation", country: "Ghana", sector: "Philanthropy", contact: "Abena Owusu", path: [["prospect", 9], ["outreach", 8], ["proposal", 6], ["mou", 5], ["onboard", 4], ["renew", 1]] },
    // mou (2)
    { name: "Andela", country: "Nigeria", sector: "Technology", contact: "Emeka Nwosu", path: [["prospect", 5], ["outreach", 4], ["proposal", 2], ["mou", 1]] },
    { name: "Paystack", country: "Nigeria", sector: "Fintech", contact: "Ngozi Eze", path: [["prospect", 6], ["outreach", 4], ["proposal", 2], ["mou", 0]] },
    // proposal (3)
    { name: "Tony Elumelu Foundation", country: "Nigeria", sector: "Philanthropy", contact: "Folake Balogun", path: [["prospect", 3], ["outreach", 2], ["proposal", 0]] },
    { name: "Safaricom", country: "Kenya", sector: "Telecoms", contact: "Wanjiru Kariuki", path: [["prospect", 3], ["outreach", 1], ["proposal", 0]] },
    { name: "AGRA", country: "Kenya", sector: "Agriculture", contact: "Otieno Mwangi", path: [["prospect", 4], ["outreach", 2], ["proposal", 1]] },
    // outreach (4)
    { name: "Jumia", country: "Côte d'Ivoire", sector: "E-commerce", contact: "Mariam Coulibaly", path: [["prospect", 2], ["outreach", 1]] },
    { name: "Orange Senegal", country: "Senegal", sector: "Telecoms", contact: "Fatou Ndiaye", path: [["prospect", 2], ["outreach", 0]] },
    { name: "Ecobank", country: "Ghana", sector: "Banking", contact: "Kofi Adjei", path: [["prospect", 3], ["outreach", 1]] },
    { name: "Stanbic IBTC", country: "Nigeria", sector: "Banking", contact: "Chidi Okafor", path: [["prospect", 1], ["outreach", 0]] },
    // prospect (4)
    { name: "Google Africa", country: "Kenya", sector: "Technology", contact: "Amina Bello", path: [["prospect", 1]] },
    { name: "University of Ghana Careers", country: "Ghana", sector: "Education", contact: "Adwoa Tetteh", path: [["prospect", 0]] },
    { name: "Wave Mobile Money", country: "Senegal", sector: "Fintech", contact: "Seydou Keita", path: [["prospect", 1]] },
    { name: "Africa Leadership University", country: "Rwanda", sector: "Education", contact: "Nakato Mukasa", path: [["prospect", 0]] },
  ];
  const partners: Partner[] = partnerSpecs.map((spec, index) => {
    // Entries in the same month are spread in order; earlier months come first.
    const history = spec.path.map(([stage, ago], step) => ({ stage, at: clamp(dayIn(ago, 0.2 + step * 0.12)) }));
    return {
      id: `ptn-${pad(index + 1)}`,
      name: spec.name,
      country: spec.country,
      sector: spec.sector,
      contactName: spec.contact,
      stage: history[history.length - 1].stage,
      stageHistory: history,
    };
  });

  // ---- Programs -------------------------------------------------------------------------------------------
  // endAgo is the month a delivered program ended. Delivered per month: 1, 1, 0 (weak), 2, 1, 1.
  const programSpecs: { name: string; type: ProgramType; status: ProgramStatus; country: string; endAgo?: number; partner?: number; people: number }[] = [
    { name: "CV and Interview Masterclass", type: "training", status: "delivered", country: "Ghana", endAgo: 5, partner: 0, people: 140 },
    { name: "Remote Work Readiness Cohort", type: "bootcamp", status: "delivered", country: "Nigeria", endAgo: 4, partner: 1, people: 60 },
    { name: "Scholarship Application Clinic", type: "outreach", status: "delivered", country: "Kenya", endAgo: 2, people: 85 },
    { name: "Women in Tech Webinar Series", type: "webinar", status: "delivered", country: "Ghana", endAgo: 2, partner: 1, people: 310 },
    { name: "Campus Ambassador Bootcamp", type: "bootcamp", status: "delivered", country: "Uganda", endAgo: 1, people: 45 },
    { name: "Graduate Employability Summit Prep", type: "event", status: "delivered", country: "Sierra Leone", endAgo: 0, partner: 2, people: 120 },
    { name: "Career Mentorship Circle", type: "mentorship", status: "running", country: "Ghana", partner: 4, people: 38 },
    { name: "Digital Skills Cohort 3", type: "project", status: "running", country: "Nigeria", partner: 6, people: 72 },
    { name: "Study Abroad Info Campaign", type: "outreach", status: "running", country: "Rwanda", people: 0 },
    { name: "Entrepreneurship Pitch Day", type: "event", status: "planned", country: "Kenya", partner: 7, people: 0 },
    { name: "Climate Careers Webinar", type: "webinar", status: "planned", country: "Senegal", people: 0 },
    { name: "Regional Hackathon", type: "project", status: "cancelled", country: "Côte d'Ivoire", endAgo: 2, people: 0 },
  ];
  const CITIES: Record<string, string> = { Ghana: "Accra", Nigeria: "Lagos", Kenya: "Nairobi", Uganda: "Kampala", "Sierra Leone": "Freetown", Rwanda: "Kigali", Senegal: "Dakar", "Côte d'Ivoire": "Abidjan" };
  const FACILITATORS = [["Kwabena Tetteh"], ["Kwabena Tetteh", "Esi Mensah-Owusu"], ["Fatou Ndiaye"], ["Adaeze Okonkwo", "Kwabena Tetteh"]];
  const programs: Program[] = programSpecs.map((spec, index) => {
    let startAt: string;
    let endAt: string;
    if (spec.status === "delivered") {
      endAt = dayIn(spec.endAgo ?? 1, 0.55 + (index % 3) * 0.1);
      startAt = addDays(endAt, -12);
    } else if (spec.status === "cancelled") {
      startAt = dayIn(spec.endAgo ?? 2, 0.4);
      endAt = addDays(startAt, 3);
    } else if (spec.status === "running") {
      startAt = dayIn(1, 0.5);
      endAt = addDays(todayIso, 25);
    } else {
      startAt = addDays(todayIso, 12 + index);
      endAt = addDays(startAt, 2);
    }
    return {
      id: `prg-${pad(index + 1)}`,
      name: spec.name,
      type: spec.type,
      status: spec.status,
      country: spec.country,
      startAt,
      endAt,
      deliveredAt: spec.status === "delivered" ? endAt : undefined,
      partnerId: spec.partner !== undefined ? partners[spec.partner].id : undefined,
      participants: spec.people,
      // The target is a little above what was reached (people > 0), or a round number for one still to fill.
      target: spec.people > 0 ? Math.max(spec.people, Math.round((spec.people * (1 + ((index % 3) + 1) * 0.1)) / 5) * 5) : 40 + (index % 4) * 10,
      format: (["in-person", "online", "hybrid"] as const)[index % 3],
      location: index % 3 === 1 ? "Online" : CITIES[spec.country],
      facilitators: FACILITATORS[index % FACILITATORS.length],
      notes: index % 5 === 0 ? "Run with the partner's alumni network; slides are shared afterwards." : undefined,
    };
  });

  // ---- Ambassadors ----------------------------------------------------------------------------------------
  // 29 have been active (25 still are, 4 went dormant); 6 are onboarding; 5 applied. Running active total by
  // month end: 17, 20, 19 (a dip: two went quiet), 21, 23, 25.
  const joinedBy: number[] = []; // monthsAgo for each of the 29 who became active
  const pushJoin = (ago: number, count: number) => joinedBy.push(...Array<number>(count).fill(ago));
  pushJoin(7, 15); // joined before the six-month window
  pushJoin(5, 2);
  pushJoin(4, 3);
  pushJoin(3, 1);
  pushJoin(2, 3);
  pushJoin(1, 3);
  pushJoin(0, 2);
  // Who goes dormant, and when: indices into joinedBy (all joined early enough) -> monthsAgo they went quiet.
  const dormantAt = new Map<number, number>([
    [2, WEAK_MONTH],
    [5, WEAK_MONTH],
    [9, 2],
    [16, 1],
  ]);
  const codeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const usedCodes = new Set<string>();
  const referralCode = () => {
    for (;;) {
      let code = "GOD-";
      for (let i = 0; i < 6; i++) code += codeAlphabet[Math.floor(rand() * codeAlphabet.length)];
      if (!usedCodes.has(code)) {
        usedCodes.add(code);
        return code;
      }
    }
  };
  const tiers: AmbassadorTier[] = ["champion", "champion", "champion", "champion", "champion", "rising", "rising", "rising", "rising", "rising", "rising", "rising", "rising", "rising", "rising"];
  const ambassadors: Ambassador[] = [];
  const makeAmbassador = (status: AmbassadorStatus, joinedAgo: number, fraction: number, tier: AmbassadorTier, dormantAgo?: number) => {
    const index = ambassadors.length;
    const campus = CAMPUSES[(index * 3 + 1) % CAMPUSES.length];
    const name = fullName(index, 4);
    ambassadors.push({
      id: `amb-${pad(index + 1)}`,
      name,
      email: emailOf(name, "students.example.edu"),
      referralCode: referralCode(),
      campus: campus.name,
      country: campus.country,
      tier,
      status,
      joinedAt: clamp(dayIn(joinedAgo, fraction)),
      dormantSince: dormantAgo !== undefined ? clamp(dayIn(dormantAgo, 0.6)) : undefined,
    });
  };
  joinedBy.forEach((ago, i) => {
    const dormantAgo = dormantAt.get(i);
    const tier: AmbassadorTier = tiers[i % tiers.length] ?? "starter";
    // The tier list covers the first 15; everyone after that starts out.
    makeAmbassador(dormantAgo !== undefined ? "dormant" : "active", ago, (i % 5) * 0.2, i < tiers.length ? tier : "starter", dormantAgo);
  });
  for (let i = 0; i < 6; i++) makeAmbassador("onboarding", i < 3 ? 0 : 1, 0.2 + i * 0.12, "starter");
  for (let i = 0; i < 5; i++) makeAmbassador("applicant", 0, 0.1 + i * 0.15, "starter");

  // ---- Amplification logs (non-applicants share listings) ----------------------------------------------------
  const channels: SocialPlatform[] = ["whatsapp", "linkedin", "instagram", "facebook", "x"];
  const amplificationLogs: AmplificationLog[] = [];
  ambassadors
    .filter((ambassador) => ambassador.status !== "applicant")
    .forEach((ambassador, a) => {
      const shares = between(1, 4);
      for (let s = 0; s < shares; s++) {
        const listing = publishedListings[(a * 3 + s * 5) % publishedListings.length];
        const earliest = ambassador.joinedAt > (listing.publishedAt ?? "") ? ambassador.joinedAt : (listing.publishedAt as string);
        const at = clamp(addDays(earliest, between(1, 20)));
        const clicks = between(8, 140);
        amplificationLogs.push({
          id: `amp-${pad(amplificationLogs.length + 1)}`,
          ambassadorId: ambassador.id,
          listingId: listing.id,
          channel: channels[(a + s) % channels.length],
          at,
          clicks,
          applications: Math.round(clicks * (0.05 + rand() * 0.1)),
        });
      }
    });

  // ---- Database records (beneficiaries) ---------------------------------------------------------------------
  // 88 verified (per month: 15, 16, 11 weak, 15, 16, 15 from the oldest month) and 32 not yet verified.
  const verifiedPerMonth: [number, number][] = [
    [5, 15],
    [4, 16],
    [WEAK_MONTH, 11],
    [2, 15],
    [1, 16],
    [0, 15],
  ];
  const sources: RecordSource[] = ["ambassador", "website", "event", "partner", "referral", "social"];
  const sourceAmbassadors = ambassadors.filter((ambassador) => ambassador.status === "active" || ambassador.status === "dormant");
  const databaseRecords: DatabaseRecord[] = [];
  const addRecord = (verifiedAgo: number | null, fraction: number) => {
    const index = databaseRecords.length;
    const campus = CAMPUSES[(index * 7 + 2) % CAMPUSES.length];
    const source = sources[(index * 5 + (index >> 2)) % sources.length];
    const viaAmbassador = source === "ambassador" || source === "referral";
    const createdAt = verifiedAgo === null ? dayIn(index % 3, fraction) : addDays(dayIn(verifiedAgo, fraction), -between(2, 9));
    databaseRecords.push({
      id: `rec-${String(index + 1).padStart(3, "0")}`,
      name: fullName(index, 11),
      country: campus.country,
      institution: campus.name,
      source,
      verified: verifiedAgo !== null,
      createdAt,
      verifiedAt: verifiedAgo !== null ? dayIn(verifiedAgo, fraction) : undefined,
      ambassadorId: viaAmbassador ? sourceAmbassadors[(index * 5) % sourceAmbassadors.length].id : undefined,
      listingId: index % 3 === 0 ? publishedListings[(index * 2) % publishedListings.length].id : undefined,
    });
  };
  for (const [ago, count] of verifiedPerMonth) for (let i = 0; i < count; i++) addRecord(ago, (i + 0.5) / count);
  for (let i = 0; databaseRecords.length < 120; i++) addRecord(null, (i % 10) / 10);

  // ---- Social posts ---------------------------------------------------------------------------------------
  // Past months are complete: published 9, 9, 7 (weak), 9, 9 (oldest to newest), about 1,350 reach and 100 engagement a
  // post. The CURRENT month is month-to-date: its reach and engagement are the month's pace x the share of the month
  // gone, a little under the pro-rated target (an under-performing campaign), spread over a pro-rated number of posts.
  // Scheduled posts and drafts fill the rest up to 60.
  const share = elapsed / daysIn(0); // how much of the current month has passed
  const postTexts = [
    "New: {t} is open for applications. Link in bio.",
    "Meet one of our ambassadors from {c}. Their story inspires us.",
    "3 tips to make your CV stand out to recruiters.",
    "Apply early: {t} closes soon.",
    "This week on the desk: {t}.",
    "Missed our last webinar? The recording is live.",
  ];
  const socialPosts: SocialPost[] = [];
  const addPost = (status: SocialPost["status"], postedAt: string, reach: number, engagement: number) => {
    const index = socialPosts.length;
    const listing = publishedListings[index % publishedListings.length];
    const campus = CAMPUSES[index % CAMPUSES.length];
    socialPosts.push({
      id: `soc-${pad(index + 1)}`,
      platform: SOCIAL_PLATFORMS[index % SOCIAL_PLATFORMS.length],
      text: postTexts[index % postTexts.length].replace("{t}", listing.title).replace("{c}", campus.name),
      status,
      postedAt,
      reach,
      engagement,
      authorId: socialManagerId,
    });
  };
  const pastPublished: [number, number][] = [
    [5, 9],
    [4, 9],
    [WEAK_MONTH, 7],
    [2, 9],
    [1, 9],
  ];
  for (const [ago, count] of pastPublished) {
    const strength = ago === WEAK_MONTH ? 0.88 : 1;
    for (let i = 0; i < count; i++) {
      addPost("published", dayIn(ago, (i + 0.5) / count), Math.round(1350 * strength * (0.9 + rand() * 0.2)), Math.round(100 * strength * (0.9 + rand() * 0.2)));
    }
  }
  // The current month: n posts (a bit ahead of the pro-rated 8), with the month-to-date totals split between them.
  const currentPosts = Math.min(9, Math.max(1, Math.ceil(8 * share * 1.15)));
  const reachTotal = Math.round(10500 * share * (0.8 + rand() * 0.04));
  const engagementTotal = Math.round(800 * share * (0.78 + rand() * 0.04));
  const weights = Array.from({ length: currentPosts }, () => 0.8 + rand() * 0.4);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  let reachLeft = reachTotal;
  let engagementLeft = engagementTotal;
  weights.forEach((weight, i) => {
    const last = i === currentPosts - 1;
    const reach = last ? reachLeft : Math.round((reachTotal * weight) / weightSum);
    const engagement = last ? engagementLeft : Math.round((engagementTotal * weight) / weightSum);
    reachLeft -= reach;
    engagementLeft -= engagement;
    addPost("published", dayIn(0, (i + 0.5) / currentPosts), reach, engagement);
  });
  for (let i = 0; i < 5; i++) addPost("scheduled", addDays(todayIso, 1 + i * 2), 0, 0);
  for (let i = 0; socialPosts.length < 60; i++) addPost("draft", addDays(todayIso, 8 + i * 3), 0, 0);

  // ---- Testimonials ----------------------------------------------------------------------------------------
  const testimonialSpecs: [string, string, string, TestimonialStatus][] = [
    ["Abena Owusu", "Software engineer, Accra", "I found my first job through a listing on the desk. The vetting made me trust it from day one.", "approved"],
    ["Chidi Okafor", "Product designer, Lagos", "The CV masterclass changed how I write about my work. I had three interviews in two weeks.", "approved"],
    ["Wanjiru Kariuki", "MSc student, Nairobi", "A scholarship I would never have seen reached me through a campus ambassador.", "approved"],
    ["Kofi Adjei", "Operations analyst, Kumasi", "Clear listings, honest deadlines. I recommend it to every graduate I know.", "pending"],
    ["Ngozi Eze", "Fintech analyst, Abuja", "The remote work cohort gave me the confidence to apply abroad.", "pending"],
    ["Seydou Keita", "Data intern, Dakar", "Great programs, though I wish there were more in French.", "pending"],
    ["Isatu Kamara", "Public health researcher, Freetown", "Thank you for the fellowship alert. I applied the same night.", "unpublished"],
    ["Moussa Traore", "Student, Abidjan", "Not the experience I expected.", "rejected"],
    ["Zainab Bello", "Entrepreneur, Kano", "Please remove my details from the website.", "rejected"],
  ];
  const testimonials: Testimonial[] = testimonialSpecs.map(([author, role, quote, status], index) => ({
    id: `tst-${pad(index + 1)}`,
    author,
    role,
    quote,
    status,
    submittedAt: dayIn(index % 3, 0.2 + (index % 5) * 0.15),
  }));

  // ---- Monthly reports: generated early in a month for the one before. None in the weak month (missed), and none yet
  // in the current month (the Download PDF step will add it).
  const monthlyReports: MonthlyReport[] = [];
  for (let ago = SERIES_MONTHS - 1; ago >= 1; ago--) {
    if (ago === WEAK_MONTH) continue;
    monthlyReports.push({ id: `rpt-${monthKey(ago)}`, reportMonth: monthKey(ago + 1), generatedAt: dayIn(ago, 0.1) });
  }

  // ---- Website audience: six months, with where the visits came from -----------------------------------------
  // Past months are complete; the CURRENT month is month-to-date (the month's pace x the share gone, with variation).
  const channelShares: [string, number][] = [
    ["Organic search", 0.38],
    ["Direct", 0.24],
    ["Social media", 0.22],
    ["Referral", 0.1],
    ["Email", 0.06],
  ];
  const fullMonthViews = [13200, 13800, 10200, 14100, 14900, 15200]; // oldest -> current (the weak one is 3 months ago)
  const websiteMonths: WebsiteMonth[] = fullMonthViews.map((full, i) => {
    const ago = SERIES_MONTHS - 1 - i;
    const views = ago === 0 ? Math.round(full * share * (0.97 + rand() * 0.06)) : full;
    const days = ago === 0 ? elapsed : daysIn(ago); // days the figure covers
    const channelViews = channelShares.map(([channel, part]) => ({ channel, views: Math.round(views * part) }));
    // Rounding can leave a few views over or under: put the difference on the first channel so the table adds up.
    channelViews[0].views += views - channelViews.reduce((sum, row) => sum + row.views, 0);
    return {
      month: monthKey(ago),
      views,
      dailyFirstVisits: Math.round(views / days / 2.6),
      dailyVisitors: Math.round(views / days / 1.35),
      channels: channelViews,
    };
  });

  // ---- Targets ---------------------------------------------------------------------------------------------
  const targets: Target[] = (Object.keys(DEFAULT_TARGETS) as KpiKey[]).map((kpi) => ({ id: `tgt-${kpi}`, kpi, target: DEFAULT_TARGETS[kpi] }));

  return {
    collections: {
      programs,
      partners,
      ambassadors,
      databaseRecords,
      socialPosts,
      testimonials,
      listings,
      listingMetrics,
      amplificationLogs,
      monthlyReports,
      websiteMonths,
      staff,
      targets,
    },
    thresholds: { ...DEFAULT_THRESHOLDS },
  };
}
