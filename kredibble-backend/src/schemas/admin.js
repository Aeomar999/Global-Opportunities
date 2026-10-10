import { z } from 'zod';
import { ROLE_IDS } from '../lib/permissions.js';
import { KPI_KEYS } from '../lib/targets.js';

// SEC-077, BE-001: add an existing Kredibble account to the admin staff list with 1 or 2 roles.
export const staffInviteSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    role: z.string().trim().min(2, 'Role is too short').max(80, 'Role is too long').optional(),
    roles: z.array(z.enum(ROLE_IDS)).min(1, 'At least 1 role required').max(2, 'At most 2 roles allowed').optional(),
  }).refine((data) => Boolean(data.role || (data.roles && data.roles.length > 0)), {
    message: 'Either role or roles must be provided',
    path: ['roles'],
  }),
});

// BE-002, BE-003: batch targets save schema with effective-from month (supports targets, thresholds, or both)
export const targetsBatchSchema = z.object({
  body: z.object({
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}$/, 'effectiveFrom must be YYYY-MM format'),
    targets: z.array(z.object({
      kpi: z.enum(KPI_KEYS, { errorMap: () => ({ message: 'Invalid KPI key' }) }),
      value: z.number().int('Target must be an integer').min(1, 'Target must be at least 1').max(10_000_000, 'Target cannot exceed 10,000,000'),
    })).min(1, 'At least one target change required').max(10, 'At most 10 target changes allowed')
    .refine((items) => {
      const keys = items.map((item) => item.kpi);
      return new Set(keys).size === keys.length;
    }, { message: 'Duplicate KPI in batch is not allowed' }).optional(),
    thresholds: z.object({
      green: z.number().int('Green must be an integer').min(1, 'Green must be at least 1').max(200, 'Green cannot exceed 200'),
      amber: z.number().int('Amber must be an integer').min(1, 'Amber must be at least 1').max(200, 'Amber cannot exceed 200'),
    }).refine((data) => data.amber < data.green, {
      message: 'amber must be below green',
      path: ['amber'],
    }).optional(),
  }).refine((data) => Boolean((data.targets && data.targets.length > 0) || data.thresholds), {
    message: 'Either targets or thresholds must be provided',
    path: ['targets'],
  }),
});

// BE-003: dedicated thresholds save schema
export const thresholdsSchema = z.object({
  body: z.object({
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}$/, 'effectiveFrom must be YYYY-MM format'),
    green: z.number().int('Green must be an integer').min(1, 'Green must be at least 1').max(200, 'Green cannot exceed 200'),
    amber: z.number().int('Amber must be an integer').min(1, 'Amber must be at least 1').max(200, 'Amber cannot exceed 200'),
  }).refine((data) => data.amber < data.green, {
    message: 'amber must be below green',
    path: ['amber'],
  }),
});

// BE-005: Program schemas
export const PROGRAM_TYPES = ['training', 'bootcamp', 'webinar', 'outreach', 'project', 'mentorship', 'event'];
export const PROGRAM_STATUSES = ['planned', 'running', 'delivered', 'cancelled'];
export const PROGRAM_FORMATS = ['online', 'in-person', 'hybrid', 'virtual'];

export const programSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long').optional(),
    name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long').optional(),
    programType: z.enum(PROGRAM_TYPES).optional(),
    type: z.enum(PROGRAM_TYPES).optional(),
    status: z.enum(PROGRAM_STATUSES).default('planned'),
    format: z.string().optional(),
    partnerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid partnerId').nullable().optional(),
    country: z.string().max(100).optional(),
    location: z.string().max(200).optional(),
    participantCount: z.number().int().min(0).optional(),
    participants: z.number().int().min(0).optional(),
    participantTarget: z.number().int().min(0).optional(),
    target: z.number().int().min(0).optional(),
    facilitators: z.array(z.string()).optional(),
    notes: z.string().max(2000).optional(),
    startAt: z.string().or(z.date()).optional(),
    endAt: z.string().or(z.date()).optional(),
    deliveredAt: z.string().or(z.date()).optional(),
  }).refine((data) => Boolean(data.title || data.name), {
    message: 'Title or name is required',
    path: ['title'],
  }).refine((data) => Boolean(data.programType || data.type), {
    message: 'programType or type is required',
    path: ['programType'],
  }).refine((data) => {
    if (data.status === 'delivered') {
      return Boolean(data.deliveredAt || data.endAt);
    }
    return true;
  }, {
    message: 'deliveredAt or endAt is required when status is delivered',
    path: ['deliveredAt'],
  }),
});

export const programUpdateSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    programType: z.enum(PROGRAM_TYPES).optional(),
    type: z.enum(PROGRAM_TYPES).optional(),
    status: z.enum(PROGRAM_STATUSES).optional(),
    format: z.string().optional(),
    partnerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid partnerId').nullable().optional(),
    country: z.string().max(100).optional(),
    location: z.string().max(200).optional(),
    participantCount: z.number().int().min(0).optional(),
    participants: z.number().int().min(0).optional(),
    participantTarget: z.number().int().min(0).optional(),
    target: z.number().int().min(0).optional(),
    facilitators: z.array(z.string()).optional(),
    notes: z.string().max(2000).optional(),
    startAt: z.string().or(z.date()).optional(),
    endAt: z.string().or(z.date()).optional(),
    deliveredAt: z.string().or(z.date()).optional(),
  }),
});

export const PARTNER_TYPES = [
  'corporate', 'university', 'foundation', 'NGO', 'ngo', 'government', 'media', 'tech', 'media_tech',
];

export const PARTNER_STAGES = [
  'prospect', 'outreach', 'proposal', 'MOU', 'mou', 'onboard', 'renew',
];

export const CANONICAL_STAGE_KEYS = [
  'prospect', 'outreach', 'proposal', 'mou', 'onboard', 'renew',
];

export const partnerCreateSchema = z.object({
  body: z.object({
    organizationName: z.string().trim().min(1, 'organizationName is required').max(200).optional(),
    name: z.string().trim().min(1, 'name is required').max(200).optional(),
    partnerType: z.enum(PARTNER_TYPES).optional(),
    type: z.enum(PARTNER_TYPES).optional(),
    stage: z.enum(PARTNER_STAGES).default('prospect'),
    assignedOwnerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ownerId').nullable().optional(),
    ownerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ownerId').nullable().optional(),
    country: z.string().max(100).optional(),
    sector: z.string().max(100).optional(),
    contactName: z.string().max(100).optional(),
    contactEmail: z.string().email('Invalid email').or(z.literal('')).optional(),
    contactPhone: z.string().max(50).optional(),
    provides: z.string().max(1000).optional(),
    sourcedBy: z.string().max(200).optional(),
    sourcedVia: z.string().max(200).optional(),
    notes: z.string().max(2000).optional(),
  }).refine((data) => Boolean(data.organizationName || data.name), {
    message: 'organizationName or name is required',
    path: ['organizationName'],
  }).refine((data) => Boolean(data.partnerType || data.type), {
    message: 'partnerType or type is required',
    path: ['partnerType'],
  }),
});

export const partnerUpdateSchema = z.object({
  body: z.object({
    organizationName: z.string().trim().min(1).max(200).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    partnerType: z.enum(PARTNER_TYPES).optional(),
    type: z.enum(PARTNER_TYPES).optional(),
    stage: z.enum(PARTNER_STAGES).optional(),
    assignedOwnerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ownerId').nullable().optional(),
    ownerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ownerId').nullable().optional(),
    country: z.string().max(100).optional(),
    sector: z.string().max(100).optional(),
    contactName: z.string().max(100).optional(),
    contactEmail: z.string().email('Invalid email').or(z.literal('')).optional(),
    contactPhone: z.string().max(50).optional(),
    provides: z.string().max(1000).optional(),
    sourcedBy: z.string().max(200).optional(),
    sourcedVia: z.string().max(200).optional(),
    notes: z.string().max(2000).optional(),
  }),
});

export const partnerMoveSchema = z.object({
  body: z.object({
    to: z.enum(PARTNER_STAGES, { errorMap: () => ({ message: 'Invalid target stage' }) }),
  }),
});

export const pipelineStagesSchema = z.object({
  body: z.object({
    reset: z.boolean().optional(),
    stages: z.record(z.string()).optional(),
    prospect: z.string().optional(),
    outreach: z.string().optional(),
    proposal: z.string().optional(),
    mou: z.string().optional(),
    onboard: z.string().optional(),
    renew: z.string().optional(),
  }).refine((body) => {
    if (body.reset === true) return true;
    const stages = body.stages || body;
    for (const key of CANONICAL_STAGE_KEYS) {
      const val = stages[key];
      if (typeof val !== 'string' || val.trim().length < 1 || val.trim().length > 24) {
        return false;
      }
    }
    const labels = CANONICAL_STAGE_KEYS.map((key) => String(stages[key]).trim().toLowerCase());
    return new Set(labels).size === CANONICAL_STAGE_KEYS.length;
  }, {
    message: 'Each of the six stage labels must be 1 to 24 characters and unique from each other',
    path: ['stages'],
  }),
});

export const AMBASSADOR_TIERS = [
  'ambassador', 'senior', 'lead',
  'Ambassador', 'Senior Ambassador', 'Campus Lead', 'Regional Lead',
];

export const AMBASSADOR_STATUSES = [
  'applicant', 'onboarding', 'active', 'dormant',
];

export const MEMBER_TYPES = [
  'student', 'graduate', 'staff', 'volunteer',
];

export const ambassadorCreateSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(1, 'fullName is required').max(200).optional(),
    name: z.string().trim().min(1, 'name is required').max(200).optional(),
    email: z.string().email('Invalid email').trim().toLowerCase(),
    phone: z.string().max(50).optional(),
    country: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    campus: z.string().max(200).optional(),
    memberType: z.enum(MEMBER_TYPES).optional(),
    description: z.string().max(2000).optional(),
    roleTitle: z.string().max(200).optional(),
    profilePhoto: z.string().max(1000).optional(),
    photoUrl: z.string().max(1000).optional(),
    tier: z.enum(AMBASSADOR_TIERS).optional(),
    status: z.enum(AMBASSADOR_STATUSES).optional(),
    assignedLeadId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid assignedLeadId').nullable().optional(),
    trained: z.boolean().optional(),
    linkedUserId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid linkedUserId').nullable().optional(),
    linkedSeekerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid linkedSeekerId').nullable().optional(),
    referralCode: z.string().regex(/^GOD-[2-9A-HJ-NP-Z]{6}$/, 'Invalid referralCode format (must be GOD- followed by 6 characters excluding 0, O, 1, I)').optional(),
    joinedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'joinedAt must be YYYY-MM-DD').optional(),
    dormantSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dormantSince must be YYYY-MM-DD').optional(),
  }).refine((data) => Boolean(data.fullName || data.name), {
    message: 'fullName or name is required',
    path: ['fullName'],
  }),
});

export const ambassadorUpdateSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(1).max(200).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().email('Invalid email').trim().toLowerCase().optional(),
    phone: z.string().max(50).optional(),
    country: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    campus: z.string().max(200).optional(),
    memberType: z.enum(MEMBER_TYPES).optional(),
    description: z.string().max(2000).optional(),
    roleTitle: z.string().max(200).optional(),
    profilePhoto: z.string().max(1000).optional(),
    photoUrl: z.string().max(1000).optional(),
    tier: z.enum(AMBASSADOR_TIERS).optional(),
    status: z.enum(AMBASSADOR_STATUSES).optional(),
    assignedLeadId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid assignedLeadId').nullable().optional(),
    trained: z.boolean().optional(),
    linkedUserId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid linkedUserId').nullable().optional(),
    linkedSeekerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid linkedSeekerId').nullable().optional(),
    referralCode: z.string().optional(),
    joinedAt: z.string().optional(),
    dormantSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dormantSince must be YYYY-MM-DD').nullable().optional(),
  }),
});

export const amplificationCreateSchema = z.object({
  body: z.object({
    channel: z.string().trim().min(1, 'channel is required').max(100),
    at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'at must be YYYY-MM-DD').optional(),
    clicks: z.number().int().min(0).optional(),
    applications: z.number().int().min(0).optional(),
    listingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid listingId').nullable().optional(),
    note: z.string().max(2000).optional(),
  }),
});

export const BENEFICIARY_SOURCES = [
  'organic', 'ambassador', 'event', 'partner', 'import',
  'ambassador-referral', 'partner-channel', 'bulk-import',
];

export const beneficiaryCreateSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(1).max(200).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().toLowerCase().pipe(z.string().email('Invalid email')).optional(),
    phone: z.string().max(50).optional(),
    country: z.string().max(100).optional(),
    institution: z.string().max(200).optional(),
    source: z.enum(BENEFICIARY_SOURCES).optional(),
    sourceType: z.enum(BENEFICIARY_SOURCES).optional(),
    verified: z.boolean().optional(),
    verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'verifiedAt must be YYYY-MM-DD').optional(),
    createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'createdAt must be YYYY-MM-DD').optional(),
    ambassadorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ambassadorId').nullable().optional(),
    opportunityId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid opportunityId').nullable().optional(),
    listingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid listingId').nullable().optional(),
  }).refine((data) => Boolean(data.fullName || data.name), {
    message: 'name or fullName is required',
    path: ['fullName'],
  }).refine((data) => Boolean(data.email || data.phone), {
    message: 'email or phone is required',
    path: ['email'],
  }).refine((data) => {
    const src = data.source || data.sourceType;
    if ((src === 'ambassador' || src === 'ambassador-referral') && !data.ambassadorId) {
      return false;
    }
    return true;
  }, {
    message: 'ambassadorId is required for ambassador-referral records',
    path: ['ambassadorId'],
  }),
});

export const beneficiaryUpdateSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(1).max(200).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().toLowerCase().pipe(z.string().email('Invalid email')).optional(),
    phone: z.string().max(50).optional(),
    country: z.string().max(100).optional(),
    institution: z.string().max(200).optional(),
    source: z.enum(BENEFICIARY_SOURCES).optional(),
    sourceType: z.enum(BENEFICIARY_SOURCES).optional(),
    verified: z.boolean().optional(),
    verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'verifiedAt must be YYYY-MM-DD').nullable().optional(),
    createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'createdAt must be YYYY-MM-DD').optional(),
    ambassadorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ambassadorId').nullable().optional(),
    opportunityId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid opportunityId').nullable().optional(),
    listingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid listingId').nullable().optional(),
  }),
});

export const beneficiaryUndoVerifySchema = z.object({
  body: z.object({
    verified: z.boolean().optional(),
    verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'verifiedAt must be YYYY-MM-DD').nullable().optional(),
  }),
});

// BE-009: Social Post schemas
export const SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'x',
  'linkedin',
  'tiktok',
  'youtube',
  'whatsapp',
  'other',
];

export const SOCIAL_STATUSES = ['draft', 'scheduled', 'published'];

export const postUrlSchema = z.string().trim().refine((val) => {
  if (!val) return false;
  if (/\s/.test(val)) return false;
  try {
    const url = new URL(val);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (!url.hostname.includes('.') || url.hostname.startsWith('.') || url.hostname.endsWith('.')) return false;
    return true;
  } catch {
    return false;
  }
}, { message: 'The link must be a valid http or https URL with a real host' });

export const notFutureDateSchema = z.string().or(z.date()).refine((val) => {
  if (!val) return false;
  const todayIso = new Date().toISOString().slice(0, 10);
  let dateIso;
  if (typeof val === 'string') {
    dateIso = val.slice(0, 10);
  } else {
    dateIso = new Date(val).toISOString().slice(0, 10);
  }
  return dateIso <= todayIso;
}, { message: 'The date posted cannot be in the future' });

export const socialPostCreateSchema = z.object({
  body: z.object({
    platform: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
      z.enum(SOCIAL_PLATFORMS, { errorMap: () => ({ message: 'Invalid social platform' }) })
    ),
    title: z.string().trim().min(1, 'Title is required').max(300, 'Title is too long'),
    text: z.string().trim().max(5000).optional(),
    url: postUrlSchema,
    reach: z.number().int('Reach must be an integer').min(0, 'Reach cannot be negative').default(0),
    engagement: z.number().int('Engagement must be an integer').min(0, 'Engagement cannot be negative').default(0),
    status: z.enum(SOCIAL_STATUSES).default('published'),
    postedAt: notFutureDateSchema,
    listingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid listingId').nullable().optional(),
    opportunityId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid opportunityId').nullable().optional(),
  }),
});

export const socialPostUpdateSchema = z.object({
  body: z.object({
    platform: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
      z.enum(SOCIAL_PLATFORMS, { errorMap: () => ({ message: 'Invalid social platform' }) })
    ).optional(),
    title: z.string().trim().min(1, 'Title is required').max(300, 'Title is too long').optional(),
    text: z.string().trim().max(5000).optional(),
    url: postUrlSchema.optional(),
    reach: z.number().int().min(0).optional(),
    engagement: z.number().int().min(0).optional(),
    status: z.enum(SOCIAL_STATUSES).optional(),
    postedAt: notFutureDateSchema.optional(),
    listingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid listingId').nullable().optional(),
    opportunityId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid opportunityId').nullable().optional(),
  }),
});

export const TESTIMONIAL_STATUS_VALUES = ['pending', 'approved', 'unpublished', 'rejected'];
export const TESTIMONIAL_ACTION_VALUES = ['approve', 'reject', 'unpublish', 'reapprove'];

export const testimonialCreateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    author: z.string().trim().min(2, 'Author must be at least 2 characters').max(100).optional(),
    email: z.string().trim().email('Valid email address is required').max(200),
    comment: z.string().trim().min(5, 'Comment must be at least 5 characters').max(2000).optional(),
    quote: z.string().trim().min(5, 'Quote must be at least 5 characters').max(2000).optional(),
    role: z.string().trim().max(100).optional(),
    photo: z.string().trim().url('Photo must be a valid URL').optional().or(z.literal('')),
    status: z.enum(TESTIMONIAL_STATUS_VALUES).default('pending'),
    submittedAt: notFutureDateSchema.optional(),
  }).refine((data) => Boolean(data.name || data.author), {
    message: 'name or author is required',
    path: ['name'],
  }).refine((data) => Boolean(data.comment || data.quote), {
    message: 'comment or quote is required',
    path: ['comment'],
  }),
});

export const testimonialModerateSchema = z.object({
  body: z.object({
    status: z.enum(TESTIMONIAL_STATUS_VALUES).optional(),
    action: z.enum(TESTIMONIAL_ACTION_VALUES).optional(),
    rejectionReason: z.string().trim().max(500).optional(),
  }).refine((data) => Boolean(data.status || data.action), {
    message: 'Either status or action must be provided',
    path: ['status'],
  }),
});

export const testimonialUpdateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    author: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().email().max(200).optional(),
    comment: z.string().trim().min(5).max(2000).optional(),
    quote: z.string().trim().min(5).max(2000).optional(),
    role: z.string().trim().max(100).optional(),
    photo: z.string().trim().url().optional().or(z.literal('')),
    status: z.enum(TESTIMONIAL_STATUS_VALUES).optional(),
    action: z.enum(TESTIMONIAL_ACTION_VALUES).optional(),
    rejectionReason: z.string().trim().max(500).optional(),
  }),
});

export const OPPORTUNITY_STATUS_VALUES = ['draft', 'published', 'pending', 'approved', 'rejected', 'archived'];
export const OPPORTUNITY_FORMAT_VALUES = ['online', 'in-person', 'hybrid'];

export const opportunityCreateSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
    type: z.string().trim().min(2, 'Type is required').max(50),
    company: z.string().trim().min(2).max(200).optional(),
    organisation: z.string().trim().min(2).max(200).optional(),
    offeringOrganization: z.string().trim().max(200).optional(),
    location: z.string().trim().max(200).optional().default('Online'),
    country: z.string().trim().max(100).optional(),
    description: z.string().trim().min(5, 'Description must be at least 5 characters').max(20000),
    status: z.enum(OPPORTUNITY_STATUS_VALUES).optional(),
    publish: z.boolean().optional(),
    vetted: z.boolean().optional(),
    vettedById: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vettedById').nullable().optional(),
    vettedBy: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vettedBy').nullable().optional(),
    vettedOn: z.string().trim().optional(),
    publishedAt: z.string().trim().optional(),
    writerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid writerId').nullable().optional(),
    assignedWriterId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid assignedWriterId').nullable().optional(),
    closesAt: z.string().trim().optional(),
    deadline: z.string().trim().optional(),
    applyUrl: z.string().trim().optional(),
    applicationUrl: z.string().trim().optional(),
    applicationLink: z.string().trim().optional(),
    costLabel: z.string().trim().max(100).optional(),
    durationLabel: z.string().trim().max(100).optional(),
    format: z.enum(OPPORTUNITY_FORMAT_VALUES).optional().default('online'),
    eventAt: z.string().trim().optional(),
    eventDateTime: z.string().trim().optional(),
    logoUrl: z.string().trim().optional(),
    organizationLogo: z.string().trim().optional(),
    imageUrl: z.string().trim().optional(),
    coverImage: z.string().trim().optional(),
    images: z.array(z.string().trim()).optional(),
    referralOnApply: z.boolean().optional(),
    referralCodeOnApply: z.boolean().optional(),
    workType: z.string().trim().optional(),
    salary: z.string().trim().optional(),
  }).refine((data) => Boolean(data.company || data.organisation || data.offeringOrganization), {
    message: 'organisation or company is required',
    path: ['organisation'],
  }),
});

export const opportunityUpdateSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(200).optional(),
    type: z.string().trim().min(2).max(50).optional(),
    company: z.string().trim().min(2).max(200).optional(),
    organisation: z.string().trim().min(2).max(200).optional(),
    offeringOrganization: z.string().trim().max(200).optional(),
    location: z.string().trim().max(200).optional(),
    country: z.string().trim().max(100).optional(),
    description: z.string().trim().min(5).max(20000).optional(),
    status: z.enum(OPPORTUNITY_STATUS_VALUES).optional(),
    moderationStatus: z.string().trim().optional(),
    publish: z.boolean().optional(),
    vetted: z.boolean().optional(),
    vettedById: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vettedById').nullable().optional(),
    vettedBy: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vettedBy').nullable().optional(),
    vettedOn: z.string().trim().optional(),
    publishedAt: z.string().trim().nullable().optional(),
    writerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid writerId').nullable().optional(),
    assignedWriterId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid assignedWriterId').nullable().optional(),
    closesAt: z.string().trim().optional(),
    deadline: z.string().trim().optional(),
    applyUrl: z.string().trim().optional(),
    applicationUrl: z.string().trim().optional(),
    applicationLink: z.string().trim().optional(),
    costLabel: z.string().trim().max(100).optional(),
    durationLabel: z.string().trim().max(100).optional(),
    format: z.enum(OPPORTUNITY_FORMAT_VALUES).optional(),
    eventAt: z.string().trim().optional(),
    eventDateTime: z.string().trim().optional(),
    logoUrl: z.string().trim().optional(),
    organizationLogo: z.string().trim().optional(),
    imageUrl: z.string().trim().optional(),
    coverImage: z.string().trim().optional(),
    images: z.array(z.string().trim()).optional(),
    referralOnApply: z.boolean().optional(),
    referralCodeOnApply: z.boolean().optional(),
    workType: z.string().trim().optional(),
    salary: z.string().trim().optional(),
  }),
});

export const opportunityModerateDecisionSchema = z.object({
  body: z.object({
    decision: z.enum(['approve', 'reject']).optional(),
    moderationStatus: z.enum(['approved', 'rejected', 'published', 'pending']).optional(),
    vetted: z.boolean().optional(),
    note: z.string().trim().max(1000).optional(),
  }).refine((data) => Boolean(data.decision || data.moderationStatus || data.vetted !== undefined), {
    message: 'Either decision, moderationStatus, or vetted must be provided',
    path: ['decision'],
  }),
});

// BE-012: Website Audience schemas
export const websiteChannelSchema = z.object({
  channel: z.string().trim().min(1, 'Channel name is required').max(100, 'Channel name is too long'),
  views: z.number().int('Views must be an integer').min(0, 'Views must be non-negative'),
});

export const websiteMonthInputSchema = z.object({
  body: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM format').optional(),
    views: z.number().int('Views must be an integer').min(0, 'Views must be non-negative').optional(),
    dailyFirstVisits: z.number().int('dailyFirstVisits must be an integer').min(0, 'dailyFirstVisits must be non-negative').optional(),
    dailyVisitors: z.number().int('dailyVisitors must be an integer').min(0, 'dailyVisitors must be non-negative').optional(),
    channels: z.array(websiteChannelSchema).optional(),
    source: z.enum(['manual', 'ga4']).default('manual').optional(),
  }).refine((data) => {
    if (data.views !== undefined && data.channels && data.channels.length > 0) {
      const sum = data.channels.reduce((acc, c) => acc + c.views, 0);
      return sum === data.views;
    }
    return data.views !== undefined || (data.channels && data.channels.length > 0);
  }, {
    message: 'Channel views must add up to total views',
    path: ['channels'],
  }),
  params: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM format').optional(),
  }).optional(),
});

export const websiteAudienceQuerySchema = z.object({
  query: z.object({
    months: z.coerce.number().int().min(1).max(36).default(6).optional(),
    order: z.enum(['asc', 'desc']).default('asc').optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM format').optional(),
  }).optional(),
});

// BE-013: Monthly Reports schemas
export const monthlyReportCreateSchema = z.object({
  body: z.object({
    reportMonth: z.string().regex(/^\d{4}-\d{2}$/, 'reportMonth must be YYYY-MM format'),
    view: z.enum(['partner', 'team']),
    generatedAt: z.string().or(z.date()).optional(),
  }),
});

export const monthlyReportQuerySchema = z.object({
  query: z.object({
    reportMonth: z.string().regex(/^\d{4}-\d{2}$/, 'reportMonth must be YYYY-MM format').optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM format').optional(),
    view: z.enum(['partner', 'team']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  }).optional(),
});





