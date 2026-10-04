/**
 * Mock data for the admin dashboard.
 * Mirrors the shapes used in kredibble-app (RecruiterCompany, VerificationDocs)
 * so this admin surface stays conceptually aligned with the mobile/web app's
 * data model — no shared backend exists yet, this is static/in-memory only.
 */

export type DocStatus = 'pending' | 'approved' | 'rejected';

export interface VerificationDoc {
  label: string;
  fileName: string;
  status: DocStatus;
}

export interface PendingCompany {
  id: string;
  name: string;
  industry: string;
  companySize: string;
  location: string;
  website: string;
  companyEmail: string;
  recruiterName: string;
  recruiterRole: string;
  recruiterEmail: string;
  submittedDate: string;
  overallStatus: DocStatus;
  docs: {
    businessReg: VerificationDoc;
    orgId: VerificationDoc;
    companyLogo: VerificationDoc;
    proofOfOrg: VerificationDoc;
  };
}

export const pendingCompanies: PendingCompany[] = [
  {
    id: 'comp-1',
    name: 'Wave Mobile Money',
    industry: 'Fintech',
    companySize: '201–500 employees',
    location: 'Dakar, Senegal',
    website: 'wave.com',
    companyEmail: 'careers@wave.com',
    recruiterName: 'Fatou Diop',
    recruiterRole: 'Talent Acquisition Lead',
    recruiterEmail: 'f.diop@wave.com',
    submittedDate: '14 Jul 2026',
    overallStatus: 'pending',
    docs: {
      businessReg: { label: 'Business Registration', fileName: 'wave_business_reg.pdf', status: 'pending' },
      orgId: { label: 'Organization ID', fileName: 'wave_org_id.pdf', status: 'pending' },
      companyLogo: { label: 'Company Logo', fileName: 'wave_logo.png', status: 'approved' },
      proofOfOrg: { label: 'Proof of Organization', fileName: 'wave_tax_cert.pdf', status: 'pending' },
    },
  },
  {
    id: 'comp-2',
    name: 'Ashesi Ventures',
    industry: 'Education',
    companySize: '11–50 employees',
    location: 'Berekuso, Ghana',
    website: 'ashesiventures.org',
    companyEmail: 'hello@ashesiventures.org',
    recruiterName: 'Kwabena Owusu',
    recruiterRole: 'Program Coordinator',
    recruiterEmail: 'k.owusu@ashesiventures.org',
    submittedDate: '12 Jul 2026',
    overallStatus: 'pending',
    docs: {
      businessReg: { label: 'Business Registration', fileName: 'ashesi_ngo_reg.pdf', status: 'approved' },
      orgId: { label: 'Organization ID', fileName: 'ashesi_org_id.pdf', status: 'approved' },
      companyLogo: { label: 'Company Logo', fileName: 'ashesi_logo.svg', status: 'approved' },
      proofOfOrg: { label: 'Proof of Organization', fileName: 'ashesi_ngo_cert.pdf', status: 'pending' },
    },
  },
  {
    id: 'comp-3',
    name: 'Google LLC',
    industry: 'Technology / Software',
    companySize: '1,000+ employees',
    location: 'Accra, Ghana & Mountain View, CA',
    website: 'careers.google.com',
    companyEmail: 'careers@google.com',
    recruiterName: 'Sarah Jenkins',
    recruiterRole: 'Lead Talent Partner, EMEA',
    recruiterEmail: 's.jenkins@google.com',
    submittedDate: '28 Jun 2026',
    overallStatus: 'approved',
    docs: {
      businessReg: { label: 'Business Registration', fileName: 'google_business_reg.pdf', status: 'approved' },
      orgId: { label: 'Organization ID', fileName: 'google_org_id.pdf', status: 'approved' },
      companyLogo: { label: 'Company Logo', fileName: 'google_logo.png', status: 'approved' },
      proofOfOrg: { label: 'Proof of Organization', fileName: 'google_proof.pdf', status: 'approved' },
    },
  },
  {
    id: 'comp-4',
    name: 'Kanzu Code',
    industry: 'Technology / Software',
    companySize: '1–10 employees',
    location: 'Kampala, Uganda',
    website: 'kanzucode.com',
    companyEmail: 'info@kanzucode.com',
    recruiterName: 'Immaculate Nabwire',
    recruiterRole: 'Founder/CEO',
    recruiterEmail: 'immaculate@kanzucode.com',
    submittedDate: '15 Jul 2026',
    overallStatus: 'rejected',
    docs: {
      businessReg: { label: 'Business Registration', fileName: 'kanzu_business_reg.pdf', status: 'rejected' },
      orgId: { label: 'Organization ID', fileName: 'kanzu_org_id.pdf', status: 'approved' },
      companyLogo: { label: 'Company Logo', fileName: 'kanzu_logo.png', status: 'approved' },
      proofOfOrg: { label: 'Proof of Organization', fileName: 'kanzu_proof.pdf', status: 'rejected' },
    },
  },
];
