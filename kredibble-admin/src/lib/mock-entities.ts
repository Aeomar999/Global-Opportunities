/**
 * Types for the desk's entities. They stay SEPARATE in the data model and in the UI:
 *
 * - Listing      a curated Opportunity: a public listing, gated by vetting (not the same as Programs)
 * - Program      one of GOD's own activities (a training, a cohort, a campaign)
 * - Partner      an organisation in the six-stage pipeline
 * - Ambassador   someone who amplifies listings with a referral code (the Network)
 * - DatabaseRecord  a beneficiary kept in the desk's database
 * - SocialPost, Testimonial, Target  the rest of the desk's content and goals
 *
 * Only the fields every later screen will need are here; later steps add the rest. The shared mock store
 * (mock-store.ts) holds one empty collection per type for now.
 */

export interface Listing {
  id: string;
  title: string;
  /** Public only after vetting. */
  vetted: boolean;
}

export interface Program {
  id: string;
  name: string;
}

export const PARTNER_STAGES = ["identified", "contacted", "in_talks", "proposal", "agreed", "active"] as const;
export type PartnerStage = (typeof PARTNER_STAGES)[number];

export interface Partner {
  id: string;
  name: string;
  stage: PartnerStage;
}

export interface Ambassador {
  id: string;
  name: string;
  /** The code that credits a referral to this ambassador. */
  referralCode: string;
}

export interface DatabaseRecord {
  id: string;
  name: string;
}

export interface SocialPost {
  id: string;
  text: string;
}

export interface Testimonial {
  id: string;
  author: string;
  quote: string;
}

export interface Target {
  id: string;
  /** A person (my scorecard) or the team. */
  owner: string;
  metric: string;
  goal: number;
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
  targets: Target[];
}

export type EntityName = keyof EntityCollections;

/** A fresh, empty set of collections (later steps add seed data). */
export const emptyCollections = (): EntityCollections => ({
  programs: [],
  partners: [],
  ambassadors: [],
  databaseRecords: [],
  socialPosts: [],
  testimonials: [],
  listings: [],
  targets: [],
});
