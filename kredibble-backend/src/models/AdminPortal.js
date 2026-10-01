import mongoose from 'mongoose';

const wordpressSyncSchema = new mongoose.Schema({
  wordpressId: String,
  status: { type: String, enum: ['pending', 'synced', 'failed'], default: 'pending', index: true },
  lastAttemptAt: Date,
  lastError: String,
}, { _id: false });

const syncField = () => ({ type: wordpressSyncSchema, default: () => ({ status: 'pending' }) });

const programSchema = new mongoose.Schema({
  title: { type: String, required: true },
  programType: { type: String, required: true, enum: ['training', 'bootcamp', 'webinar', 'outreach', 'project', 'mentorship', 'event'] },
  status: { type: String, required: true, enum: ['planned', 'running', 'delivered', 'cancelled'], default: 'planned', index: true },
  format: String,
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  country: String,
  location: String,
  participantCount: { type: Number, default: 0, min: 0 },
  participantTarget: { type: Number, default: 0, min: 0 },
  facilitators: [String],
  notes: String,
  startAt: Date,
  endAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wordpressSync: syncField(),
}, { timestamps: true });

const partnerSchema = new mongoose.Schema({
  organizationName: { type: String, required: true },
  partnerType: { type: String, required: true, enum: ['corporate', 'university', 'foundation', 'NGO', 'government', 'media', 'tech'] },
  stage: { type: String, required: true, enum: ['prospect', 'outreach', 'proposal', 'MOU', 'onboard', 'renew'], default: 'prospect', index: true },
  closed: { type: Boolean, default: false, index: true },
  assignedOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  country: String,
  contactName: String,
  contactEmail: String,
  contactPhone: String,
  provides: String,
  sourcedBy: String,
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wordpressSync: syncField(),
}, { timestamps: true });

const ambassadorSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  phone: String,
  country: String,
  city: String,
  profilePhoto: String,
  memberType: String,
  description: String,
  roleTitle: String,
  campus: String,
  tier: { type: String, enum: ['Ambassador', 'Senior Ambassador', 'Campus Lead', 'Regional Lead'], default: 'Ambassador' },
  status: { type: String, enum: ['applicant', 'onboarding', 'active', 'dormant'], default: 'applicant', index: true },
  assignedLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  trained: { type: Boolean, default: false },
  linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralCode: { type: String, unique: true, sparse: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wordpressSync: syncField(),
}, { timestamps: true });

const ambassadorAmplificationSchema = new mongoose.Schema({
  ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', required: true, index: true },
  channel: { type: String, required: true },
  note: String,
  loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const beneficiarySchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true, sparse: true, index: true },
  phone: { type: String, sparse: true, index: true },
  country: String,
  institution: String,
  sourceType: { type: String, required: true, enum: ['organic', 'ambassador-referral', 'event', 'partner-channel', 'bulk-import'], index: true },
  ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador' },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity' },
  verified: { type: Boolean, default: false, index: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wordpressSync: syncField(),
}, { timestamps: true });

const socialPostSchema = new mongoose.Schema({
  platform: { type: String, required: true, enum: ['Facebook', 'Instagram', 'X', 'LinkedIn', 'TikTok', 'YouTube', 'WhatsApp', 'other'], index: true },
  title: { type: String, required: true },
  url: String,
  reach: { type: Number, default: 0, min: 0 },
  engagement: { type: Number, default: 0, min: 0 },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity' },
  postedAt: { type: Date, required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wordpressSync: syncField(),
}, { timestamps: true });

const opportunityEngagementSchema = new mongoose.Schema({
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
  event: { type: String, required: true, enum: ['view', 'application'], index: true },
  source: { type: String, required: true, enum: ['website', 'app'], index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', index: true },
  referralCode: String,
  visitorId: { type: String, trim: true, maxlength: 200 },
}, { timestamps: true });
opportunityEngagementSchema.index({ opportunityId: 1, ambassadorId: 1, event: 1, createdAt: 1 });

const monthlyTargetSchema = new mongoose.Schema({
  month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  metric: { type: String, required: true },
  target: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'count' },
  note: String,
  greenThreshold: { type: Number, default: 1, min: 0 },
  amberThreshold: { type: Number, default: 0.7, min: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
monthlyTargetSchema.index({ month: 1, metric: 1 }, { unique: true });

const testimonialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  comment: { type: String, required: true },
  photo: String,
  status: { type: String, enum: ['pending', 'approved', 'unpublished', 'rejected'], default: 'pending', index: true },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  moderatedAt: Date,
}, { timestamps: true });

const activitySchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  summary: String,
}, { timestamps: true });

export const Program = mongoose.model('Program', programSchema);
export const Partner = mongoose.model('Partner', partnerSchema);
export const Ambassador = mongoose.model('Ambassador', ambassadorSchema);
export const AmbassadorAmplification = mongoose.model('AmbassadorAmplification', ambassadorAmplificationSchema);
export const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);
export const SocialPost = mongoose.model('SocialPost', socialPostSchema);
export const OpportunityEngagement = mongoose.model('OpportunityEngagement', opportunityEngagementSchema);
export const MonthlyTarget = mongoose.model('MonthlyTarget', monthlyTargetSchema);
export const Testimonial = mongoose.model('Testimonial', testimonialSchema);
export const AdminActivity = mongoose.model('AdminActivity', activitySchema);
