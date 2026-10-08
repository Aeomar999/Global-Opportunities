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


