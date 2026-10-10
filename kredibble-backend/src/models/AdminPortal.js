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
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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

export const COUNTRY_DIAL_CODES = Object.freeze({
  Botswana: '267',
  Cameroon: '237',
  "Côte d'Ivoire": '225',
  Egypt: '20',
  Ethiopia: '251',
  Ghana: '233',
  Kenya: '254',
  Malawi: '265',
  Morocco: '212',
  Mozambique: '258',
  Namibia: '264',
  Nigeria: '234',
  Rwanda: '250',
  Senegal: '221',
  'Sierra Leone': '232',
  'South Africa': '27',
  Tanzania: '255',
  Tunisia: '216',
  Uganda: '256',
  Zambia: '260',
  Zimbabwe: '263',
});

export const normalizeEmail = (email) => (email ? String(email).trim().toLowerCase() : '');

export const normalizePhone = (phone, country) => {
  const raw = (phone ? String(phone).trim() : '');
  if (!raw) return '';
  let digits = raw.replace(/\D+/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  const dial = country ? COUNTRY_DIAL_CODES[country] : undefined;
  if (digits.startsWith('0')) digits = digits.slice(1);
  else if (dial && digits.startsWith(dial) && digits.length - dial.length >= 6) return digits;
  return dial ? dial + digits : digits;
};

export const CANONICAL_RECORD_SOURCES = Object.freeze(['organic', 'ambassador', 'event', 'partner', 'import']);
export const RECORD_SOURCE_LABELS = Object.freeze({
  organic: 'Organic',
  ambassador: 'Ambassador referral',
  event: 'Event',
  partner: 'Partner channel',
  import: 'Bulk import',
});

const beneficiarySchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true, sparse: true, index: true },
  phone: { type: String, sparse: true, index: true },
  phoneNormalized: { type: String, sparse: true, index: true },
  country: String,
  institution: String,
  source: {
    type: String,
    enum: ['organic', 'ambassador', 'event', 'partner', 'import', 'ambassador-referral', 'partner-channel', 'bulk-import'],
    default: 'organic',
    index: true,
  },
  sourceType: {
    type: String,
    enum: ['organic', 'ambassador', 'event', 'partner', 'import', 'ambassador-referral', 'partner-channel', 'bulk-import'],
    default: 'organic',
    index: true,
  },
  ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', index: true },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', index: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', index: true },
  verified: { type: Boolean, default: false, index: true },
  verifiedAt: { type: String, index: true },
  createdAtDate: { type: String, index: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wordpressSync: syncField(),
}, { timestamps: true });

beneficiarySchema.virtual('name')
  .get(function () { return this.fullName; })
  .set(function (value) { this.fullName = value; });

beneficiarySchema.pre('save', function () {
  if (this.name && !this.fullName) {
    this.fullName = this.name;
  }
  if (!this.source && this.sourceType) {
    this.source = this.sourceType;
  }
  if (this.source) {
    if (this.source === 'ambassador-referral') this.source = 'ambassador';
    else if (this.source === 'partner-channel') this.source = 'partner';
    else if (this.source === 'bulk-import') this.source = 'import';
  }
  if (!this.sourceType && this.source) {
    this.sourceType = this.source === 'ambassador' ? 'ambassador-referral'
      : (this.source === 'partner' ? 'partner-channel'
      : (this.source === 'import' ? 'bulk-import' : this.source));
  }
  if (this.listingId && !this.opportunityId) {
    this.opportunityId = this.listingId;
  }
  if (this.opportunityId && !this.listingId) {
    this.listingId = this.opportunityId;
  }
  if (this.phone) {
    this.phoneNormalized = normalizePhone(this.phone, this.country);
  } else {
    this.phoneNormalized = undefined;
  }
  if (this.email) {
    this.email = normalizeEmail(this.email);
  }
  if (!this.createdAtDate) {
    this.createdAtDate = this.createdAt ? new Date(this.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  }
  if (this.verified && !this.verifiedAt) {
    this.verifiedAt = new Date().toISOString().slice(0, 10);
  }
});

beneficiarySchema.index({ ambassadorId: 1, verified: 1, verifiedAt: 1 });
beneficiarySchema.index({ verified: 1, verifiedAt: 1 });

export const CANONICAL_SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'x',
  'linkedin',
  'tiktok',
  'youtube',
  'whatsapp',
  'other',
];

export const SOCIAL_PLATFORM_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  other: 'Other',
};

export const normalizeSocialPlatform = (value) => {
  if (!value) return 'other';
  const normalized = String(value).trim().toLowerCase();
  if (CANONICAL_SOCIAL_PLATFORMS.includes(normalized)) return normalized;
  return 'other';
};

export const SOCIAL_POST_STATUSES = ['draft', 'scheduled', 'published'];

const socialPostSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: CANONICAL_SOCIAL_PLATFORMS,
    lowercase: true,
    trim: true,
    index: true,
  },
  title: { type: String, required: true, trim: true },
  text: { type: String, trim: true },
  url: { type: String, trim: true },
  reach: { type: Number, default: 0, min: 0 },
  engagement: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: SOCIAL_POST_STATUSES,
    default: 'published',
    index: true,
  },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', index: true },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', index: true },
  postedAt: { type: Date, required: true, index: true },
  postedAtDate: { type: String, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wordpressSync: syncField(),
}, { timestamps: true });

socialPostSchema.pre('validate', function () {
  if (this.platform) {
    this.platform = normalizeSocialPlatform(this.platform);
  }
  if (!this.text && this.title) {
    this.text = this.title;
  }
  if (this.listingId && !this.opportunityId) {
    this.opportunityId = this.listingId;
  }
  if (this.opportunityId && !this.listingId) {
    this.listingId = this.opportunityId;
  }
  if (this.postedAt) {
    const date = new Date(this.postedAt);
    if (!Number.isNaN(date.getTime())) {
      this.postedAtDate = date.toISOString().slice(0, 10);
    }
  }
  if (this.createdBy && !this.authorId) {
    this.authorId = this.createdBy;
  }
  if (this.authorId && !this.createdBy) {
    this.createdBy = this.authorId;
  }
  if (typeof this.reach === 'number') {
    this.reach = Math.max(0, Math.round(this.reach));
  }
  if (typeof this.engagement === 'number') {
    this.engagement = Math.max(0, Math.round(this.engagement));
  }
});

socialPostSchema.index({ status: 1, postedAt: -1 });
socialPostSchema.index({ platform: 1, status: 1, postedAt: -1 });
socialPostSchema.index({ postedAtDate: 1, status: 1 });

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

export const TESTIMONIAL_STATUSES = ['pending', 'approved', 'unpublished', 'rejected'];

export const ALLOWED_TESTIMONIAL_TRANSITIONS = {
  pending: ['approved', 'rejected'],
  approved: ['unpublished'],
  unpublished: ['approved'],
  rejected: ['approved'],
};

export const TESTIMONIAL_ACTIONS_MAP = {
  approve: 'approved',
  reject: 'rejected',
  unpublish: 'unpublished',
  reapprove: 'approved',
};

const testimonialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  comment: { type: String, required: true, trim: true },
  role: { type: String, trim: true, default: '' },
  photo: { type: String, trim: true },
  status: { type: String, enum: TESTIMONIAL_STATUSES, default: 'pending', index: true },
  submittedAt: { type: Date, default: Date.now, index: true },
  submittedAtDate: { type: String, index: true },
  decidedAt: { type: Date },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  moderatedAt: { type: Date },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String, trim: true },
}, { timestamps: true });

testimonialSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

testimonialSchema.virtual('author').get(function() {
  return this.name;
});

testimonialSchema.virtual('quote').get(function() {
  return this.comment;
});

testimonialSchema.set('toJSON', { virtuals: true });
testimonialSchema.set('toObject', { virtuals: true });

testimonialSchema.pre('validate', function() {
  if (!this.name && this.author) {
    this.name = String(this.author).trim();
  }
  if (!this.comment && this.quote) {
    this.comment = String(this.quote).trim();
  }
  if (!this.submittedAt) {
    this.submittedAt = this.createdAt || new Date();
  }
  if (this.submittedAt instanceof Date && !isNaN(this.submittedAt.getTime())) {
    this.submittedAtDate = this.submittedAt.toISOString().slice(0, 10);
  }
  if (this.decidedAt && !this.moderatedAt) {
    this.moderatedAt = this.decidedAt;
  } else if (this.moderatedAt && !this.decidedAt) {
    this.decidedAt = this.moderatedAt;
  }
  if (this.decidedBy && !this.moderatedBy) {
    this.moderatedBy = this.decidedBy;
  } else if (this.moderatedBy && !this.decidedBy) {
    this.decidedBy = this.moderatedBy;
  }
});

testimonialSchema.index({ status: 1, submittedAt: -1 });
testimonialSchema.index({ status: 1, createdAt: -1 });

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

export function getDaysForMonth(monthStr, now = new Date()) {
  const currentMonthStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const [yearStr, monthNumStr] = (monthStr || currentMonthStr).split('-');
  const year = Number.parseInt(yearStr, 10);
  const monthNum = Number.parseInt(monthNumStr, 10);
  const totalDays = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();

  if (monthStr === currentMonthStr) {
    return Math.max(1, Math.min(now.getUTCDate(), totalDays));
  }
  return totalDays;
}

export function calculateDefaultDailyFigures(views, monthStr, now = new Date()) {
  const safeViews = Number.isFinite(views) ? Math.max(0, views) : 0;
  const days = getDaysForMonth(monthStr, now);
  return {
    dailyFirstVisits: Math.round(safeViews / days / 2.6),
    dailyVisitors: Math.round(safeViews / days / 1.35),
  };
}

const websiteChannelEntrySchema = new mongoose.Schema({
  channel: { type: String, required: true, trim: true },
  views: { type: Number, required: true, min: 0, default: 0 },
}, { _id: false });

const websiteMonthSchema = new mongoose.Schema({
  month: {
    type: String,
    required: true,
    unique: true,
    match: /^\d{4}-\d{2}$/,
    index: true,
  },
  views: {
    type: Number,
    required: true,
    min: 0,
  },
  dailyFirstVisits: {
    type: Number,
    required: true,
    min: 0,
  },
  dailyVisitors: {
    type: Number,
    required: true,
    min: 0,
  },
  channels: {
    type: [websiteChannelEntrySchema],
    default: undefined,
  },
  source: {
    type: String,
    enum: ['manual', 'ga4'],
    default: 'manual',
    index: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedByName: {
    type: String,
    trim: true,
  },
  rawGa4Data: {
    type: mongoose.Schema.Types.Mixed,
  },
}, { timestamps: true });

websiteMonthSchema.pre('validate', function() {
  if (this.channels && this.channels.length > 0) {
    const sum = this.channels.reduce((acc, c) => acc + (Number(c.views) || 0), 0);
    if (this.views === undefined || this.views === null) {
      this.views = sum;
    } else if (sum !== this.views) {
      throw new Error(`Channel views (${sum}) must add up to total views (${this.views})`);
    }
  } else if (this.views !== undefined && (!this.channels || this.channels.length === 0)) {
    this.channels = [{ channel: 'Direct', views: this.views }];
  } else if (this.views === undefined) {
    this.views = 0;
    this.channels = [{ channel: 'Direct', views: 0 }];
  }

  if (this.views !== undefined) {
    const defaults = calculateDefaultDailyFigures(this.views, this.month);
    if (this.dailyFirstVisits === undefined || this.dailyFirstVisits === null) {
      this.dailyFirstVisits = defaults.dailyFirstVisits;
    }
    if (this.dailyVisitors === undefined || this.dailyVisitors === null) {
      this.dailyVisitors = defaults.dailyVisitors;
    }
  }
});

export const WebsiteMonth = mongoose.model('WebsiteMonth', websiteMonthSchema);

export const MONTHLY_REPORT_VIEWS = Object.freeze(['partner', 'team']);

const monthlyReportSchema = new mongoose.Schema(
  {
    reportMonth: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/,
      index: true,
    },
    view: {
      type: String,
      required: true,
      enum: ['partner', 'team'],
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    generatedByName: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

monthlyReportSchema.index({ reportMonth: 1, view: 1, generatedAt: 1 });

export const MonthlyReport = mongoose.model('MonthlyReport', monthlyReportSchema);
