/**
 * Mock data for Grants operations.
 * kredibble-app's grants/apply.tsx submits into a setTimeout mock with no
 * approval workflow or funding-budget cap — this models what admin-side
 * budget allocation and application review would look like.
 */

export type GrantOpsStatus = 'open' | 'closed';

export interface GrantApplication {
  id: string;
  applicantName: string;
  requestedAmount: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface GrantRecord {
  id: string;
  title: string;
  hirer: string;
  sector: string;
  fundingPool: number;
  allocated: number;
  status: GrantOpsStatus;
  applications: GrantApplication[];
}

export const grantRecords: GrantRecord[] = [
  {
    id: 'grant-1',
    title: 'Early-Stage EdTech Innovation Grant',
    hirer: 'Ashesi Ventures',
    sector: 'Education',
    fundingPool: 200000,
    allocated: 75000,
    status: 'open',
    applications: [
      { id: 'app-1', applicantName: 'Kojo Boateng', requestedAmount: 25000, status: 'approved' },
      { id: 'app-2', applicantName: 'Ama Serwaa', requestedAmount: 18000, status: 'approved' },
      { id: 'app-3', applicantName: 'David Osei', requestedAmount: 32000, status: 'approved' },
      { id: 'app-4', applicantName: 'Michael Mensah', requestedAmount: 25000, status: 'pending' },
    ],
  },
  {
    id: 'grant-2',
    title: 'Community Health Access Fund',
    hirer: 'Google LLC',
    sector: 'Health',
    fundingPool: 500000,
    allocated: 500000,
    status: 'closed',
    applications: [
      { id: 'app-5', applicantName: 'Enoch Mensah', requestedAmount: 500000, status: 'approved' },
    ],
  },
];
