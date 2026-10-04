/**
 * Mock data for the Hirers Directory.
 * Account-level view of hirer companies — broader than the Verification
 * Queue (src/lib/mock-data.ts), which only tracks document review state.
 * This tracks the account itself: status, activity, verification summary.
 */

export type AccountStatus = 'active' | 'suspended';
export type VerificationSummary = 'verified' | 'pending' | 'rejected';

export interface HirerAccount {
  id: string;
  companyName: string;
  recruiterName: string;
  recruiterEmail: string;
  industry: string;
  location: string;
  joinedDate: string;
  postingsCount: number;
  verification: VerificationSummary;
  status: AccountStatus;
  linkedVerificationId?: string;
}

export const hirerAccounts: HirerAccount[] = [
  {
    id: 'hirer-1',
    companyName: 'Google LLC',
    recruiterName: 'Sarah Jenkins',
    recruiterEmail: 's.jenkins@google.com',
    industry: 'Technology / Software',
    location: 'Accra, Ghana & Mountain View, CA',
    joinedDate: '28 Jun 2026',
    postingsCount: 2,
    verification: 'verified',
    status: 'active',
    linkedVerificationId: 'comp-3',
  },
  {
    id: 'hirer-2',
    companyName: 'Wave Mobile Money',
    recruiterName: 'Fatou Diop',
    recruiterEmail: 'f.diop@wave.com',
    industry: 'Fintech',
    location: 'Dakar, Senegal',
    joinedDate: '14 Jul 2026',
    postingsCount: 1,
    verification: 'pending',
    status: 'active',
    linkedVerificationId: 'comp-1',
  },
  {
    id: 'hirer-3',
    companyName: 'Ashesi Ventures',
    recruiterName: 'Kwabena Owusu',
    recruiterEmail: 'k.owusu@ashesiventures.org',
    industry: 'Education',
    location: 'Berekuso, Ghana',
    joinedDate: '12 Jul 2026',
    postingsCount: 2,
    verification: 'pending',
    status: 'active',
    linkedVerificationId: 'comp-2',
  },
  {
    id: 'hirer-4',
    companyName: 'Kanzu Code',
    recruiterName: 'Immaculate Nabwire',
    recruiterEmail: 'immaculate@kanzucode.com',
    industry: 'Technology / Software',
    location: 'Kampala, Uganda',
    joinedDate: '15 Jul 2026',
    postingsCount: 1,
    verification: 'rejected',
    status: 'suspended',
    linkedVerificationId: 'comp-4',
  },
];
