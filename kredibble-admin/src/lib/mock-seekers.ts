/**
 * Mock data for the Seekers Directory.
 * Mirrors the Expert/profile shape from kredibble-app's mockExperts.ts +
 * mockProfile.ts, reduced to what an admin needs for account management.
 */

export type AccountStatus = 'active' | 'suspended';

export interface SeekerAccount {
  id: string;
  name: string;
  email: string;
  profession: string;
  university: string;
  country: string;
  joinedDate: string;
  applicationsCount: number;
  savedCount: number;
  status: AccountStatus;
}

export const seekerAccounts: SeekerAccount[] = [
  {
    id: 'seeker-1',
    name: 'Enoch Mensah',
    email: 'enoch.mensah@gmail.com',
    profession: 'Software Developer',
    university: 'Kwame Nkrumah University of Science and Technology',
    country: 'Ghana',
    joinedDate: '3 Jan 2026',
    applicationsCount: 4,
    savedCount: 6,
    status: 'active',
  },
  {
    id: 'seeker-2',
    name: 'Kojo Boateng',
    email: 'kojo.boateng@gmail.com',
    profession: 'UI/UX Designer',
    university: 'Ashesi University',
    country: 'Ghana',
    joinedDate: '18 Feb 2026',
    applicationsCount: 2,
    savedCount: 9,
    status: 'active',
  },
  {
    id: 'seeker-3',
    name: 'Ama Serwaa',
    email: 'ama.serwaa@gmail.com',
    profession: 'Frontend Developer',
    university: 'KNUST',
    country: 'Ghana',
    joinedDate: '2 Mar 2026',
    applicationsCount: 1,
    savedCount: 3,
    status: 'active',
  },
  {
    id: 'seeker-4',
    name: 'David Osei',
    email: 'david.osei@gmail.com',
    profession: 'Software Engineer',
    university: 'Academic City University',
    country: 'Ghana',
    joinedDate: '22 Apr 2026',
    applicationsCount: 0,
    savedCount: 1,
    status: 'suspended',
  },
  {
    id: 'seeker-5',
    name: 'Michael Mensah',
    email: 'michael.mensah@gmail.com',
    profession: 'Product Manager',
    university: 'University of Ghana',
    country: 'Ghana',
    joinedDate: '9 May 2026',
    applicationsCount: 3,
    savedCount: 5,
    status: 'active',
  },
];
