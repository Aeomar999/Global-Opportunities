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

const initialCompany: RecruiterCompany = {
  name: 'Google LLC',
  tagline: 'Organizing the world\'s information',
  logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/120px-Google_%22G%22_logo.svg.png',
  bannerImage: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80',
  industry: 'Technology / Software',
  companySize: '1,000+ employees',
  location: 'Accra, Ghana & Mountain View, CA',
  website: 'careers.google.com',
  companyEmail: 'careers@google.com',
  description: 'Google LLC is an American multinational technology company focusing on artificial intelligence, online advertising, search engine technology, cloud computing, computer software, quantum computing, e-commerce, and consumer electronics.',
  recruiterName: 'Sarah Jenkins',
  recruiterRole: 'Lead Talent Partner, EMEA',
  recruiterEmail: 's.jenkins@google.com',
  recruiterPhone: '(+233) 24 000 0000',
  recruiterLinkedin: 'linkedin.com/in/sarahjenkins',
  verified: true,
};

const initialVerificationDocs: VerificationDocs = {
  businessReg: 'done',
  orgId: 'done',
  companyLogo: 'done',
  proofOfOrg: 'done',
};

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

const initialCandidates: Candidate[] = [
  {
    id: 'cand-1',
    name: 'Kojo Boateng',
    profession: 'UI/UX Designer',
    university: 'Ashesi University',
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    matchScore: 96,
    skills: ['Figma', 'UI Design', 'Wireframing', 'Prototyping'],
    bio: 'Detail-oriented Junior Designer with a passion for clean UI layouts, structured user research, and interactive high-fidelity prototypes in Figma.',
  },
  {
    id: 'cand-2',
    name: 'Ama Serwaa',
    profession: 'Frontend Developer',
    university: 'KNUST',
    location: 'Kumasi, Ghana',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    matchScore: 92,
    skills: ['React Native', 'TypeScript', 'TailwindCSS', 'JavaScript'],
    bio: 'Mobile applications enthusiast focused on performance engineering, component reusability, and beautiful micro-animations in React Native.',
  },
  {
    id: 'cand-3',
    name: 'Michael Mensah',
    profession: 'Product Manager',
    university: 'University of Ghana',
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    matchScore: 89,
    skills: ['Agile', 'Product Roadmapping', 'User Research', 'SQL'],
    bio: 'Aspiring Product Manager who bridges the gap between engineering and user experience to deliver meaningful, data-driven features.',
  },
  {
    id: 'cand-4',
    name: 'Elona Blankson',
    profession: 'Product Designer',
    university: 'GIMPA',
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    matchScore: 94,
    skills: ['Figma', 'User Research', 'Design Systems', 'HTML/CSS'],
    bio: 'Passionate UI/UX specialist who loves creating accessible and scalable design systems that match web accessibility standards.',
  },
  {
    id: 'cand-5',
    name: 'David Osei',
    profession: 'Software Engineer',
    university: 'Academic City University',
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    matchScore: 85,
    skills: ['Node.js', 'Python', 'PostgreSQL', 'Docker'],
    bio: 'Backend-focused software engineering student with expertise in API design, cloud services, and scalable server architectures.',
  }
];

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
      const s = user.seeker as any;
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
