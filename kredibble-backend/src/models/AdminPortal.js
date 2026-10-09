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
  deliveredAt: { type: Date, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wordpressSync: syncField(),
}, { timestamps: true });

programSchema.virtual('name').get(function() { return this.title; }).set(function(v) { this.title = v; });
programSchema.virtual('type').get(function() { return this.programType; }).set(function(v) { this.programType = v; });
programSchema.virtual('participants').get(function() { return this.participantCount; }).set(function(v) { this.participantCount = v; });
programSchema.virtual('target').get(function() { return this.participantTarget; }).set(function(v) { this.participantTarget = v; });

programSchema.pre('save', function() {
  if (this.status === 'delivered') {
    if (!this.deliveredAt) {
      this.deliveredAt = this.endAt || new Date();
    }
  } else if (this.isModified('status') && this.status !== 'delivered') {
    this.deliveredAt = undefined;
  }
});

const partnerStageEntrySchema = new mongoose.Schema({
  stage: { type: String, required: true, enum: ['prospect', 'outreach', 'proposal', 'MOU', 'mou', 'onboard', 'renew'] },
  at: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  from: { type: String, enum: ['prospect', 'outreach', 'proposal', 'MOU', 'mou', 'onboard', 'renew'] },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byName: { type: String, trim: true },
}, { _id: false });

const partnerSchema = new mongoose.Schema({
  organizationName: { type: String, required: true },
  partnerType: { type: String, required: true, enum: ['corporate', 'university', 'foundation', 'NGO', 'ngo', 'government', 'media', 'tech', 'media_tech'] },
  stage: { type: String, required: true, enum: ['prospect', 'outreach', 'proposal', 'MOU', 'mou', 'onboard', 'renew'], default: 'prospect', index: true },
  closed: { type: Boolean, default: false, index: true },
  assignedOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  country: String,
  sector: String,
  contactName: String,
  contactEmail: String,
  contactPhone: String,
  provides: String,
  sourcedBy: String,
  notes: String,
  stageHistory: { type: [partnerStageEntrySchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wordpressSync: syncField(),
}, { timestamps: true });

partnerSchema.virtual('name').get(function() { return this.organizationName; }).set(function(v) { this.organizationName = v; });
partnerSchema.virtual('type').get(function() { return this.partnerType; }).set(function(v) { this.partnerType = v; });
partnerSchema.virtual('ownerId').get(function() { return this.assignedOwnerId ? this.assignedOwnerId.toString() : undefined; }).set(function(v) { this.assignedOwnerId = v; });
partnerSchema.virtual('sourcedVia').get(function() { return this.sourcedBy; }).set(function(v) { this.sourcedBy = v; });

partnerSchema.pre('save', function() {
  const isClosed = ['onboard', 'renew'].includes(String(this.stage).toLowerCase());
  this.closed = isClosed;

  if (!this.stageHistory || this.stageHistory.length === 0) {
    this.stageHistory = [{
      stage: this.stage || 'prospect',
      at: new Date().toISOString().slice(0, 10),
      by: this.createdBy,
    }];
  }
});

export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateReferralCode() {
  let code = 'GOD-';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

const ambassadorSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  phone: String,
  country: String,
  city: String,
  profilePhoto: String,
  memberType: { type: String, enum: ['student', 'graduate', 'staff', 'volunteer'], default: 'student' },
  description: String,
  roleTitle: String,
  campus: String,
  tier: {
    type: String,
    enum: ['ambassador', 'senior', 'lead', 'Ambassador', 'Senior Ambassador', 'Campus Lead', 'Regional Lead'],
    default: 'ambassador',
    index: true,
  },
  status: {
    type: String,
    enum: ['applicant', 'onboarding', 'active', 'dormant'],
    default: 'applicant',
    index: true,
  },
  assignedLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  trained: { type: Boolean, default: false },
  linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralCode: { type: String, unique: true, sparse: true },
  joinedAt: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
  dormantSince: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wordpressSync: syncField(),
}, { timestamps: true });

// A signed-in user's request to become an ambassador. The snapshot is built by the server from the
// user's own records, never from the request body, so the review queue shows trustworthy details.
const ambassadorRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['seeker', 'hirer'], required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: String,
  country: String,
  city: String,
  profession: String,
  organisation: String,
  motivation: { type: String, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewNote: { type: String, maxlength: 1000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' },
  ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador' },
}, { timestamps: true });
// One open request per user at a time.
ambassadorRequestSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
ambassadorSchema.virtual('name')
  .get(function () { return this.fullName; })
  .set(function (value) { this.fullName = value; });

ambassadorSchema.virtual('photoUrl')
  .get(function () { return this.profilePhoto; })
  .set(function (value) { this.profilePhoto = value; });

ambassadorSchema.virtual('linkedSeekerId')
  .get(function () { return this.linkedUserId; })
  .set(function (value) { this.linkedUserId = value; });

ambassadorSchema.pre('save', async function () {
  if (!this.joinedAt) {
    this.joinedAt = new Date().toISOString().slice(0, 10);
  }
  if (!this.referralCode) {
    let code = generateReferralCode();
    while (await mongoose.models.Ambassador.exists({ referralCode: code })) {
      code = generateReferralCode();
    }
    this.referralCode = code;
  }
  if (this.status === 'dormant' && !this.dormantSince) {
    this.dormantSince = new Date().toISOString().slice(0, 10);
  } else if (this.status && this.status !== 'dormant') {
    this.dormantSince = undefined;
  }
});

const ambassadorAmplificationSchema = new mongoose.Schema({
  ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', required: true, index: true },
  channel: { type: String, required: true },
  at: { type: String, default: () => new Date().toISOString().slice(0, 10), index: true },
  clicks: { type: Number, default: 0, min: 0 },
  applications: { type: Number, default: 0, min: 0 },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity' },
  note: String,
  loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ambassadorAmplificationSchema.index({ ambassadorId: 1, at: 1 });

const beneficiarySchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true, sparse: true, index: true },
  phone: { type: String, sparse: true, index: true },
  country: String,
  institution: String,
  sourceType: { type: String, required: true, enum: ['organic', 'ambassador-referral', 'event', 'partner-channel', 'bulk-import'], index: true },
  ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', index: true },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity' },
  verified: { type: Boolean, default: false, index: true },
  verifiedAt: { type: String, index: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wordpressSync: syncField(),
}, { timestamps: true });

beneficiarySchema.index({ ambassadorId: 1, verified: 1, verifiedAt: 1 });

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
export const AmbassadorRequest = mongoose.model('AmbassadorRequest', ambassadorRequestSchema);
export const AmbassadorAmplification = mongoose.model('AmbassadorAmplification', ambassadorAmplificationSchema);
export const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);
export const SocialPost = mongoose.model('SocialPost', socialPostSchema);
export const OpportunityEngagement = mongoose.model('OpportunityEngagement', opportunityEngagementSchema);
export const MonthlyTarget = mongoose.model('MonthlyTarget', monthlyTargetSchema);
export const Testimonial = mongoose.model('Testimonial', testimonialSchema);
export const AdminActivity = mongoose.model('AdminActivity', activitySchema);

const rolePermissionConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  toggles: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      Moderator: { verifications: true, moderate: true, suspend: true, content: false, broadcast: false, staff: false },
      Support: { verifications: false, moderate: false, suspend: true, content: false, broadcast: false, staff: false },
    },
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const RolePermissionConfig = mongoose.model('RolePermissionConfig', rolePermissionConfigSchema);

export const DEFAULT_PIPELINE_STAGE_LABELS = Object.freeze({
  prospect: 'Prospect',
  outreach: 'Outreach',
  proposal: 'Proposal',
  mou: 'MOU',
  onboard: 'Onboard',
  renew: 'Renew',
});

const pipelineStageConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  stages: {
    prospect: { type: String, default: 'Prospect' },
    outreach: { type: String, default: 'Outreach' },
    proposal: { type: String, default: 'Proposal' },
    mou: { type: String, default: 'MOU' },
    onboard: { type: String, default: 'Onboard' },
    renew: { type: String, default: 'Renew' },
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const PipelineStageConfig = mongoose.model('PipelineStageConfig', pipelineStageConfigSchema);

// BE-002: Append-only KPI TargetChange history
const targetChangeSchema = new mongoose.Schema({
  kpi: {
    type: String,
    required: true,
    index: true,
  },
  value: {
    type: Number,
    required: true,
    min: 1,
    max: 10_000_000,
  },
  effectiveFrom: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/,
    index: true,
  },
  previous: {
    type: Number,
    default: null,
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  changedByName: {
    type: String,
    trim: true,
  },
  changedAt: {
    type: String,
    default: () => new Date().toISOString().slice(0, 10),
  },
  seq: {
    type: Number,
    required: true,
    index: true,
  },
}, { timestamps: true });

targetChangeSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete'], function() {
  throw new Error('TargetChange is append-only and cannot be modified or deleted');
});

targetChangeSchema.pre(['deleteOne', 'deleteMany'], function() {
  if (process.env.NODE_ENV === 'test' && this.getFilter && Object.keys(this.getFilter()).length === 0) {
    return;
  }
  throw new Error('TargetChange is append-only and cannot be modified or deleted');
});

targetChangeSchema.index({ kpi: 1, effectiveFrom: 1, seq: -1 });

export const TargetChange = mongoose.model('TargetChange', targetChangeSchema);

// BE-003: Append-only ThresholdChange history
const thresholdChangeSchema = new mongoose.Schema({
  green: {
    type: Number,
    required: true,
    min: 1,
    max: 200,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer',
    },
  },
  amber: {
    type: Number,
    required: true,
    min: 1,
    max: 200,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer',
    },
  },
  effectiveFrom: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/,
    index: true,
  },
  previous: {
    type: new mongoose.Schema({
      green: Number,
      amber: Number,
    }, { _id: false }),
    default: null,
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  changedByName: {
    type: String,
    trim: true,
  },
  changedAt: {
    type: String,
    default: () => new Date().toISOString().slice(0, 10),
  },
  seq: {
    type: Number,
    required: true,
    index: true,
  },
}, { timestamps: true });

thresholdChangeSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete'], function() {
  throw new Error('ThresholdChange is append-only and cannot be modified or deleted');
});

thresholdChangeSchema.pre(['deleteOne', 'deleteMany'], function() {
  if (process.env.NODE_ENV === 'test' && this.getFilter && Object.keys(this.getFilter()).length === 0) {
    return;
  }
  throw new Error('ThresholdChange is append-only and cannot be modified or deleted');
});

thresholdChangeSchema.index({ effectiveFrom: 1, seq: -1 });

export const ThresholdChange = mongoose.model('ThresholdChange', thresholdChangeSchema);

