/**
 * Kredibble Auth & Hirer State Store
 * Manages active user role, recruiter profile, posted opportunities,
 * candidate lists, and community groups during the session.
 */

export interface Candidate {
  id: string;
  name: string;
  profession: string;
  university: string;
  location: string;
  image: string;
  matchScore: number;
  skills: string[];
  bio: string;
}

export interface Applicant {
  id: string;
  name: string;
  profession: string;
  university: string;
  image: string;
  matchScore: number;
  status: 'Applied' | 'Shortlisted' | 'Interviewing' | 'Offered';
  skills: string[];
  resumeUrl: string;
}

export interface PostedOpportunity {
  id: string;
  title: string;
  type: 'jobs' | 'internships' | 'events' | 'grants';
  company: string;
  location: string;
  logoColor: string;
  initial: string;
  description: string;
  applicantsCount: number;
  applicants: Applicant[];
  date: string;
  workType?: string;
  salary?: string;
  experienceLevels?: string[];
  organizationType?: string;
  grantSector?: string;
  grantApplicantType?: string;
  grantFundingAgency?: string;
  grantCountry?: string;
  grantPurpose?: string;
  grantAppMethod?: string;
  grantBudgetRange?: string;
  grantLogoUri?: string;
  eventDateTime?: string;
  eventRegion?: string;
  eventCategory?: string;
  eventTicketType?: string;
  eventStyle?: string;
  eventBannerUri?: string;
}

export interface RecruiterCompany {
  id?: string;
  name: string;
  tagline: string;
  logo: string;
  bannerImage: string;
  industry: string;
  companySize: string;
  location: string;
  website: string;
  companyEmail: string;
  description: string;
  recruiterName: string;
  recruiterRole: string;
  recruiterEmail: string;
  recruiterPhone: string;
  recruiterLinkedin: string;
  verified: boolean;
}

export type DocStatus = 'idle' | 'loading' | 'done';

export interface VerificationDocs {
  businessReg: DocStatus;
  orgId: DocStatus;
  companyLogo: DocStatus;
  proofOfOrg: DocStatus;
}

export interface HirerNotificationSettings {
  newApplicants: boolean;
  candidateMessages: boolean;
  channelActivity: boolean;
  verificationUpdates: boolean;
  marketingUpdates: boolean;
}

export interface HirerSecuritySettings {
  publicCompanyProfile: boolean;
}

export interface BackendUser {
  id: string;
  name: string;
  email: string;
  role: string;
  seeker?: unknown;
  hirer?: unknown;
  staff?: unknown;
}

// ─── Initial Data ─────────────────────────────────────────────────────────────

const initialHirerNotifications: HirerNotificationSettings = {
  newApplicants: true,
  candidateMessages: true,
  channelActivity: true,
  verificationUpdates: true,
  marketingUpdates: false,
};

const initialHirerSecurity: HirerSecuritySettings = {
  publicCompanyProfile: true,
};

export interface ManagedGroup {
  id: string;
  name: string;
  category: string;
  members: string;
  bio: string;
  avatar: string;
}

// ─── State Store ──────────────────────────────────────────────────────────────

class AuthStateStore {
  role: 'seeker' | 'hirer' = 'seeker';
  token: string | null = null;
  user: BackendUser | null = null;
  company: RecruiterCompany | null = null;
  candidates: Candidate[] = [];
  opportunities: PostedOpportunity[] = [];
  managedGroups: ManagedGroup[] = [];
  verificationDocs: VerificationDocs = {
    businessReg: 'idle',
    orgId: 'idle',
    companyLogo: 'idle',
    proofOfOrg: 'idle',
  };
  hirerNotifications: HirerNotificationSettings = { ...initialHirerNotifications };
  hirerSecurity: HirerSecuritySettings = { ...initialHirerSecurity };

  private listeners: (() => void)[] = [];

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(l => l());
  }

  setRole(role: 'seeker' | 'hirer') {
    this.role = role;
    this.notify();
  }

  setOpportunities(opps: PostedOpportunity[]) {
    this.opportunities = opps;
    this.notify();
  }

  setCandidates(cands: Candidate[]) {
    this.candidates = cands;
    this.notify();
  }

  setSession(token: string, user: BackendUser) {
    this.token = token;
    this.user = user;
    if (user.role === 'hirer' || user.role === 'seeker') {
      this.role = user.role;
    }

    // Map backend user to store structures
    if (user.role === 'hirer' && user.hirer) {
      const h = user.hirer as any;
      this.company = {
        id: h.id,
        name: h.companyName || 'Unknown Company',
        tagline: h.tagline || '',
        logo: h.logo || '',
        bannerImage: h.bannerImage || '',
        industry: h.industry || '',
        companySize: h.companySize || '',
        location: h.location || '',
        website: h.website || '',
        companyEmail: h.companyEmail || '',
        description: h.description || '',
        recruiterName: h.recruiterName || '',
        recruiterRole: h.recruiterRole || '',
        recruiterEmail: h.recruiterEmail || '',
        recruiterPhone: h.recruiterPhone || '',
        recruiterLinkedin: h.recruiterLinkedin || '',
        verified: h.verified || false,
      };
    }

    if (user.role === 'seeker' && user.seeker) {
      // You can trigger profileStore update here or handle it in ProfileScreen
    }

    this.notify();
  }

  clearSession() {
    this.token = null;
    this.user = null;
    this.company = null;
    this.opportunities = [];
    this.candidates = [];
    this.notify();
  }

  updateCompany(updated: Partial<RecruiterCompany>) {
    if (this.company) {
      this.company = { ...this.company, ...updated } as RecruiterCompany;
    }
    this.notify();
  }

  updateVerificationDoc(doc: keyof VerificationDocs, status: DocStatus) {
    this.verificationDocs = { ...this.verificationDocs, [doc]: status };
    const allDone = Object.values(this.verificationDocs).every(s => s === 'done');
    if (this.company && allDone !== this.company.verified) {
      this.company = { ...this.company, verified: allDone } as RecruiterCompany;
    }
    this.notify();
  }

  updateHirerNotifications(settings: Partial<HirerNotificationSettings>) {
    this.hirerNotifications = { ...this.hirerNotifications, ...settings };
    this.notify();
  }

  updateHirerSecurity(settings: Partial<HirerSecuritySettings>) {
    this.hirerSecurity = { ...this.hirerSecurity, ...settings };
    this.notify();
  }

  addOpportunity(opp: Omit<PostedOpportunity, 'id' | 'applicantsCount' | 'applicants' | 'date'>) {
    const newOpp: PostedOpportunity = {
      ...opp,
      id: `post-${Date.now()}`,
      applicantsCount: 0,
      applicants: [],
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
    this.opportunities = [newOpp, ...this.opportunities];
    this.notify();
  }

  updateApplicantStatus(oppId: string, applicantId: string, status: Applicant['status']) {
    const opp = this.opportunities.find(o => o.id === oppId);
    if (opp) {
      const applicant = opp.applicants.find(a => a.id === applicantId);
      if (applicant) {
        applicant.status = status;
        this.notify();
      }
    }
  }

  updateOpportunity(oppId: string, updated: Partial<PostedOpportunity>) {
    this.opportunities = this.opportunities.map(o =>
      o.id === oppId ? { ...o, ...updated } : o
    );
    this.notify();
  }

  deleteOpportunity(oppId: string) {
    this.opportunities = this.opportunities.filter(o => o.id !== oppId);
    this.notify();
  }

  addManagedGroup(group: Omit<ManagedGroup, 'members'> & { id: string }) {
    const newGroup: ManagedGroup = {
      ...group,
      members: '1 member',
    };
    this.managedGroups = [newGroup, ...this.managedGroups];
    this.notify();
  }
}

export const authStore = new AuthStateStore();
