/**
 * Mock data for the Trust & Safety Reports Queue.
 * There is no report/flag UI anywhere in kredibble-app yet (consumer-facing
 * "Report" buttons are a dependency this admin surface is waiting on) — this
 * models what the queue would consume once that exists.
 */

export type ReportTargetType = 'post' | 'user' | 'opportunity' | 'channel';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  targetType: ReportTargetType;
  targetLabel: string;
  reporterName: string;
  reason: string;
  details: string;
  date: string;
  status: ReportStatus;
  linkedChannelId?: string;
}

export const reports: Report[] = [
  {
    id: 'report-1',
    targetType: 'post',
    targetLabel: 'Post in "Guaranteed Visa Sponsorship Jobs 🚨"',
    reporterName: 'Ama Serwaa',
    reason: 'Scam / Fraud',
    details: 'This post is asking for a $200 "registration fee" to guarantee a work visa — classic advance-fee scam pattern.',
    date: '13 Jul 2026',
    status: 'open',
    linkedChannelId: 'ch-4',
  },
  {
    id: 'report-2',
    targetType: 'post',
    targetLabel: 'Post in "Breaking Into Tech Successfully"',
    reporterName: 'David Osei',
    reason: 'Scam / Fraud',
    details: 'Asking applicants to pay a "processing fee" via bank transfer before reviewing a resume — not a legitimate hiring practice.',
    date: '10 Feb 2026',
    status: 'open',
    linkedChannelId: 'ch-1',
  },
  {
    id: 'report-3',
    targetType: 'channel',
    targetLabel: 'Guaranteed Visa Sponsorship Jobs 🚨',
    reporterName: 'Kojo Boateng',
    reason: 'Misleading / Spam',
    details: 'Entire channel appears to exist solely to run visa-sponsorship advance-fee scams targeting job seekers.',
    date: '13 Jul 2026',
    status: 'open',
    linkedChannelId: 'ch-4',
  },
  {
    id: 'report-4',
    targetType: 'opportunity',
    targetLabel: 'Remote React Native Contractor — Kanzu Code',
    reporterName: 'Enoch Mensah',
    reason: 'Suspicious posting',
    details: 'Requested an upfront "equipment deposit" before starting the contract, which is not standard practice.',
    date: '16 Jul 2026',
    status: 'resolved',
  },
  {
    id: 'report-5',
    targetType: 'user',
    targetLabel: 'David Osei (Seeker)',
    reporterName: 'Michael Mensah',
    reason: 'Harassment',
    details: 'Sent repeated unsolicited messages after being told to stop contacting the reporter.',
    date: '20 Apr 2026',
    status: 'dismissed',
  },
];
