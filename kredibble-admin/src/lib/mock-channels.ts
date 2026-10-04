/**
 * Mock data for Community Moderation.
 * Mirrors Channel/Post from kredibble-app's mockCommunity.ts.
 */

export type ChannelStatus = 'active' | 'flagged' | 'removed';

export interface ChannelPost {
  id: string;
  authorName: string;
  body: string;
  date: string;
  flagged: boolean;
}

export interface Channel {
  id: string;
  name: string;
  owner: string;
  category: string;
  followers: string;
  postsCount: number;
  status: ChannelStatus;
  posts: ChannelPost[];
}

export const channels: Channel[] = [
  {
    id: 'ch-1',
    name: 'Breaking Into Tech Successfully',
    owner: 'Public (community-created)',
    category: 'Coding & Technology',
    followers: '200 followers',
    postsCount: 3,
    status: 'active',
    posts: [
      {
        id: 'post-1',
        authorName: 'System',
        body: 'The channel "Breaking into Tech Successfully" was created',
        date: '9 Feb 2026',
        flagged: false,
      },
      {
        id: 'post-2',
        authorName: 'Kojo Boateng',
        body: 'Chulabhorn Graduate Institute Scholarship 2027 in Thailand (Fully Funded) - Bright Scholarship. Apply now for CGI Thailand Scholarship.',
        date: '9 Feb 2026',
        flagged: false,
      },
      {
        id: 'post-3',
        authorName: 'Anonymous User',
        body: 'JOB VACANCY: WAREHOUSE AND INVENTORY OFFICER — DM me your bank details to "process your application fee" of $50 to secure this role.',
        date: '10 Feb 2026',
        flagged: true,
      },
    ],
  },
  {
    id: 'ch-2',
    name: 'Google Tech Circle',
    owner: 'Google LLC (Hirer)',
    category: 'Coding & Technology',
    followers: '1.2k followers',
    postsCount: 1,
    status: 'active',
    posts: [
      {
        id: 'post-4',
        authorName: 'Sarah Jenkins',
        body: 'Welcome to Google Tech Circle! Ask us anything about our EMEA hiring process.',
        date: '1 Jul 2026',
        flagged: false,
      },
    ],
  },
  {
    id: 'ch-3',
    name: 'Designers @ Google Accra',
    owner: 'Google LLC (Hirer)',
    category: 'Design & Creative',
    followers: '850 followers',
    postsCount: 0,
    status: 'active',
    posts: [],
  },
  {
    id: 'ch-4',
    name: 'Guaranteed Visa Sponsorship Jobs 🚨',
    owner: 'Public (community-created)',
    category: 'Jobs Abroad',
    followers: '3.4k followers',
    postsCount: 1,
    status: 'flagged',
    posts: [
      {
        id: 'post-5',
        authorName: 'Anonymous User',
        body: 'Pay $200 registration fee to guarantee your UK/Canada work visa placement this month. Limited slots!',
        date: '13 Jul 2026',
        flagged: true,
      },
    ],
  },
];
