import mongoose from 'mongoose';

export const opportunityTypes = [
  'job',
  'jobs',
  'internship',
  'internships',
  'competition',
  'fellowship',
  'training-workshop',
];

const opportunitySchema = new mongoose.Schema({
  hirerId: { type: mongoose.Schema.Types.ObjectId, ref: 'HirerAccount', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  title: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: opportunityTypes, index: true },
  company: { type: String, required: true, index: true },
  offeringOrganization: String,
  organizationLogo: String,
  location: { type: String, required: true, index: true },
  description: { type: String, required: true },
  applicantsCount: { type: Number, default: 0 },
  date: String,
  moderationStatus: { type: String, default: 'pending', index: true },
  workType: String,
  salary: String,
  experienceLevels: { type: String, default: '[]' },
  applicationUrl: String,
  applicationLink: String,
  costLabel: String,
  format: { type: String, enum: ['online', 'in-person', 'hybrid'] },
  country: String,
  deadline: Date,
  eligibility: String,
  benefits: String,
  organizer: String,
  coverImage: String,
  externalReferenceUrl: String,
  assignedWriterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralCodeOnApply: { type: Boolean, default: false },
  vetted: { type: Boolean, default: false, index: true },
  vettedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  vettedAt: Date,
  wordpressSync: {
    wordpressId: String,
    status: { type: String, enum: ['pending', 'synced', 'failed'], default: 'pending', index: true },
    lastAttemptAt: Date,
    lastError: String,
  },
  // Competition specific
  competitionCategory: String,
  prizeDetails: String,
  submissionRequirements: String,
  // Fellowship specific
  fellowshipDuration: String,
  fellowshipFormat: String,
  stipendDetails: String,
  // Training and workshop specific
  trainingFormat: String,
  trainingDuration: String,
  registrationFee: String,
  certificateOffered: Boolean,
  // Event specific
  eventDateTime: String,
  eventRegion: String,
  eventCategory: String,
  // Grant specific
  grantBudgetRange: String,
  grantSector: String,
}, { timestamps: true });

// SEC-031: Text index for search on title, company, location
opportunitySchema.index({ title: 'text', company: 'text', location: 'text' });

const applicantSchema = new mongoose.Schema({
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
  seekerId: { type: mongoose.Schema.Types.ObjectId, ref: 'SeekerProfile', index: true },
  name: String,
  status: { type: String, default: 'Applied' },
  skills: { type: String, default: '[]' },
  resumeUrl: String,
  referralCode: String,
  ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', index: true },
}, { timestamps: true });
applicantSchema.index({ opportunityId: 1, seekerId: 1 }, { unique: true, sparse: true });

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  hirer: { type: String, required: true },
  location: { type: String, required: true, index: true },
  dateTime: { type: String, required: true },
  capacity: { type: Number, required: true },
  attendeesCount: { type: Number, default: 0 },
  status: { type: String, default: 'upcoming' },
}, { timestamps: true });

// SEC-031: Text index for search on title, location
eventSchema.index({ title: 'text', location: 'text' });

const grantSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  hirer: { type: String, required: true },
  sector: { type: String, required: true, index: true },
  fundingPool: { type: Number, required: true },
  allocated: { type: Number, default: 0 },
  status: { type: String, default: 'open', index: true },
}, { timestamps: true });

// SEC-031: Text index for search on title, sector
grantSchema.index({ title: 'text', sector: 'text' });

const grantApplicationSchema = new mongoose.Schema({
  grantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grant', required: true, index: true },
  applicantName: { type: String, required: true },
  requestedAmount: { type: Number, required: true },
  status: { type: String, default: 'pending' },
}, { timestamps: true });

const companyVerificationSchema = new mongoose.Schema({
  hirerId: { type: mongoose.Schema.Types.ObjectId, ref: 'HirerAccount', unique: true },
  name: { type: String, required: true },
  industry: String,
  companySize: String,
  location: String,
  website: String,
  companyEmail: String,
  recruiterName: String,
  recruiterRole: String,
  recruiterEmail: String,
  submittedDate: String,
  overallStatus: { type: String, default: 'pending', index: true },
}, { timestamps: true });

const verificationDocSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'HirerAccount', required: true, index: true },
  verificationCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyVerification' },
  key: { type: String, required: true },
  label: String,
  fileName: String,
  status: { type: String, default: 'pending' },
});

export const Opportunity = mongoose.model('Opportunity', opportunitySchema);
export const Applicant = mongoose.model('Applicant', applicantSchema);
export const Event = mongoose.model('Event', eventSchema);
export const Grant = mongoose.model('Grant', grantSchema);
export const GrantApplication = mongoose.model('GrantApplication', grantApplicationSchema);

const eventAttendeeSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  status: { type: String, default: 'confirmed' },
}, { timestamps: true });
eventAttendeeSchema.index({ eventId: 1, email: 1 }, { unique: true });
export const EventAttendee = mongoose.model('EventAttendee', eventAttendeeSchema);

export const CompanyVerification = mongoose.model('CompanyVerification', companyVerificationSchema);
export const VerificationDoc = mongoose.model('VerificationDoc', verificationDocSchema);
