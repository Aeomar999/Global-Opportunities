/**
 * Mock data for the Opportunities Queue.
 * Mirrors PostedOpportunity from kredibble-app/src/constants/authStore.ts,
 * plus a `moderationStatus` field the mobile app doesn't have yet — that
 * state only needs to exist on the admin side.
 */

export type OpportunityType = 'jobs' | 'internships' | 'events' | 'grants';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export interface PostedOpportunity {
  id: string;
  title: string;
  type: OpportunityType;
  company: string;
  location: string;
  description: string;
  applicantsCount: number;
  date: string;
  moderationStatus: ModerationStatus;
  workType?: string;
  salary?: string;
  eventDateTime?: string;
  eventCategory?: string;
  grantBudgetRange?: string;
  grantSector?: string;
}

export const postedOpportunities: PostedOpportunity[] = [
  {
    id: 'opp-1',
    title: 'Senior Product Designer',
    type: 'jobs',
    company: 'Google LLC',
    location: 'Accra, Ghana (Hybrid)',
    description:
      'We are looking for a Senior Product Designer to lead design initiatives across the Google Pay EMEA teams. You will work on expanding digital payment experiences for millions of users.',
    applicantsCount: 3,
    date: '28 Jun 2026',
    moderationStatus: 'approved',
    workType: 'Hybrid',
    salary: '$85,000 – $110,000/yr',
  },
  {
    id: 'opp-2',
    title: 'UX Research Intern',
    type: 'internships',
    company: 'Google LLC',
    location: 'Accra, Ghana (On-site)',
    description:
      'A 6-month internship focusing on gathering qualitative insights, structuring user journeys, and conducting usability tests for new localization features in West Africa.',
    applicantsCount: 2,
    date: '29 Jun 2026',
    moderationStatus: 'approved',
    workType: 'On-site',
  },
  {
    id: 'opp-3',
    title: 'Backend Engineer, Payments',
    type: 'jobs',
    company: 'Wave Mobile Money',
    location: 'Dakar, Senegal (Remote)',
    description:
      'Join Wave to build resilient payment infrastructure serving millions of unbanked users across West Africa. Strong Go and distributed systems experience required.',
    applicantsCount: 12,
    date: '10 Jul 2026',
    moderationStatus: 'pending',
    workType: 'Remote',
    salary: '$60,000 – $90,000/yr',
  },
  {
    id: 'opp-4',
    title: 'Founders & Funders Demo Night',
    type: 'events',
    company: 'Ashesi Ventures',
    location: 'Berekuso, Ghana',
    description:
      'An evening of pitches from Ashesi-affiliated founders in front of regional investors, followed by a networking mixer. Open to students, alumni, and the public.',
    applicantsCount: 46,
    date: '2 Aug 2026',
    moderationStatus: 'pending',
    eventDateTime: '2 Aug 2026, 6:00 PM GMT',
    eventCategory: 'Networking',
  },
  {
    id: 'opp-5',
    title: 'Early-Stage EdTech Innovation Grant',
    type: 'grants',
    company: 'Ashesi Ventures',
    location: 'Pan-African',
    description:
      'Non-dilutive funding for early-stage EdTech founders building for the African market. Grants of up to $25,000 plus a 3-month mentorship track.',
    applicantsCount: 8,
    date: '5 Jul 2026',
    moderationStatus: 'pending',
    grantBudgetRange: 'Up to $25,000',
    grantSector: 'Education',
  },
  {
    id: 'opp-6',
    title: 'Remote React Native Contractor',
    type: 'jobs',
    company: 'Kanzu Code',
    location: 'Kampala, Uganda (Remote)',
    description:
      'Short-term contract (3 months) building a cross-platform companion app. Fast turnaround expected — 90-day rolling budget with possible extension.',
    applicantsCount: 5,
    date: '15 Jul 2026',
    moderationStatus: 'rejected',
    workType: 'Contract',
    salary: '$3,000/mo',
  },
];
