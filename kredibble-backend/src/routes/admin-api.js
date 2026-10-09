import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAdminOrStaffAuth, requireAdminAuth } from '../middleware/auth.js';
import { requirePortalRoles, requireScreen } from '../middleware/portal-auth.js';
import { ApiError, asyncHandler, itemResponse, listResponse, notFound } from '../utils/http.js';
import { Opportunity } from '../models/Platform.js';
import { StaffMember, User } from '../models/User.js';
import { Channel, CommunityMembership } from '../models/Community.js';
import { SeekerProfile, HirerAccount } from '../models/Profiles.js';
import {
  AdminActivity,
  Ambassador,
  AmbassadorRequest,
  AmbassadorAmplification,
  Beneficiary,
  MonthlyTarget,
  OpportunityEngagement,
  Partner,
  Program,
  SocialPost,
  Testimonial,
  RolePermissionConfig,
  PipelineStageConfig,
  DEFAULT_PIPELINE_STAGE_LABELS,
  normalizeEmail,
  normalizePhone,
  CANONICAL_RECORD_SOURCES,
  RECORD_SOURCE_LABELS,
  CANONICAL_SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  normalizeSocialPlatform,
  SOCIAL_POST_STATUSES,
} from '../models/AdminPortal.js';
import { deleteFromWordpress, syncToWordpress } from '../lib/wordpress-sync.js';
import { env } from '../config/env.js';
import {
  ROLE_IDS,
  SCREENS,
  getEffectiveToggles,
  computeFullMatrix,
  invalidateTogglesCache,
} from '../lib/permissions.js';
import { auditReq, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../lib/audit.js';
import { getTargetsForMonth, getTargetHistory, saveTargetBatch, KPI_KEYS } from '../lib/targets.js';
import { getThresholdsInForce, getThresholdHistory, saveThresholdChange, getCombinedChangeHistory } from '../lib/thresholds.js';
import {
  targetsBatchSchema,
  thresholdsSchema,
  programSchema,
  programUpdateSchema,
  partnerCreateSchema,
  partnerUpdateSchema,
  partnerMoveSchema,
  pipelineStagesSchema,
  ambassadorCreateSchema,
  ambassadorUpdateSchema,
  amplificationCreateSchema,
  beneficiaryCreateSchema,
  beneficiaryUpdateSchema,
  beneficiaryUndoVerifySchema,
  socialPostCreateSchema,
  socialPostUpdateSchema,
} from '../schemas/admin.js';
import { validate } from '../middleware/validate.js';
import { postChannelMessage, listChannelMessages, getThread, findPost, setAllowReplies } from '../lib/chat.js';
import { notifyUser } from '../lib/user-notify.js';
import { evictFromChannelRoom } from '../socket.js';
import { toRequestResponse } from './ambassador.js';
import {
  approveAmbassadorRequestSchema, rejectAmbassadorRequestSchema, chatMessageSchema,
  createAdminChannelSchema, addChannelMemberSchema, allowRepliesSchema,
} from '../schemas/ambassador.js';

export const adminApiRouter = Router();

const ALL_PORTAL_ROLES = [
  'Partnerships Officer', 'Opportunities Officer', 'Writer', 'Training and Capacity Development Officer',
  'Database Officer', 'Communications Officer', 'Social Media Manager', 'Country Lead', 'Admin Support', 'Desk Lead',
];
const OPPORTUNITY_ROLES = ['Opportunities Officer', 'Writer', 'Desk Lead'];
const PROGRAM_ROLES = ['Training and Capacity Development Officer', 'Desk Lead'];
const PARTNER_ROLES = ['Partnerships Officer', 'Desk Lead'];
const AMBASSADOR_ROLES = ['Communications Officer', 'Social Media Manager', 'Country Lead', 'Desk Lead'];
const SOCIAL_ROLES = ['Communications Officer', 'Social Media Manager', 'Desk Lead'];
const configured = (value) => Boolean(value && !value.includes('placeholder'));
const escapedRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pageOptions = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return { page, skip: (page - 1) * limit, limit };
};

const toClientObject = (document) => {
  if (!document) return null;
  const value = document.toJSON ? document.toJSON() : document;
  return { id: value.id || value._id?.toString(), ...value, _id: undefined, __v: undefined };
};

const validId = (id, resource) => {
  if (!mongoose.isValidObjectId(id)) throw notFound(resource);
  return id;
};

const monthBounds = (month) => {
  const value = /^\d{4}-\d{2}$/.test(month || '') ? month : new Date().toISOString().slice(0, 7);
  const start = new Date(`${value}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { month: value, start, end };
};

const logActivity = (actorId, action, entityType, document) =>
  AdminActivity.create({ actorId, action, entityType, entityId: document._id, summary: document.title || document.name || document.fullName || document.organizationName });

export const toPartnerClientObject = (document) => {
  if (!document) return null;
  const value = document.toJSON ? document.toJSON({ virtuals: true }) : document;
  const ownerDoc = value.assignedOwnerId;
  const ownerName = ownerDoc && typeof ownerDoc === 'object'
    ? (ownerDoc.name || undefined)
    : undefined;
  const ownerIdStr = ownerDoc && typeof ownerDoc === 'object'
    ? (ownerDoc._id?.toString() || ownerDoc.id)
    : (ownerDoc ? ownerDoc.toString() : undefined);

  const stage = value.stage || 'prospect';
  const isClosed = ['onboard', 'renew'].includes(String(stage).toLowerCase());

  return {
    id: value.id || value._id?.toString(),
    ...value,
    _id: undefined,
    __v: undefined,
    name: value.name || value.organizationName,
    organizationName: value.organizationName || value.name,
    type: value.type || value.partnerType,
    partnerType: value.partnerType || value.type,
    ownerId: ownerIdStr,
    assignedOwnerId: ownerIdStr,
    ownerName,
    stage,
    stageHistory: (value.stageHistory || []).map((entry) => ({
      stage: entry.stage,
      at: entry.at,
      from: entry.from,
      by: entry.by?._id?.toString() || entry.by?.toString() || entry.by,
      byName: entry.byName,
    })),
    closed: isClosed,
    sourcedVia: value.sourcedVia || value.sourcedBy,
    sourcedBy: value.sourcedBy || value.sourcedVia,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

export const preparePartner = (data = {}, actorId, existing = {}) => {
  const organizationName = (data.organizationName || data.name || existing.organizationName || '').trim();
  const partnerType = data.partnerType || data.type || existing.partnerType || 'corporate';
  let stage = data.stage || existing.stage || 'prospect';
  if (String(stage).toLowerCase() === 'mou') stage = 'mou';

  const assignedOwnerId = data.assignedOwnerId !== undefined
    ? (data.assignedOwnerId || null)
    : (data.ownerId !== undefined ? (data.ownerId || null) : existing.assignedOwnerId);

  const prepared = {
    organizationName,
    partnerType,
    stage,
    assignedOwnerId,
    country: data.country ?? existing.country,
    sector: data.sector ?? existing.sector,
    contactName: data.contactName ?? existing.contactName,
    contactEmail: data.contactEmail ?? existing.contactEmail,
    contactPhone: data.contactPhone ?? existing.contactPhone,
    provides: data.provides ?? existing.provides,
    sourcedBy: data.sourcedBy ?? data.sourcedVia ?? existing.sourcedBy,
    notes: data.notes ?? existing.notes,
  };

  if (Array.isArray(data.stageHistory) && data.stageHistory.length > 0) {
    prepared.stageHistory = data.stageHistory;
  }

  return prepared;
};

const syncManagedRecord = async (resource, document) => {
  if (resource === 'opportunities' && !document.vetted) {
    document.wordpressSync = {
      ...document.wordpressSync?.toObject?.(),
      status: 'pending',
      lastAttemptAt: new Date(),
      lastError: 'Awaiting opportunity vetting before WordPress publication',
    };
    await document.save();
    return { status: 'pending' };
  }
  const result = await syncToWordpress(resource, document);
  if (resource === 'ambassadors' && result.payload?.referralCode && !document.referralCode) {
    document.referralCode = result.payload.referralCode;
    await document.save();
  }
  return result;
};

const addManagedRoutes = ({
  path,
  Model,
  resource,
  roles,
  screen,
  prepare = (data) => data,
  transform = toClientObject,
  populate,
  validateCreate,
  validateUpdate,
  filters = [],
}) => {
  const viewAuth = screen
    ? [requireAdminOrStaffAuth, requireScreen(screen, 'view')]
    : [requireAdminOrStaffAuth, requirePortalRoles(...roles)];
  const editAuth = screen
    ? [requireAdminOrStaffAuth, requireScreen(screen, 'edit')]
    : [requireAdminOrStaffAuth, requirePortalRoles(...roles)];

  adminApiRouter.get(path, ...viewAuth, asyncHandler(async (req, res) => {
    const filter = {};
    for (const key of filters) if (req.query[key]) filter[key] = req.query[key];
    if (req.query.q) {
      filter.$or = ['title', 'organizationName', 'fullName', 'email', 'country'].map((field) => ({ [field]: { $regex: escapedRegex(req.query.q), $options: 'i' } }));
    }
    const { skip, limit } = pageOptions(req.query);
    let query = Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
    if (populate) query = query.populate(populate);
    const records = await query;
    listResponse(res, records.map(transform));
  }));

  adminApiRouter.get(`${path}/:id`, ...viewAuth, asyncHandler(async (req, res) => {
    let query = Model.findById(validId(req.params.id, resource));
    if (populate) query = query.populate(populate);
    const record = await query;
    if (!record) throw notFound(resource);
    itemResponse(res, transform(record));
  }));

  const postMiddlewares = [...editAuth];
  if (validateCreate) postMiddlewares.push(validateCreate);
  adminApiRouter.post(path, ...postMiddlewares, asyncHandler(async (req, res) => {
    const prepared = prepare(req.body, req.auth.sub);
    const record = new Model({ ...prepared, createdBy: req.auth.sub });
    await record.save();
    if (populate) await record.populate(populate);
    const sync = await syncManagedRecord(resource, record);
    await logActivity(req.auth.sub, 'created', resource, record);
    if (resource === 'ambassadors') {
      await auditReq(req, {
        action: AUDIT_ACTIONS.AMBASSADOR_CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.AMBASSADOR,
        resourceId: record._id,
        outcome: 'success',
        metadata: { name: record.fullName, referralCode: record.referralCode },
      });
    }
    res.status(201).json({ data: { ...transform(record), sync } });
  }));

  const patchMiddlewares = [...editAuth];
  if (validateUpdate) patchMiddlewares.push(validateUpdate);
  adminApiRouter.patch(`${path}/:id`, ...patchMiddlewares, asyncHandler(async (req, res) => {
    const record = await Model.findById(validId(req.params.id, resource));
    if (!record) throw notFound(resource);
    const prepared = prepare(req.body, req.auth.sub, record);
    Object.assign(record, prepared);
    await record.save();
    if (populate) await record.populate(populate);
    const sync = await syncManagedRecord(resource, record);
    await logActivity(req.auth.sub, 'updated', resource, record);
    if (resource === 'ambassadors') {
      await auditReq(req, {
        action: AUDIT_ACTIONS.AMBASSADOR_UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES.AMBASSADOR,
        resourceId: record._id,
        outcome: 'success',
        metadata: { name: record.fullName, status: record.status, tier: record.tier },
      });
    }
    itemResponse(res, { ...transform(record), sync });
  }));

  adminApiRouter.post(`${path}/:id/retry-wordpress-sync`, ...editAuth, asyncHandler(async (req, res) => {
    const record = await Model.findById(validId(req.params.id, resource));
    if (!record) throw notFound(resource);
    itemResponse(res, { ...toClientObject(record), sync: await syncManagedRecord(resource, record) });
  }));

  adminApiRouter.delete(`${path}/:id`, ...editAuth, asyncHandler(async (req, res) => {
    const record = await Model.findById(validId(req.params.id, resource));
    if (!record) throw notFound(resource);
    let sync = { status: 'pending' };
    try {
      sync = await deleteFromWordpress(resource, record);
    } catch (error) {
      record.wordpressSync = { ...record.wordpressSync?.toObject?.(), status: 'failed', lastError: error.message, lastAttemptAt: new Date() };
      await record.save();
      throw new ApiError(502, 'WordPress deletion failed. The local record was retained for retry.');
    }
    await record.deleteOne();
    await logActivity(req.auth.sub, 'deleted', resource, record);
    if (resource === 'ambassadors') {
      await auditReq(req, {
        action: AUDIT_ACTIONS.AMBASSADOR_DELETE,
        resourceType: AUDIT_RESOURCE_TYPES.AMBASSADOR,
        resourceId: record._id,
        outcome: 'success',
        metadata: { name: record.fullName },
      });
    }
    res.json({ data: { id: req.params.id, sync } });
  }));
};

const OPPORTUNITY_ALLOWED_FIELDS = [
  'title', 'type', 'company', 'offeringOrganization', 'location', 'description',
  'date', 'workType', 'salary', 'experienceLevels', 'eventDateTime', 'eventRegion',
  'eventCategory', 'grantBudgetRange', 'grantSector', 'status', 'moderationStatus',
  'vetted', 'deadline', 'url', 'coverImage', 'assignedWriterId', 'referralCodeOnApply', 'category',
];

const prepareOpportunity = (data, actorId, existing = {}) => {
  const allowed = {};
  for (const field of OPPORTUNITY_ALLOWED_FIELDS) {
    if (field in data) {
      allowed[field] = data[field];
    }
  }

  const next = {
    ...allowed,
    company: allowed.company || allowed.offeringOrganization || existing.company,
    offeringOrganization: allowed.offeringOrganization || allowed.company || existing.offeringOrganization,
  };
  if (allowed.vetted === true && !existing.vetted) {
    next.vettedBy = actorId;
    next.vettedAt = new Date();
  }
  const publishing = next.moderationStatus === 'published' || next.moderationStatus === 'approved';
  const vetted = next.vetted ?? existing.vetted;
  if (publishing && !vetted) throw new ApiError(400, 'An opportunity must be vetted before it can be published');
  return next;
};

adminApiRouter.get('/opportunities', requireAdminOrStaffAuth, requirePortalRoles(...OPPORTUNITY_ROLES), asyncHandler(async (req, res) => {
  const filter = {};
  for (const key of ['country', 'type', 'moderationStatus', 'vetted']) {
    const value = req.query[key];
    if (value === undefined) continue;
    // SEC-061: a filter value is a plain string, never an operator object.
    if (typeof value !== 'string') throw new ApiError(400, 'Invalid query parameters');
    filter[key] = key === 'vetted' ? value === 'true' : value;
  }
  const { page, skip, limit } = pageOptions(req.query);
  // Real totals, so a client can tell when it has read every page (the admin's Opportunities Queue does).
  const [records, total] = await Promise.all([
    Opportunity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Opportunity.countDocuments(filter),
  ]);
  listResponse(res, records.map(toClientObject), total, page, limit);
}));

adminApiRouter.post('/opportunities', requireAdminOrStaffAuth, requirePortalRoles(...OPPORTUNITY_ROLES), asyncHandler(async (req, res) => {
  const record = new Opportunity({ ...prepareOpportunity(req.body, req.auth.sub), createdBy: req.auth.sub });
  await record.save();
  const sync = await syncManagedRecord('opportunities', record);
  await logActivity(req.auth.sub, 'created', 'opportunities', record);
  res.status(201).json({ data: { ...toClientObject(record), sync } });
}));

adminApiRouter.patch('/opportunities/:id', requireAdminOrStaffAuth, requirePortalRoles(...OPPORTUNITY_ROLES), asyncHandler(async (req, res) => {
  const record = await Opportunity.findById(validId(req.params.id, 'Opportunity'));
  if (!record) throw notFound('Opportunity');
  Object.assign(record, prepareOpportunity(req.body, req.auth.sub, record));
  await record.save();
  const sync = await syncManagedRecord('opportunities', record);
  await logActivity(req.auth.sub, 'updated', 'opportunities', record);
  itemResponse(res, { ...toClientObject(record), sync });
}));

adminApiRouter.get('/opportunities/:id/analytics', requireAdminOrStaffAuth, requirePortalRoles(...OPPORTUNITY_ROLES), asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(validId(req.params.id, 'Opportunity'));
  if (!opportunity) throw notFound('Opportunity');
  const totals = await OpportunityEngagement.aggregate([
    { $match: { opportunityId: opportunity._id } },
    { $group: { _id: { event: '$event', source: '$source' }, count: { $sum: 1 } } },
  ]);
  const analytics = { views: { total: 0, app: 0, website: 0 }, applications: { total: 0, app: 0, website: 0 } };
  for (const item of totals) {
    const key = item._id.event === 'view' ? 'views' : 'applications';
    analytics[key][item._id.source] = item.count;
    analytics[key].total += item.count;
  }
  itemResponse(res, analytics);
}));

adminApiRouter.delete('/opportunities/:id', requireAdminOrStaffAuth, requirePortalRoles(...OPPORTUNITY_ROLES), asyncHandler(async (req, res) => {
  const record = await Opportunity.findById(validId(req.params.id, 'Opportunity'));
  if (!record) throw notFound('Opportunity');
  let sync = { status: 'pending' };
  try {
    sync = await deleteFromWordpress('opportunities', record);
  } catch (error) {
    record.wordpressSync = { ...record.wordpressSync?.toObject?.(), status: 'failed', lastError: error.message, lastAttemptAt: new Date() };
    await record.save();
    throw new ApiError(502, 'WordPress deletion failed. The local record was retained for retry.');
  }
  await record.deleteOne();
  await logActivity(req.auth.sub, 'deleted', 'opportunities', record);
  itemResponse(res, { id: req.params.id, sync });
}));

adminApiRouter.post('/opportunities/:id/retry-wordpress-sync', requireAdminOrStaffAuth, requirePortalRoles(...OPPORTUNITY_ROLES), asyncHandler(async (req, res) => {
  const record = await Opportunity.findById(validId(req.params.id, 'Opportunity'));
  if (!record) throw notFound('Opportunity');
  itemResponse(res, { ...toClientObject(record), sync: await syncManagedRecord('opportunities', record) });
}));

export const toProgramClientObject = (document) => {
  if (!document) return null;
  const value = document.toJSON ? document.toJSON({ virtuals: true }) : document;
  const participantCount = value.participantCount ?? value.participants ?? 0;
  const participantTarget = value.participantTarget ?? value.target ?? 0;
  const warning = (participantTarget > 0 && participantCount > participantTarget)
    ? `Participants (${participantCount}) exceed target (${participantTarget})`
    : undefined;

  const partnerDoc = value.partnerId;
  const partnerName = partnerDoc && typeof partnerDoc === 'object'
    ? (partnerDoc.organizationName || partnerDoc.name || undefined)
    : undefined;
  const partnerIdStr = partnerDoc && typeof partnerDoc === 'object'
    ? (partnerDoc._id?.toString() || partnerDoc.id)
    : (partnerDoc ? partnerDoc.toString() : undefined);

  const client = {
    id: value.id || value._id?.toString(),
    ...value,
    _id: undefined,
    __v: undefined,
    title: value.title || value.name,
    name: value.title || value.name,
    programType: value.programType || value.type,
    type: value.programType || value.type,
    status: value.status,
    participantCount,
    participants: participantCount,
    participantTarget,
    target: participantTarget,
    partnerId: partnerIdStr,
    partnerName,
    deliveredAt: value.deliveredAt ? new Date(value.deliveredAt).toISOString() : undefined,
  };

  if (warning) {
    client.warning = warning;
  }

  return client;
};

export const prepareProgram = (data = {}, actorId, existing = {}) => {
  const title = (data.title || data.name || existing.title || '').trim();
  const programType = data.programType || data.type || existing.programType || 'training';
  const status = data.status || existing.status || 'planned';
  const format = data.format ?? existing.format ?? 'in-person';
  const country = data.country ?? existing.country;
  const location = data.location ?? existing.location;
  const partnerId = data.partnerId !== undefined ? (data.partnerId || null) : existing.partnerId;
  const participantCount = Number.isFinite(Number(data.participantCount ?? data.participants))
    ? Math.max(0, Math.round(Number(data.participantCount ?? data.participants)))
    : (existing.participantCount ?? 0);
  const participantTarget = Number.isFinite(Number(data.participantTarget ?? data.target))
    ? Math.max(0, Math.round(Number(data.participantTarget ?? data.target)))
    : (existing.participantTarget ?? 0);
  const facilitators = Array.isArray(data.facilitators) ? data.facilitators : (existing.facilitators || []);
  const notes = data.notes ?? existing.notes;
  const startAt = data.startAt ? new Date(data.startAt) : existing.startAt;
  const endAt = data.endAt ? new Date(data.endAt) : existing.endAt;

  let deliveredAt = existing.deliveredAt;
  if (status === 'delivered') {
    if (data.deliveredAt) {
      deliveredAt = new Date(data.deliveredAt);
    } else if (!deliveredAt) {
      deliveredAt = endAt || new Date();
    }
  } else {
    deliveredAt = undefined;
  }

  return {
    title,
    programType,
    status,
    format,
    country,
    location,
    partnerId,
    participantCount,
    participantTarget,
    facilitators,
    notes,
    startAt,
    endAt,
    deliveredAt,
  };
};

adminApiRouter.get('/programs/upcoming', requireAdminOrStaffAuth, requireScreen('programs', 'view'), asyncHandler(async (req, res) => {
  const records = await Program.find({ status: { $in: ['planned', 'running'] } })
    .populate('partnerId', 'organizationName name')
    .sort({ startAt: 1, createdAt: -1 })
    .limit(5);

  listResponse(res, records.map(toProgramClientObject));
}));

addManagedRoutes({
  path: '/programs',
  Model: Program,
  resource: 'programs',
  roles: PROGRAM_ROLES,
  screen: 'programs',
  prepare: prepareProgram,
  transform: toProgramClientObject,
  populate: { path: 'partnerId', select: 'organizationName name' },
  validateCreate: validate(programSchema),
  validateUpdate: validate(programUpdateSchema),
  filters: ['status', 'country', 'programType'],
});
export const calculatePipelineHealth = async (monthQuery) => {
  const month = typeof monthQuery === 'string' && /^\d{4}-\d{2}$/.test(monthQuery)
    ? monthQuery
    : new Date().toISOString().slice(0, 7);

  const nowIso = new Date().toISOString().slice(0, 7);
  let todayDate;
  if (month === nowIso) {
    todayDate = new Date();
  } else {
    const [yearStr, monthStr] = month.split('-');
    todayDate = new Date(Date.UTC(Number(yearStr), Number(monthStr), 0, 23, 59, 59));
  }

  const windowStartDate = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() - 6, todayDate.getUTCDate()));
  const windowStart = windowStartDate.toISOString().slice(0, 10);
  const windowEnd = todayDate.toISOString().slice(0, 10);

  const nextMonthDate = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() + 1, 1));
  const nextMonth = nextMonthDate.toISOString().slice(0, 7);

  const nextMonthTargets = await getTargetsForMonth(nextMonth);
  const targetItem = nextMonthTargets.find((t) => t.kpi === 'partners_onboarded' || t.metric === 'partners_onboarded')
    || nextMonthTargets.find((t) => t.kpi === 'partnersClosed' || t.metric === 'partnersClosed');
  const target = targetItem?.value ?? targetItem?.target ?? 2;

  const allPartners = await Partner.find().lean();
  const openStages = ['prospect', 'outreach', 'proposal', 'mou', 'MOU'];
  const closedStages = ['onboard', 'renew', 'Onboard', 'Renew'];

  const openDeals = allPartners.filter((p) => openStages.includes(p.stage)).length;

  const reachedOutreach = new Set();
  const closedInWindow = new Set();

  for (const p of allPartners) {
    const partnerId = p._id.toString();
    const history = p.stageHistory || [];
    for (const move of history) {
      const moveAt = String(move.at || '').slice(0, 10);
      if (!moveAt || moveAt < windowStart || moveAt > windowEnd) continue;

      if (String(move.stage).toLowerCase() === 'outreach') {
        reachedOutreach.add(partnerId);
      }

      const isToClosed = closedStages.includes(move.stage);
      const isFromClosed = move.from && closedStages.includes(move.from);
      if (isToClosed && !isFromClosed) {
        closedInWindow.add(partnerId);
      }
    }
  }

  const reachedCount = reachedOutreach.size;
  const closedCount = closedInWindow.size;
  const closeRate = reachedCount > 0 ? (closedCount / reachedCount) : null;

  let needed = null;
  let ratio = null;
  let status = 'unknown';

  if (target <= 0) {
    needed = 0;
    ratio = null;
    status = 'healthy';
  } else if (closeRate === null) {
    needed = null;
    ratio = null;
    status = 'unknown';
  } else if (closeRate === 0) {
    needed = null;
    ratio = null;
    status = 'critical';
  } else {
    needed = Math.ceil((target * reachedCount) / closedCount);
    ratio = openDeals / needed;
    if (ratio >= 1.0) status = 'healthy';
    else if (ratio >= 0.6) status = 'thin';
    else status = 'critical';
  }

  return {
    openDeals,
    needed,
    ratio,
    status,
    closeRate,
    closedInWindow: closedCount,
    reachedOutreachInWindow: reachedCount,
    target,
    month,
    historicalCloseRate: closeRate ?? 0,
    requiredOpenDeals: needed ?? 0,
  };
};

adminApiRouter.get('/partners/pipeline-health', requireAdminOrStaffAuth, requireScreen('partners', 'view'), asyncHandler(async (req, res) => {
  const health = await calculatePipelineHealth(req.query.month);
  itemResponse(res, health);
}));

adminApiRouter.post('/partners/:id/move', requireAdminOrStaffAuth, requireScreen('partners', 'edit'), validate(partnerMoveSchema), asyncHandler(async (req, res) => {
  const partner = await Partner.findById(validId(req.params.id, 'Partner'));
  if (!partner) throw notFound('Partner');

  let to = req.body.to;
  if (String(to).toLowerCase() === 'mou') to = 'mou';
  const from = partner.stage;

  if (String(from).toLowerCase() === String(to).toLowerCase()) {
    await partner.populate('assignedOwnerId', 'name email');
    return itemResponse(res, { partner: toPartnerClientObject(partner), from, to, closedChange: null });
  }

  const wasClosed = ['onboard', 'renew'].includes(String(from).toLowerCase());
  const nowClosed = ['onboard', 'renew'].includes(String(to).toLowerCase());
  const closedChange = wasClosed === nowClosed ? null : (nowClosed ? 'closed' : 'reopened');

  const callerUser = await User.findById(req.auth.sub).select('name email').lean();
  const callerName = callerUser?.name || req.auth.email || 'Staff';

  const entry = {
    stage: to,
    from,
    at: new Date().toISOString().slice(0, 10),
    by: req.auth.sub,
    byName: callerName,
  };

  partner.stage = to;
  partner.stageHistory.push(entry);
  await partner.save();
  await partner.populate('assignedOwnerId', 'name email');

  await logActivity(req.auth.sub, `moved to ${to}`, 'partners', partner);
  await auditReq(req, {
    action: AUDIT_ACTIONS.PARTNER_MOVE,
    resourceType: AUDIT_RESOURCE_TYPES.PARTNER,
    resourceId: partner._id,
    outcome: 'success',
    metadata: { from, to, closedChange },
  });

  itemResponse(res, {
    partner: toPartnerClientObject(partner),
    from,
    to,
    closedChange,
  });
}));

addManagedRoutes({
  path: '/partners',
  Model: Partner,
  resource: 'partners',
  roles: PARTNER_ROLES,
  screen: 'partners',
  prepare: preparePartner,
  transform: toPartnerClientObject,
  populate: { path: 'assignedOwnerId', select: 'name email' },
  validateCreate: validate(partnerCreateSchema),
  validateUpdate: validate(partnerUpdateSchema),
  filters: ['stage', 'country', 'partnerType', 'closed'],
});
export const toAmbassadorClientObject = (doc) => {
  if (!doc) return doc;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const id = raw._id ? raw._id.toString() : (raw.id ? String(raw.id) : '');
  const fullName = raw.fullName || raw.name || '';
  const profilePhoto = raw.profilePhoto || raw.photoUrl || undefined;
  const linkedUserId = raw.linkedUserId ? raw.linkedUserId.toString() : (raw.linkedSeekerId || undefined);
  const assignedLeadId = raw.assignedLeadId?._id
    ? raw.assignedLeadId._id.toString()
    : (raw.assignedLeadId ? raw.assignedLeadId.toString() : undefined);
  const leadName = raw.assignedLeadId?.name
    || (raw.assignedLeadId?.fullName
      || (raw.assignedLeadId?.firstName ? `${raw.assignedLeadId.firstName} ${raw.assignedLeadId.lastName || ''}`.trim() : undefined));

  let tier = String(raw.tier || 'ambassador').toLowerCase();
  if (tier.includes('senior')) tier = 'senior';
  else if (tier.includes('lead')) tier = 'lead';
  else if (!['ambassador', 'senior', 'lead'].includes(tier)) tier = 'ambassador';

  const joinedAt = raw.joinedAt || (raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const dormantSince = raw.dormantSince || undefined;

  return {
    ...raw,
    id,
    _id: id,
    name: fullName,
    fullName,
    email: raw.email || '',
    phone: raw.phone || undefined,
    country: raw.country || '',
    city: raw.city || '',
    campus: raw.campus || '',
    memberType: raw.memberType || 'student',
    description: raw.description || undefined,
    roleTitle: raw.roleTitle || undefined,
    profilePhoto,
    photoUrl: profilePhoto,
    tier,
    status: raw.status || 'applicant',
    assignedLeadId,
    leadName,
    trained: Boolean(raw.trained),
    linkedUserId,
    linkedSeekerId: linkedUserId,
    referralCode: raw.referralCode || '',
    joinedAt,
    dormantSince,
  };
};

export const toAmplificationClientObject = (doc) => {
  if (!doc) return doc;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const id = raw._id ? raw._id.toString() : (raw.id ? String(raw.id) : '');
  const at = raw.at || (raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  return {
    ...raw,
    id,
    _id: id,
    ambassadorId: raw.ambassadorId ? raw.ambassadorId.toString() : '',
    channel: raw.channel || '',
    at,
    clicks: Number(raw.clicks) || 0,
    applications: Number(raw.applications) || 0,
    listingId: raw.listingId ? raw.listingId.toString() : undefined,
    note: raw.note || undefined,
  };
};

const prepareAmbassador = (body, authSub, existing = {}) => {
  const isUpdate = Boolean(existing && existing._id);
  const fullName = String(body.fullName ?? body.name ?? existing.fullName ?? '').trim();
  const email = String(body.email ?? existing.email ?? '').trim().toLowerCase();
  const phone = body.phone !== undefined ? String(body.phone || '').trim() : existing.phone;
  const country = body.country !== undefined ? String(body.country || '').trim() : existing.country;
  const city = body.city !== undefined ? String(body.city || '').trim() : existing.city;
  const campus = body.campus !== undefined ? String(body.campus || '').trim() : existing.campus;
  const memberType = body.memberType ?? existing.memberType ?? 'student';
  const description = body.description !== undefined ? String(body.description || '').trim() : existing.description;
  const roleTitle = body.roleTitle !== undefined ? String(body.roleTitle || '').trim() : existing.roleTitle;
  const profilePhoto = body.profilePhoto ?? body.photoUrl ?? existing.profilePhoto;

  let tier = String(body.tier ?? existing.tier ?? 'ambassador').toLowerCase();
  if (tier.includes('senior')) tier = 'senior';
  else if (tier.includes('lead')) tier = 'lead';
  else if (!['ambassador', 'senior', 'lead'].includes(tier)) tier = 'ambassador';

  const status = body.status ?? existing.status ?? 'applicant';
  const assignedLeadId = body.assignedLeadId !== undefined
    ? (body.assignedLeadId ? validId(body.assignedLeadId, 'User') : null)
    : existing.assignedLeadId;
  const linkedUserId = (body.linkedUserId ?? body.linkedSeekerId) !== undefined
    ? ((body.linkedUserId ?? body.linkedSeekerId) ? validId(body.linkedUserId ?? body.linkedSeekerId, 'User') : null)
    : existing.linkedUserId;
  const trained = body.trained !== undefined ? Boolean(body.trained) : Boolean(existing.trained);

  let joinedAt = existing.joinedAt;
  if (!isUpdate) {
    joinedAt = body.joinedAt || new Date().toISOString().slice(0, 10);
  }

  let dormantSince = existing.dormantSince;
  if (status === 'dormant') {
    dormantSince = body.dormantSince || existing.dormantSince || new Date().toISOString().slice(0, 10);
  } else {
    dormantSince = undefined;
  }

  const result = {
    fullName,
    email,
    phone,
    country,
    city,
    campus,
    memberType,
    description,
    roleTitle,
    profilePhoto,
    tier,
    status,
    assignedLeadId,
    linkedUserId,
    trained,
    joinedAt,
    dormantSince,
  };

  if (!isUpdate && body.referralCode) {
    result.referralCode = String(body.referralCode).trim().toUpperCase();
  }

  return result;
};

export const calculateNetworkSummary = async (monthQuery) => {
  const current = new Date().toISOString().slice(0, 7);
  const month = typeof monthQuery === 'string' && /^\d{4}-\d{2}$/.test(monthQuery) ? monthQuery : current;
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const endOfMonth = `${month}-${String(lastDay).padStart(2, '0')}`;

  const allAmbassadors = await Ambassador.find({});

  const networkAmbassadors = allAmbassadors.filter((a) => {
    const joined = a.joinedAt || (a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '9999-99-99');
    return joined <= endOfMonth;
  });

  const activeAmbassadors = networkAmbassadors.filter((a) => {
    if (a.status === 'applicant') return false;
    const joined = a.joinedAt || (a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '9999-99-99');
    if (joined > endOfMonth) return false;
    if (a.status === 'dormant') {
      return Boolean(a.dormantSince && a.dormantSince > endOfMonth);
    }
    if (a.status === 'active') {
      return !a.dormantSince || a.dormantSince > endOfMonth;
    }
    return false;
  });

  const activeIds = new Set(activeAmbassadors.map((a) => a._id.toString()));

  const logs = await AmbassadorAmplification.find({
    $or: [
      { at: { $regex: `^${month}` } },
      { createdAt: { $gte: new Date(`${month}-01T00:00:00.000Z`), $lte: new Date(`${endOfMonth}T23:59:59.999Z`) } },
    ],
  });

  const sharedAmbassadorIds = new Set();
  for (const log of logs) {
    const logDate = log.at || (log.createdAt ? new Date(log.createdAt).toISOString().slice(0, 10) : '');
    if (logDate.slice(0, 7) === month) {
      sharedAmbassadorIds.add(log.ambassadorId.toString());
    }
  }

  let sharedActive = 0;
  for (const activeId of activeIds) {
    if (sharedAmbassadorIds.has(activeId)) {
      sharedActive++;
    }
  }

  const activeCount = activeAmbassadors.length;
  const activityRate = activeCount > 0 ? sharedActive / activeCount : null;

  return {
    size: networkAmbassadors.length,
    active: activeCount,
    sharedActive,
    activityRate,
    month,
  };
};

export const calculateLeaderboard = async (monthQuery) => {
  const current = new Date().toISOString().slice(0, 7);
  const month = typeof monthQuery === 'string' && /^\d{4}-\d{2}$/.test(monthQuery) ? monthQuery : current;
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const endOfMonth = `${month}-${String(lastDay).padStart(2, '0')}`;

  const allAmbassadors = await Ambassador.find({
    status: { $ne: 'applicant' },
  }).populate('assignedLeadId', 'name fullName firstName lastName email');

  const eligible = allAmbassadors.filter((a) => {
    const joined = a.joinedAt || (a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '9999-99-99');
    return joined.slice(0, 7) <= month;
  });

  const eligibleIds = eligible.map((a) => a._id);

  const logs = await AmbassadorAmplification.find({
    ambassadorId: { $in: eligibleIds },
    $or: [
      { at: { $regex: `^${month}` } },
      { createdAt: { $gte: new Date(`${month}-01T00:00:00.000Z`), $lte: new Date(`${endOfMonth}T23:59:59.999Z`) } },
    ],
  });

  const sharesMap = new Map();
  const clicksMap = new Map();

  for (const log of logs) {
    const logDate = log.at || (log.createdAt ? new Date(log.createdAt).toISOString().slice(0, 10) : '');
    if (logDate.slice(0, 7) === month) {
      const aid = log.ambassadorId.toString();
      sharesMap.set(aid, (sharesMap.get(aid) || 0) + 1);
      clicksMap.set(aid, (clicksMap.get(aid) || 0) + (log.clicks || 0));
    }
  }

  const engagements = await OpportunityEngagement.find({
    ambassadorId: { $in: eligibleIds },
    event: 'view',
    createdAt: { $gte: new Date(`${month}-01T00:00:00.000Z`), $lte: new Date(`${endOfMonth}T23:59:59.999Z`) },
  });
  const engagementClickMap = new Map();
  for (const eng of engagements) {
    const aid = eng.ambassadorId.toString();
    engagementClickMap.set(aid, (engagementClickMap.get(aid) || 0) + 1);
  }

  const beneficiaries = await Beneficiary.find({
    ambassadorId: { $in: eligibleIds },
    verified: true,
  });

  const signupsMap = new Map();
  for (const b of beneficiaries) {
    const vDate = b.verifiedAt || (b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : '');
    if (vDate.slice(0, 7) === month) {
      const aid = b.ambassadorId.toString();
      signupsMap.set(aid, (signupsMap.get(aid) || 0) + 1);
    }
  }

  const entries = eligible.map((amb) => {
    const aid = amb._id.toString();
    const clientAmb = toAmbassadorClientObject(amb);
    const shares = sharesMap.get(aid) || 0;
    const logClicks = clicksMap.get(aid) || 0;
    const engClicks = engagementClickMap.get(aid) || 0;
    const clicks = logClicks + engClicks;
    const signups = signupsMap.get(aid) || 0;

    return {
      ambassador: clientAmb,
      shares,
      clicks,
      signups,
      sharesLogged: shares,
      distinctReferredClicks: clicks,
      verifiedSignups: signups,
      name: clientAmb.name,
      country: clientAmb.country,
      campus: clientAmb.campus,
      tier: clientAmb.tier,
    };
  });

  entries.sort((a, b) => (
    b.signups - a.signups ||
    b.clicks - a.clicks ||
    b.shares - a.shares ||
    a.ambassador.name.localeCompare(b.ambassador.name)
  ));

  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
};

adminApiRouter.get('/network/summary', requireAdminOrStaffAuth, requireScreen('network', 'view'), asyncHandler(async (req, res) => {
  const summary = await calculateNetworkSummary(req.query.month);
  itemResponse(res, summary);
}));

adminApiRouter.get('/leaderboard', requireAdminOrStaffAuth, (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  const screens = req.user?.screens || {};
  if (screens.leaderboard === 'view' || screens.leaderboard === 'edit' || screens.network === 'view' || screens.network === 'edit') {
    return next();
  }
  return requireScreen('leaderboard', 'view')(req, res, next);
}, asyncHandler(async (req, res) => {
  const leaderboard = await calculateLeaderboard(req.query.month);
  listResponse(res, leaderboard);
}));

adminApiRouter.get('/ambassadors/:id/detail', requireAdminOrStaffAuth, requireScreen('network', 'view'), asyncHandler(async (req, res) => {
  const ambassador = await Ambassador.findById(validId(req.params.id, 'Ambassador')).populate('assignedLeadId', 'name fullName firstName lastName email');
  if (!ambassador) throw notFound('Ambassador');
  const clientAmb = toAmbassadorClientObject(ambassador);
  const logs = await AmbassadorAmplification.find({ ambassadorId: ambassador._id }).sort({ at: -1, createdAt: -1 });

  const current = new Date().toISOString().slice(0, 7);
  const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : current;

  const thisMonthLogs = logs.filter((log) => {
    const logDate = log.at || (log.createdAt ? new Date(log.createdAt).toISOString().slice(0, 10) : '');
    return logDate.slice(0, 7) === month;
  });

  const verifiedBeneficiaries = await Beneficiary.countDocuments({
    ambassadorId: ambassador._id,
    verified: true,
    $or: [
      { verifiedAt: { $regex: `^${month}` } },
      { createdAt: { $gte: new Date(`${month}-01T00:00:00.000Z`), $lte: new Date(`${month}-31T23:59:59.999Z`) } },
    ],
  });

  const stats = {
    shares: thisMonthLogs.length,
    clicks: thisMonthLogs.reduce((sum, l) => sum + (l.clicks || 0), 0),
    signups: verifiedBeneficiaries,
  };

  itemResponse(res, {
    ambassador: clientAmb,
    leadName: clientAmb.leadName,
    logs: logs.map(toAmplificationClientObject),
    stats,
  });
}));

adminApiRouter.get('/ambassadors/:id/amplifications', requireAdminOrStaffAuth, requireScreen('network', 'view'), asyncHandler(async (req, res) => {
  const ambassador = await Ambassador.findById(validId(req.params.id, 'Ambassador'));
  if (!ambassador) throw notFound('Ambassador');
  const logs = await AmbassadorAmplification.find({ ambassadorId: ambassador._id }).sort({ at: -1, createdAt: -1 });
  listResponse(res, logs.map(toAmplificationClientObject));
}));

adminApiRouter.post('/ambassadors/:id/amplifications', requireAdminOrStaffAuth, requireScreen('network', 'edit'), validate(amplificationCreateSchema), asyncHandler(async (req, res) => {
  const ambassador = await Ambassador.findById(validId(req.params.id, 'Ambassador'));
  if (!ambassador) throw notFound('Ambassador');
  const channel = String(req.body.channel || '').trim();
  const at = req.body.at || new Date().toISOString().slice(0, 10);
  const clicks = typeof req.body.clicks === 'number' ? req.body.clicks : 0;
  const applications = typeof req.body.applications === 'number' ? req.body.applications : 0;
  const listingId = req.body.listingId ? validId(req.body.listingId, 'Opportunity') : undefined;

  const amplification = await AmbassadorAmplification.create({
    ambassadorId: ambassador._id,
    channel,
    at,
    clicks,
    applications,
    listingId,
    note: req.body.note,
    loggedBy: req.auth.sub,
  });

  await logActivity(req.auth.sub, 'logged amplification', 'ambassadors', ambassador);
  await auditReq(req, {
    action: AUDIT_ACTIONS.AMBASSADOR_AMPLIFICATION,
    resourceType: AUDIT_RESOURCE_TYPES.AMBASSADOR,
    resourceId: ambassador._id,
    outcome: 'success',
    metadata: { channel, clicks, at },
  });

  res.status(201).json({ data: toAmplificationClientObject(amplification) });
}));

addManagedRoutes({
  path: '/ambassadors',
  Model: Ambassador,
  resource: 'ambassadors',
  roles: AMBASSADOR_ROLES,
  screen: 'network',
  prepare: prepareAmbassador,
  transform: toAmbassadorClientObject,
  populate: { path: 'assignedLeadId', select: 'name fullName firstName lastName email' },
  validateCreate: validate(ambassadorCreateSchema),
  validateUpdate: validate(ambassadorUpdateSchema),
  filters: ['status', 'tier', 'country'],
});

export const toSocialPostClientObject = (doc) => {
  if (!doc) return doc;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const id = raw._id ? raw._id.toString() : (raw.id ? String(raw.id) : '');
  const platform = raw.platform || 'other';

  const oppDoc = raw.opportunityId || raw.listingId;
  const listingId = oppDoc && typeof oppDoc === 'object'
    ? (oppDoc._id?.toString() || oppDoc.id)
    : (oppDoc ? oppDoc.toString() : undefined);
  const listingTitle = oppDoc && typeof oppDoc === 'object'
    ? (oppDoc.title || oppDoc.name || undefined)
    : undefined;

  let postedAtDate = raw.postedAtDate;
  let postedAtIso;
  if (raw.postedAt) {
    const d = new Date(raw.postedAt);
    if (!Number.isNaN(d.getTime())) {
      postedAtIso = d.toISOString();
      if (!postedAtDate) {
        postedAtDate = postedAtIso.slice(0, 10);
      }
    }
  }

  return {
    id,
    platform,
    title: raw.title || '',
    text: raw.text || raw.title || '',
    url: raw.url || '',
    reach: typeof raw.reach === 'number' ? Math.max(0, Math.round(raw.reach)) : 0,
    engagement: typeof raw.engagement === 'number' ? Math.max(0, Math.round(raw.engagement)) : 0,
    status: raw.status || 'published',
    postedAt: postedAtDate || (postedAtIso ? postedAtIso.slice(0, 10) : ''),
    postedAtIso,
    listingId,
    listingTitle,
    authorId: raw.authorId ? raw.authorId.toString() : (raw.createdBy ? raw.createdBy.toString() : undefined),
    createdBy: raw.createdBy ? raw.createdBy.toString() : (raw.authorId ? raw.authorId.toString() : undefined),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

export const calculateSocialMonthlyTotals = async (monthQuery) => {
  const { month, start, end } = monthBounds(monthQuery);
  const startIsoDate = start.toISOString().slice(0, 10);
  const endIsoDate = end.toISOString().slice(0, 10);

  const posts = await SocialPost.find({
    status: 'published',
    $or: [
      { postedAt: { $gte: start, $lt: end } },
      { postedAtDate: { $gte: startIsoDate, $lt: endIsoDate } },
    ],
  }).populate('opportunityId', 'title name').sort({ postedAt: -1, _id: -1 });

  const targetsList = await getTargetsForMonth(month);
  const targetMap = new Map(targetsList.map((t) => [t.kpi, t.target]));
  const targets = {
    posts: targetMap.get('posts_published') ?? 8,
    reach: targetMap.get('social_reach') ?? 10500,
    engagement: targetMap.get('social_engagement') ?? 800,
  };

  const platformStats = CANONICAL_SOCIAL_PLATFORMS.map((platform) => {
    const mine = posts.filter((p) => (p.platform || '').toLowerCase() === platform);
    const pReach = mine.reduce((sum, p) => sum + (Number(p.reach) || 0), 0);
    const pEngagement = mine.reduce((sum, p) => sum + (Number(p.engagement) || 0), 0);
    return {
      platform,
      label: SOCIAL_PLATFORM_LABELS[platform] || platform,
      posts: mine.length,
      reach: pReach,
      engagement: pEngagement,
    };
  }).filter((row) => row.posts > 0);

  platformStats.sort((a, b) => b.reach - a.reach || b.posts - a.posts || a.label.localeCompare(b.label));

  const totalPosts = platformStats.reduce((sum, r) => sum + r.posts, 0);
  const totalReach = platformStats.reduce((sum, r) => sum + r.reach, 0);
  const totalEngagement = platformStats.reduce((sum, r) => sum + r.engagement, 0);
  const leading = platformStats[0]?.platform ?? null;

  return {
    month,
    posts: totalPosts,
    reach: totalReach,
    engagement: totalEngagement,
    targets,
    platforms: platformStats,
    leading,
    team: {
      posts: totalPosts,
      reach: totalReach,
      engagement: totalEngagement,
    },
  };
};

adminApiRouter.get('/social-posts/monthly-totals', requireAdminOrStaffAuth, requireScreen('social', 'view'), requirePortalRoles(...SOCIAL_ROLES), asyncHandler(async (req, res) => {
  const result = await calculateSocialMonthlyTotals(req.query.month);
  itemResponse(res, result);
}));

adminApiRouter.get('/social-posts', requireAdminOrStaffAuth, requireScreen('social', 'view'), requirePortalRoles(...SOCIAL_ROLES), asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.month) {
    const { start, end } = monthBounds(req.query.month);
    const startIsoDate = start.toISOString().slice(0, 10);
    const endIsoDate = end.toISOString().slice(0, 10);
    filter.$or = [
      { postedAt: { $gte: start, $lt: end } },
      { postedAtDate: { $gte: startIsoDate, $lt: endIsoDate } },
    ];
  }
  if (req.query.platform) {
    filter.platform = normalizeSocialPlatform(req.query.platform);
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.search || req.query.q) {
    const term = req.query.search || req.query.q;
    filter.title = new RegExp(escapedRegex(term), 'i');
  }

  const { page, skip, limit } = pageOptions(req.query);
  const total = await SocialPost.countDocuments(filter);
  const query = SocialPost.find(filter)
    .populate('opportunityId', 'title name')
    .sort({ postedAt: -1, _id: -1 });

  if (limit) {
    query.skip(skip).limit(limit);
  }

  const posts = await query;
  listResponse(res, posts.map(toSocialPostClientObject), total, page, limit);
}));

adminApiRouter.get('/social-posts/:id', requireAdminOrStaffAuth, requireScreen('social', 'view'), requirePortalRoles(...SOCIAL_ROLES), asyncHandler(async (req, res) => {
  const post = await SocialPost.findById(validId(req.params.id, 'SocialPost')).populate('opportunityId', 'title name');
  if (!post) throw notFound('SocialPost');
  itemResponse(res, toSocialPostClientObject(post));
}));

adminApiRouter.post('/social-posts', requireAdminOrStaffAuth, requireScreen('social', 'edit'), requirePortalRoles(...SOCIAL_ROLES), validate(socialPostCreateSchema), asyncHandler(async (req, res) => {
  const body = req.body;
  const platform = normalizeSocialPlatform(body.platform);
  const reach = Math.max(0, Math.round(Number(body.reach) || 0));
  const engagement = Math.max(0, Math.round(Number(body.engagement) || 0));
  const postedAtDate = new Date(body.postedAt);
  const listingId = body.listingId || body.opportunityId || undefined;

  const post = new SocialPost({
    platform,
    title: String(body.title).trim(),
    text: body.text ? String(body.text).trim() : String(body.title).trim(),
    url: String(body.url).trim(),
    reach,
    engagement,
    status: body.status || 'published',
    postedAt: postedAtDate,
    postedAtDate: postedAtDate.toISOString().slice(0, 10),
    listingId: listingId || undefined,
    opportunityId: listingId || undefined,
    createdBy: req.auth?.sub,
    authorId: req.auth?.sub,
  });

  await post.save();
  await post.populate('opportunityId', 'title name');

  await auditReq(req, {
    action: AUDIT_ACTIONS.SOCIAL_POST_CREATE,
    resourceType: AUDIT_RESOURCE_TYPES.SOCIAL_POST,
    resourceId: post._id,
    outcome: 'success',
    metadata: {
      platform: post.platform,
      title: post.title,
      postedAt: post.postedAtDate,
      reach: post.reach,
      engagement: post.engagement,
      status: post.status,
    },
  });

  const sync = await syncManagedRecord('social-posts', post);
  const clientObj = toSocialPostClientObject(post);
  res.status(201).json({ data: { ...clientObj, sync } });
}));

adminApiRouter.patch('/social-posts/:id', requireAdminOrStaffAuth, requireScreen('social', 'edit'), requirePortalRoles(...SOCIAL_ROLES), validate(socialPostUpdateSchema), asyncHandler(async (req, res) => {
  const post = await SocialPost.findById(validId(req.params.id, 'SocialPost'));
  if (!post) throw notFound('SocialPost');

  const before = {
    platform: post.platform,
    title: post.title,
    reach: post.reach,
    engagement: post.engagement,
    status: post.status,
    postedAt: post.postedAtDate,
  };

  const body = req.body;
  if (body.platform) post.platform = normalizeSocialPlatform(body.platform);
  if (body.title !== undefined) post.title = String(body.title).trim();
  if (body.text !== undefined) post.text = String(body.text).trim();
  if (body.url !== undefined) post.url = String(body.url).trim();
  if (body.reach !== undefined) post.reach = Math.max(0, Math.round(Number(body.reach) || 0));
  if (body.engagement !== undefined) post.engagement = Math.max(0, Math.round(Number(body.engagement) || 0));
  if (body.status !== undefined) post.status = body.status;
  if (body.postedAt !== undefined) {
    const d = new Date(body.postedAt);
    post.postedAt = d;
    post.postedAtDate = d.toISOString().slice(0, 10);
  }
  if (body.listingId !== undefined || body.opportunityId !== undefined) {
    const newListing = body.listingId || body.opportunityId || null;
    post.listingId = newListing;
    post.opportunityId = newListing;
  }

  await post.save();
  await post.populate('opportunityId', 'title name');

  await auditReq(req, {
    action: AUDIT_ACTIONS.SOCIAL_POST_UPDATE,
    resourceType: AUDIT_RESOURCE_TYPES.SOCIAL_POST,
    resourceId: post._id,
    outcome: 'success',
    metadata: {
      before,
      after: {
        platform: post.platform,
        title: post.title,
        reach: post.reach,
        engagement: post.engagement,
        status: post.status,
        postedAt: post.postedAtDate,
      },
    },
  });

  const sync = await syncManagedRecord('social-posts', post);
  itemResponse(res, { ...toSocialPostClientObject(post), sync });
}));

adminApiRouter.delete('/social-posts/:id', requireAdminOrStaffAuth, requireScreen('social', 'edit'), requirePortalRoles(...SOCIAL_ROLES), asyncHandler(async (req, res) => {
  const post = await SocialPost.findById(validId(req.params.id, 'SocialPost'));
  if (!post) throw notFound('SocialPost');

  await post.deleteOne();
  await deleteFromWordpress('social-posts', post._id);

  await auditReq(req, {
    action: AUDIT_ACTIONS.SOCIAL_POST_DELETE,
    resourceType: AUDIT_RESOURCE_TYPES.SOCIAL_POST,
    resourceId: post._id,
    outcome: 'success',
    metadata: {
      platform: post.platform,
      title: post.title,
    },
  });

  itemResponse(res, { id: req.params.id, deleted: true });
}));

adminApiRouter.post('/social-posts/:id/retry-wordpress-sync', requireAdminOrStaffAuth, requireScreen('social', 'edit'), requirePortalRoles(...SOCIAL_ROLES), asyncHandler(async (req, res) => {
  const post = await SocialPost.findById(validId(req.params.id, 'SocialPost')).populate('opportunityId', 'title name');
  if (!post) throw notFound('SocialPost');
  itemResponse(res, { ...toSocialPostClientObject(post), sync: await syncManagedRecord('social-posts', post) });
}));

// --- Ambassador applications -------------------------------------------------
// Reviewed by an admin. Approving links the user to the ambassador registry and, optionally, a channel.

adminApiRouter.get('/ambassador-requests', requireAdminAuth, asyncHandler(async (req, res) => {
  const filter = {};
  if (['pending', 'approved', 'rejected'].includes(req.query.status)) filter.status = req.query.status;
  if (['seeker', 'hirer'].includes(req.query.role)) filter.role = req.query.role;
  if (req.query.q) {
    const pattern = new RegExp(escapedRegex(String(req.query.q).slice(0, 80)), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { organisation: pattern }, { profession: pattern }];
  }
  const { page, skip, limit } = pageOptions(req.query);
  const [rows, total] = await Promise.all([
    AmbassadorRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AmbassadorRequest.countDocuments(filter),
  ]);
  listResponse(res, rows.map(toRequestResponse), total, page, limit);
}));

adminApiRouter.get('/ambassador-requests/:id', requireAdminAuth, asyncHandler(async (req, res) => {
  const request = await AmbassadorRequest.findById(validId(req.params.id, 'Ambassador request')).lean();
  if (!request) throw notFound('Ambassador request');
  const [user, seeker, hirer] = await Promise.all([
    User.findById(request.userId).select('name email role emailVerified createdAt avatarUrl').lean(),
    SeekerProfile.findOne({ userId: request.userId }).lean(),
    request.role === 'hirer' ? HirerAccount.findOne({ userId: request.userId }).lean() : null,
  ]);
  const list = (value) => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  };
  // The same details the person sees on their own profile, so the reviewer knows who they are approving.
  const profile = request.role === 'hirer'
    ? hirer && {
      kind: 'hirer',
      companyName: hirer.companyName, tagline: hirer.tagline, industry: hirer.industry, companySize: hirer.companySize,
      location: hirer.location, website: hirer.website, companyEmail: hirer.companyEmail, description: hirer.description,
      recruiterName: hirer.recruiterName, recruiterRole: hirer.recruiterRole, recruiterEmail: hirer.recruiterEmail,
      recruiterPhone: hirer.recruiterPhone, recruiterLinkedin: hirer.recruiterLinkedin,
      verified: Boolean(hirer.verified), verification: hirer.verification, postingsCount: hirer.postingsCount || 0,
    }
    : seeker && {
      kind: 'seeker',
      profession: seeker.profession, university: seeker.university, country: seeker.country, city: seeker.city, phone: seeker.phone,
      bio: seeker.bio, professionalSummary: seeker.professionalSummary, experienceLevel: seeker.experienceLevel,
      technicalSkills: list(seeker.technicalSkills), softSkills: list(seeker.softSkills), tools: list(seeker.tools), certifications: list(seeker.certifications),
      rating: seeker.rating || 0, verified: Boolean(seeker.verified), applicationsCount: seeker.applicationsCount || 0,
    };
  itemResponse(res, {
    ...toRequestResponse(request),
    user: user && { id: String(user._id), name: user.name, email: user.email, role: user.role, emailVerified: Boolean(user.emailVerified), joinedAt: user.createdAt, avatarUrl: user.avatarUrl },
    verified: Boolean(seeker?.verified || hirer?.verified),
    profile: profile || null,
  });
}));

adminApiRouter.post('/ambassador-requests/:id/approve', requireAdminAuth, validate(approveAmbassadorRequestSchema), asyncHandler(async (req, res) => {
  const request = await AmbassadorRequest.findById(req.params.id);
  if (!request) throw notFound('Ambassador request');
  if (request.status !== 'pending') throw new ApiError(409, 'This request has already been decided');
  const user = await User.findById(request.userId);
  if (!user || user.role === 'deleted') throw new ApiError(409, 'This user no longer has an active account');

  let channel = null;
  if (req.body.channelId) {
    channel = await Channel.findById(req.body.channelId);
    if (!channel) throw notFound('Channel');
  }

  // Saved through the model (not an upsert) so its save hook issues the GOD-XXXXXX referral code and the joinedAt date,
  // exactly as for an ambassador added from the Network page.
  const ambassador = (await Ambassador.findOne({ linkedUserId: user._id })) || new Ambassador({ linkedUserId: user._id, createdBy: req.auth.sub });
  ambassador.set({
    fullName: user.name,
    email: user.email,
    phone: request.phone,
    country: request.country,
    city: request.city,
    // The Network registry only knows student, graduate, staff and volunteer; the team can edit this on the ambassador page.
    memberType: request.role === 'hirer' ? 'volunteer' : 'student',
    status: 'onboarding',
  });
  await ambassador.save();

  if (channel) {
    await CommunityMembership.findOneAndUpdate(
      { channelId: channel._id, userId: user._id },
      { $set: { status: 'active', role: 'member', reviewedBy: req.auth.sub, reviewedAt: new Date() }, $unset: { bannedReason: 1 } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }

  request.status = 'approved';
  request.reviewNote = req.body.note;
  request.reviewedBy = req.auth.sub;
  request.reviewedAt = new Date();
  request.ambassadorId = ambassador._id;
  if (channel) request.channelId = channel._id;
  await request.save();

  await notifyUser(user._id, {
    title: 'Ambassador request approved',
    message: channel
      ? `Congratulations! Your request to become a Kredibble ambassador has been approved. Welcome to the team! You have been added to "${channel.name}" in Community, where our team will share next steps.`
      : 'Congratulations! Your request to become a Kredibble ambassador has been approved. Welcome to the team! Our team will be in touch shortly with next steps.',
    type: 'ambassador',
    priority: 'high',
  });
  await auditReq(req, {
    action: AUDIT_ACTIONS.ADMIN_AMBASSADOR_DECISION,
    resourceType: AUDIT_RESOURCE_TYPES.AMBASSADOR_REQUEST,
    resourceId: request._id,
    outcome: 'success',
    metadata: { decision: 'approved', channelId: channel ? String(channel._id) : undefined },
  });
  await logActivity(req.auth.sub, 'approved ambassador request', 'ambassadors', ambassador);
  itemResponse(res, toRequestResponse(request));
}));

adminApiRouter.post('/ambassador-requests/:id/reject', requireAdminAuth, validate(rejectAmbassadorRequestSchema), asyncHandler(async (req, res) => {
  const request = await AmbassadorRequest.findById(req.params.id);
  if (!request) throw notFound('Ambassador request');
  if (request.status !== 'pending') throw new ApiError(409, 'This request has already been decided');
  request.status = 'rejected';
  request.reviewNote = req.body.note;
  request.reviewedBy = req.auth.sub;
  request.reviewedAt = new Date();
  await request.save();

  await notifyUser(request.userId, {
    title: 'Ambassador request update',
    message: 'Thank you for your interest in becoming a Kredibble ambassador. We have carefully reviewed your request and are unable to approve it at this time. You are welcome to apply again in a few days, and we encourage you to keep contributing to the Kredibble community.',
    type: 'ambassador',
  });
  await auditReq(req, {
    action: AUDIT_ACTIONS.ADMIN_AMBASSADOR_DECISION,
    resourceType: AUDIT_RESOURCE_TYPES.AMBASSADOR_REQUEST,
    resourceId: request._id,
    outcome: 'success',
    metadata: { decision: 'rejected' },
  });
  itemResponse(res, toRequestResponse(request));
}));

adminApiRouter.post('/ambassador-requests/:id/revoke', requireAdminAuth, validate(rejectAmbassadorRequestSchema), asyncHandler(async (req, res) => {
  const request = await AmbassadorRequest.findById(req.params.id);
  if (!request) throw notFound('Ambassador request');
  if (request.status !== 'approved') throw new ApiError(409, 'Only an approved ambassador can be removed');

  // Take back the ambassador status.
  // Dormant through save(), so the dormantSince date used by the Network totals and leaderboard is recorded.
  for (const ambassador of await Ambassador.find({ linkedUserId: request.userId })) {
    ambassador.status = 'dormant';
    await ambassador.save();
  }

  // Remove the person from every channel an admin created and added them to (the ambassador group, for example).
  // Groups they joined or created themselves are left alone.
  const memberships = await CommunityMembership.find({ userId: request.userId, status: 'active', reviewedBy: { $ne: null } }).populate('channelId', 'name createdBy').lean();
  const creatorIds = [...new Set(memberships.map((m) => m.channelId?.createdBy).filter(Boolean).map(String))];
  const adminIds = new Set((await User.find({ _id: { $in: creatorIds }, role: 'admin' }).select('_id').lean()).map((u) => String(u._id)));
  const removedFrom = [];
  for (const membership of memberships) {
    const channel = membership.channelId;
    const addedByAdminChannel = channel && adminIds.has(String(channel.createdBy));
    if (!addedByAdminChannel && String(channel?._id) !== String(request.channelId)) continue;
    await CommunityMembership.updateOne({ _id: membership._id }, { $set: { status: 'removed', reviewedBy: req.auth.sub, reviewedAt: new Date() } });
    evictFromChannelRoom(channel._id, request.userId);
    removedFrom.push(channel.name);
  }

  request.status = 'rejected';
  request.reviewNote = req.body.note || request.reviewNote;
  request.reviewedBy = req.auth.sub;
  request.reviewedAt = new Date();
  await request.save();

  await notifyUser(request.userId, {
    title: 'Ambassador status update',
    message: 'Thank you for your time as a Kredibble ambassador. Your ambassador status has now ended, and your access to the ambassador group has been removed. We appreciate your contribution and you are welcome to apply again in future.',
    type: 'ambassador',
  });
  await auditReq(req, {
    action: AUDIT_ACTIONS.ADMIN_AMBASSADOR_DECISION,
    resourceType: AUDIT_RESOURCE_TYPES.AMBASSADOR_REQUEST,
    resourceId: request._id,
    outcome: 'success',
    metadata: { decision: 'revoked', removedFrom },
  });
  await logActivity(req.auth.sub, 'removed ambassador', 'ambassadors', { _id: request.ambassadorId || request._id });
  itemResponse(res, { ...toRequestResponse(request), removedFrom });
}));

// --- Admin-managed channels: create, members and group chat ------------------

adminApiRouter.post('/channels', requireAdminAuth, validate(createAdminChannelSchema), asyncHandler(async (req, res) => {
  const channel = await Channel.create({
    name: req.body.name,
    category: req.body.category,
    bio: req.body.bio,
    visibility: req.body.visibility,
    requiresApproval: req.body.visibility === 'private',
    owner: 'Kredibble',
    createdBy: req.auth.sub,
  });
  await CommunityMembership.create({ channelId: channel._id, userId: req.auth.sub, role: 'admin', status: 'active', reviewedBy: req.auth.sub, reviewedAt: new Date() });
  await auditReq(req, { action: AUDIT_ACTIONS.ADMIN_USER_UPDATE, resourceType: AUDIT_RESOURCE_TYPES.COMMUNITY_CHANNEL, resourceId: channel._id, outcome: 'success', metadata: { created: true } });
  res.status(201).json({ data: toClientObject(channel) });
}));

adminApiRouter.get('/channels/:id/members', requireAdminAuth, asyncHandler(async (req, res) => {
  const channel = await Channel.findById(validId(req.params.id, 'Channel'));
  if (!channel) throw notFound('Channel');
  const status = ['pending', 'active', 'removed', 'banned'].includes(req.query.status) ? req.query.status : 'active';
  const memberships = await CommunityMembership.find({ channelId: channel._id, status }).populate('userId', 'name email role avatarUrl').lean();
  listResponse(res, memberships.map((m) => ({
    id: String(m._id),
    userId: String(m.userId?._id || m.userId),
    name: m.userId?.name,
    email: m.userId?.email,
    userRole: m.userId?.role,
    role: m.role,
    status: m.status,
    joinedAt: m.createdAt,
  })));
}));

adminApiRouter.post('/channels/:id/members', requireAdminAuth, validate(addChannelMemberSchema), asyncHandler(async (req, res) => {
  const channel = await Channel.findById(req.params.id);
  if (!channel) throw notFound('Channel');
  const user = await User.findById(req.body.userId).select('name role');
  if (!user || user.role === 'deleted') throw notFound('User');
  const membership = await CommunityMembership.findOneAndUpdate(
    { channelId: channel._id, userId: user._id },
    { $set: { status: 'active', role: 'member', reviewedBy: req.auth.sub, reviewedAt: new Date() }, $unset: { bannedReason: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await notifyUser(user._id, { title: 'Added to a group', message: `You were added to "${channel.name}" in Community.`, type: 'channel' });
  itemResponse(res, toClientObject(membership));
}));

adminApiRouter.delete('/channels/:id/members/:userId', requireAdminAuth, asyncHandler(async (req, res) => {
  const channel = await Channel.findById(validId(req.params.id, 'Channel'));
  if (!channel) throw notFound('Channel');
  if (String(channel.createdBy) === req.params.userId) throw new ApiError(400, 'The group creator cannot be removed');
  const membership = await CommunityMembership.findOneAndUpdate(
    { channelId: channel._id, userId: validId(req.params.userId, 'User') },
    { $set: { status: 'removed', reviewedBy: req.auth.sub, reviewedAt: new Date() } },
    { new: true },
  );
  if (!membership) throw notFound('Channel member');
  evictFromChannelRoom(channel._id, req.params.userId);
  itemResponse(res, toClientObject(membership));
}));

adminApiRouter.get('/channels/:id/messages', requireAdminAuth, asyncHandler(async (req, res) => {
  const channel = await Channel.findById(validId(req.params.id, 'Channel'));
  if (!channel) throw notFound('Channel');
  listResponse(res, await listChannelMessages(channel._id, { before: req.query.before, limit: req.query.limit }));
}));

adminApiRouter.get('/channels/:id/messages/:messageId/replies', requireAdminAuth, asyncHandler(async (req, res) => {
  const channel = await Channel.findById(validId(req.params.id, 'Channel'));
  if (!channel) throw notFound('Channel');
  const thread = await getThread(channel._id, validId(req.params.messageId, 'Message'));
  if (!thread) throw notFound('Message');
  itemResponse(res, thread);
}));

adminApiRouter.post('/channels/:id/messages', requireAdminAuth, asyncHandler(async (req, res) => {
  const parsed = chatMessageSchema.safeParse({ body: req.body, query: req.query, params: { channelId: req.params.id } });
  if (!parsed.success) throw new ApiError(400, 'Validation failed: ' + parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join(', '));
  const channel = await Channel.findById(parsed.data.params.channelId);
  if (!channel) throw notFound('Channel');
  const sender = await User.findById(req.auth.sub).select('name role');
  if (!sender) throw new ApiError(401, 'Account no longer active');
  const { body, parentId, allowReplies } = parsed.data.body;
  if (parentId && !(await findPost(channel._id, parentId))) throw notFound('Message');
  res.status(201).json({ data: await postChannelMessage({ channel, sender, body, parentId, allowReplies }) });
}));

// Turn replies on or off for a post that is already published.
adminApiRouter.patch('/channels/:id/messages/:messageId', requireAdminAuth, validate(allowRepliesSchema), asyncHandler(async (req, res) => {
  const channel = await Channel.findById(req.params.id);
  if (!channel) throw notFound('Channel');
  const updated = await setAllowReplies(channel._id, req.params.messageId, req.body.allowReplies);
  if (!updated) throw notFound('Message');
  itemResponse(res, updated);
}));


export const toBeneficiaryClientObject = (doc) => {
  if (!doc) return doc;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const id = raw._id ? raw._id.toString() : (raw.id ? String(raw.id) : '');
  const name = raw.fullName || raw.name || '';
  const email = raw.email || '';
  const phone = raw.phone || undefined;
  const country = raw.country || '';
  const institution = raw.institution || '';

  let source = raw.source || raw.sourceType || 'organic';
  if (source === 'ambassador-referral') source = 'ambassador';
  else if (source === 'partner-channel') source = 'partner';
  else if (source === 'bulk-import') source = 'import';

  const verified = Boolean(raw.verified);
  const verifiedAt = raw.verifiedAt || undefined;
  const createdAt = raw.createdAt
    ? (typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 10) : new Date(raw.createdAt).toISOString().slice(0, 10))
    : new Date().toISOString().slice(0, 10);

  const ambassadorId = raw.ambassadorId?._id
    ? raw.ambassadorId._id.toString()
    : (raw.ambassadorId ? raw.ambassadorId.toString() : undefined);
  const ambassadorName = raw.ambassadorId?.fullName || raw.ambassadorId?.name || undefined;

  const listingId = (raw.listingId?._id ? raw.listingId._id.toString() : (raw.listingId ? raw.listingId.toString() : undefined))
    || (raw.opportunityId?._id ? raw.opportunityId._id.toString() : (raw.opportunityId ? raw.opportunityId.toString() : undefined));
  const listingTitle = raw.listingId?.title || raw.opportunityId?.title || undefined;

  const addedById = raw.addedBy?._id
    ? raw.addedBy._id.toString()
    : (raw.addedBy ? raw.addedBy.toString() : undefined);
  const addedByName = raw.addedBy?.name || raw.addedBy?.fullName || undefined;

  return {
    ...raw,
    id,
    _id: id,
    name,
    fullName: name,
    email,
    phone,
    country,
    institution,
    source,
    sourceType: source === 'ambassador' ? 'ambassador-referral'
      : (source === 'partner' ? 'partner-channel'
      : (source === 'import' ? 'bulk-import' : source)),
    verified,
    verifiedAt,
    createdAt,
    ambassadorId,
    ambassadorName,
    listingId,
    opportunityId: listingId,
    listingTitle,
    addedBy: addedById,
    addedById,
    addedByName,
  };
};

export const findDuplicateBeneficiary = async ({ email, phone, country, existingId }) => {
  const normEmail = normalizeEmail(email);
  if (normEmail) {
    const filter = { email: normEmail };
    if (existingId) filter._id = { $ne: existingId };
    const emailMatch = await Beneficiary.findOne(filter).populate('ambassadorId listingId opportunityId addedBy');
    if (emailMatch) {
      return { field: 'email', record: emailMatch };
    }
  }

  const normPhone = normalizePhone(phone, country);
  if (normPhone) {
    const filter = {
      $or: [
        { phoneNormalized: normPhone },
        { phone: (phone || '').trim() },
      ],
    };
    if (existingId) filter._id = { $ne: existingId };
    const phoneMatch = await Beneficiary.findOne(filter).populate('ambassadorId listingId opportunityId addedBy');
    if (phoneMatch) {
      return { field: 'phone', record: phoneMatch };
    }

    const candidates = await Beneficiary.find({
      phone: { $exists: true, $ne: '' },
      ...(existingId ? { _id: { $ne: existingId } } : {}),
    }).select('phone country').lean();

    for (const cand of candidates) {
      if (normalizePhone(cand.phone, cand.country) === normPhone) {
        const fullRecord = await Beneficiary.findById(cand._id).populate('ambassadorId listingId opportunityId addedBy');
        return { field: 'phone', record: fullRecord };
      }
    }
  }

  return null;
};

export const calculateBeneficiaryPace = async (monthQuery) => {
  const current = new Date().toISOString().slice(0, 7);
  const month = typeof monthQuery === 'string' && /^\d{4}-\d{2}$/.test(monthQuery) ? monthQuery : current;
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();

  const today = new Date();
  let dayOfMonth;
  if (month === current) {
    dayOfMonth = Math.min(today.getUTCDate(), daysInMonth);
  } else if (month < current) {
    dayOfMonth = daysInMonth;
  } else {
    dayOfMonth = 0;
  }

  const verified = await Beneficiary.countDocuments({
    verified: true,
    $or: [
      { verifiedAt: { $regex: `^${month}` } },
      { verifiedAt: { $exists: false }, createdAt: { $gte: new Date(`${month}-01T00:00:00.000Z`), $lte: new Date(`${month}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999Z`) } },
      { verifiedAt: null, createdAt: { $gte: new Date(`${month}-01T00:00:00.000Z`), $lte: new Date(`${month}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999Z`) } },
    ],
  });

  const targets = await getTargetsForMonth(month);
  const targetItem = targets.find((t) => t.kpi === 'beneficiaries_verified' || t.metric === 'beneficiaries_verified')
    || targets.find((t) => t.kpi === 'beneficiariesVerified' || t.metric === 'beneficiariesVerified');
  const target = targetItem?.value ?? targetItem?.target ?? 15;

  const thresholds = await getThresholdsInForce(month);
  const greenRatio = thresholds.greenRatio ?? (thresholds.green / 100);
  const amberRatio = thresholds.amberRatio ?? (thresholds.amber / 100);

  const pace = daysInMonth > 0 ? (target * dayOfMonth) / daysInMonth : 0;
  const paceRounded = Math.round(pace);

  let status = 'on_pace';
  if (target > 0) {
    if (verified >= pace * greenRatio) {
      status = 'on_pace';
    } else if (verified >= pace * amberRatio) {
      status = 'behind';
    } else {
      status = 'far_behind';
    }
  }

  const scale = Math.max(Math.ceil(pace * 2), 1);
  const redEnd = Math.min(100, ((amberRatio * pace) / scale) * 100);
  const amberEnd = Math.min(100, ((greenRatio * pace) / scale) * 100);

  const PACE_WORDS = { on_pace: 'on pace', behind: 'behind', far_behind: 'far behind' };
  const percent = (ratio) => `${Math.round(ratio * 100)}%`;

  return {
    month,
    verified,
    target,
    pace,
    paceRounded,
    status,
    text: `${verified} of ${target} verified, pro-rated pace ${paceRounded}, ${PACE_WORDS[status]}`,
    hint: `Far behind: below ${percent(amberRatio)} of the pro-rated pace. Behind: ${percent(amberRatio)} to ${percent(greenRatio)}. On pace: ${percent(greenRatio)} and above.`,
    gauge: {
      max: Math.max(scale, verified),
      zones: [
        { key: 'far_behind', percent: redEnd },
        { key: 'behind', percent: Math.max(0, amberEnd - redEnd) },
        { key: 'on_pace', percent: Math.max(0, 100 - amberEnd) },
      ],
      markerAt: Math.min(100, (verified / scale) * 100),
      paceAt: Math.min(100, (pace / scale) * 100),
      capped: pace > 0 && verified > scale ? (verified / pace).toFixed(1) : null,
    },
  };
};

export const calculateBeneficiarySources = async (monthQuery) => {
  const matchFilter = {};
  if (typeof monthQuery === 'string' && /^\d{4}-\d{2}$/.test(monthQuery)) {
    const [yearStr, monthStr] = monthQuery.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const start = new Date(`${monthQuery}-01T00:00:00.000Z`);
    const end = new Date(`${monthQuery}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999Z`);
    matchFilter.$or = [
      { createdAtDate: { $regex: `^${monthQuery}` } },
      { createdAt: { $gte: start, $lte: end } },
    ];
  }

  const allRecords = await Beneficiary.find(matchFilter).select('source sourceType').lean();

  const counts = {
    organic: 0,
    ambassador: 0,
    event: 0,
    partner: 0,
    import: 0,
  };

  for (const rec of allRecords) {
    let src = rec.source || rec.sourceType || 'organic';
    if (src === 'ambassador-referral') src = 'ambassador';
    else if (src === 'partner-channel') src = 'partner';
    else if (src === 'bulk-import') src = 'import';
    if (counts[src] !== undefined) {
      counts[src]++;
    } else {
      counts.organic++;
    }
  }

  return CANONICAL_RECORD_SOURCES.map((source) => ({
    source,
    label: RECORD_SOURCE_LABELS[source] || source,
    count: counts[source] || 0,
  }));
};

const prepareBeneficiary = (body, existing = {}) => {
  const fullName = String(body.fullName ?? body.name ?? existing.fullName ?? existing.name ?? '').trim();
  const email = body.email !== undefined ? normalizeEmail(body.email) : (existing.email ? normalizeEmail(existing.email) : undefined);
  const phone = body.phone !== undefined ? String(body.phone || '').trim() : existing.phone;
  const country = body.country !== undefined ? String(body.country || '').trim() : existing.country;
  const institution = body.institution !== undefined ? String(body.institution || '').trim() : existing.institution;

  let source = body.source || body.sourceType || existing.source || existing.sourceType || 'organic';
  if (source === 'ambassador-referral') source = 'ambassador';
  else if (source === 'partner-channel') source = 'partner';
  else if (source === 'bulk-import') source = 'import';

  const ambassadorId = body.ambassadorId !== undefined
    ? (body.ambassadorId ? validId(body.ambassadorId, 'Ambassador') : null)
    : existing.ambassadorId;

  const listingId = (body.listingId ?? body.opportunityId) !== undefined
    ? ((body.listingId ?? body.opportunityId) ? validId(body.listingId ?? body.opportunityId, 'Opportunity') : null)
    : (existing.listingId ?? existing.opportunityId);

  const verified = body.verified !== undefined ? Boolean(body.verified) : Boolean(existing.verified);
  let verifiedAt = body.verifiedAt !== undefined ? body.verifiedAt : existing.verifiedAt;
  if (verified && !verifiedAt) {
    verifiedAt = new Date().toISOString().slice(0, 10);
  } else if (!verified) {
    verifiedAt = undefined;
  }

  const createdAtDate = body.createdAt || existing.createdAtDate || (existing.createdAt ? new Date(existing.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

  return {
    fullName,
    name: fullName,
    email: email || undefined,
    phone: phone || undefined,
    country: country || undefined,
    institution: institution || undefined,
    source,
    sourceType: source === 'ambassador' ? 'ambassador-referral' : (source === 'partner' ? 'partner-channel' : (source === 'import' ? 'bulk-import' : source)),
    ambassadorId,
    listingId,
    opportunityId: listingId,
    verified,
    verifiedAt,
    createdAtDate,
  };
};

adminApiRouter.get('/beneficiaries', requireAdminOrStaffAuth, requireScreen('database', 'view'), asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.source) {
    const s = req.query.source;
    filter.$or = [{ source: s }, { sourceType: s }];
    if (s === 'ambassador') filter.$or.push({ sourceType: 'ambassador-referral' });
    if (s === 'partner') filter.$or.push({ sourceType: 'partner-channel' });
    if (s === 'import') filter.$or.push({ sourceType: 'bulk-import' });
  } else if (req.query.sourceType) {
    filter.sourceType = req.query.sourceType;
  }
  if (req.query.verified !== undefined) {
    filter.verified = req.query.verified === 'true' || req.query.verified === true;
  }
  if (req.query.month) {
    filter.$or = [
      { verifiedAt: { $regex: `^${req.query.month}` } },
      { createdAtDate: { $regex: `^${req.query.month}` } },
    ];
  }
  if (req.query.q) {
    const term = escapedRegex(req.query.q);
    filter.$or = [
      { fullName: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
      { phone: { $regex: term, $options: 'i' } },
      { institution: { $regex: term, $options: 'i' } },
    ];
  }

  const { page, skip, limit } = pageOptions(req.query);
  const total = await Beneficiary.countDocuments(filter);
  const records = await Beneficiary.find(filter)
    .populate('ambassadorId', 'fullName name campus profilePhoto photoUrl status')
    .populate('listingId', 'title organisation status')
    .populate('opportunityId', 'title organisation status')
    .populate('addedBy', 'name fullName email')
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit);

  listResponse(res, records.map(toBeneficiaryClientObject), total, page, limit);
}));

adminApiRouter.get('/beneficiaries/pace', requireAdminOrStaffAuth, requireScreen('database', 'view'), asyncHandler(async (req, res) => {
  const pace = await calculateBeneficiaryPace(req.query.month);
  itemResponse(res, pace);
}));

adminApiRouter.get('/beneficiaries/sources', requireAdminOrStaffAuth, requireScreen('database', 'view'), asyncHandler(async (req, res) => {
  const sources = await calculateBeneficiarySources(req.query.month);
  listResponse(res, sources);
}));

adminApiRouter.get('/beneficiaries/pending-count', requireAdminOrStaffAuth, requireScreen('database', 'view'), asyncHandler(async (req, res) => {
  const count = await Beneficiary.countDocuments({ verified: false });
  itemResponse(res, { count });
}));

adminApiRouter.get('/beneficiaries/:id', requireAdminOrStaffAuth, requireScreen('database', 'view'), asyncHandler(async (req, res) => {
  const record = await Beneficiary.findById(validId(req.params.id, 'Beneficiary'))
    .populate('ambassadorId', 'fullName name campus profilePhoto photoUrl status')
    .populate('listingId', 'title organisation status')
    .populate('opportunityId', 'title organisation status')
    .populate('addedBy', 'name fullName email');
  if (!record) throw notFound('Beneficiary');
  itemResponse(res, toBeneficiaryClientObject(record));
}));

adminApiRouter.post('/beneficiaries', requireAdminOrStaffAuth, requireScreen('database', 'edit'), validate(beneficiaryCreateSchema), asyncHandler(async (req, res) => {
  const prepared = prepareBeneficiary(req.body);
  const duplicate = await findDuplicateBeneficiary({
    email: prepared.email,
    phone: prepared.phone,
    country: prepared.country,
  });

  if (duplicate) {
    return res.status(409).json({
      error: {
        message: `A record with this ${duplicate.field} already exists`,
        field: duplicate.field,
      },
      field: duplicate.field,
      duplicate: toBeneficiaryClientObject(duplicate.record),
    });
  }

  const record = await Beneficiary.create({ ...prepared, addedBy: req.auth.sub });
  await record.populate('ambassadorId listingId opportunityId addedBy');
  const sync = await syncManagedRecord('beneficiaries', record);
  await logActivity(req.auth.sub, 'created', 'beneficiaries', record);
  await auditReq(req, {
    action: AUDIT_ACTIONS.BENEFICIARY_CREATE,
    resourceType: AUDIT_RESOURCE_TYPES.BENEFICIARY,
    resourceId: record._id,
    outcome: 'success',
    metadata: { source: record.source, verified: record.verified },
  });

  res.status(201).json({ data: { ...toBeneficiaryClientObject(record), sync } });
}));

adminApiRouter.patch('/beneficiaries/:id', requireAdminOrStaffAuth, requireScreen('database', 'edit'), validate(beneficiaryUpdateSchema), asyncHandler(async (req, res) => {
  const record = await Beneficiary.findById(validId(req.params.id, 'Beneficiary'));
  if (!record) throw notFound('Beneficiary');

  const prepared = prepareBeneficiary(req.body, record);
  const duplicate = await findDuplicateBeneficiary({
    email: prepared.email,
    phone: prepared.phone,
    country: prepared.country,
    existingId: record._id,
  });

  if (duplicate) {
    return res.status(409).json({
      error: {
        message: `A record with this ${duplicate.field} already exists`,
        field: duplicate.field,
      },
      field: duplicate.field,
      duplicate: toBeneficiaryClientObject(duplicate.record),
    });
  }

  Object.assign(record, prepared);
  await record.save();
  await record.populate('ambassadorId listingId opportunityId addedBy');
  const sync = await syncManagedRecord('beneficiaries', record);
  await logActivity(req.auth.sub, 'updated', 'beneficiaries', record);
  await auditReq(req, {
    action: AUDIT_ACTIONS.BENEFICIARY_UPDATE,
    resourceType: AUDIT_RESOURCE_TYPES.BENEFICIARY,
    resourceId: record._id,
    outcome: 'success',
    metadata: { source: record.source, verified: record.verified },
  });

  itemResponse(res, { ...toBeneficiaryClientObject(record), sync });
}));

adminApiRouter.delete('/beneficiaries/:id', requireAdminOrStaffAuth, requireScreen('database', 'edit'), asyncHandler(async (req, res) => {
  const record = await Beneficiary.findById(validId(req.params.id, 'Beneficiary'));
  if (!record) throw notFound('Beneficiary');

  await Beneficiary.findByIdAndDelete(record._id);
  await logActivity(req.auth.sub, 'deleted', 'beneficiaries', record);
  await auditReq(req, {
    action: AUDIT_ACTIONS.BENEFICIARY_DELETE,
    resourceType: AUDIT_RESOURCE_TYPES.BENEFICIARY,
    resourceId: record._id,
    outcome: 'success',
  });

  res.status(200).json({ data: { id: record._id.toString() } });
}));

adminApiRouter.post('/beneficiaries/:id/verify', requireAdminOrStaffAuth, requireScreen('database', 'edit'), asyncHandler(async (req, res) => {
  const record = await Beneficiary.findById(validId(req.params.id, 'Beneficiary')).populate('ambassadorId listingId opportunityId addedBy');
  if (!record) throw notFound('Beneficiary');

  const previousVerified = Boolean(record.verified);
  const previousVerifiedAt = record.verifiedAt;
  const undo = {
    id: record._id.toString(),
    verified: previousVerified,
    verifiedAt: previousVerifiedAt,
  };

  record.verified = true;
  record.verifiedAt = new Date().toISOString().slice(0, 10);
  await record.save();
  await record.populate('ambassadorId listingId opportunityId addedBy');

  const clientRecord = toBeneficiaryClientObject(record);
  await logActivity(req.auth.sub, 'verified', 'beneficiaries', record);
  await auditReq(req, {
    action: AUDIT_ACTIONS.BENEFICIARY_VERIFY,
    resourceType: AUDIT_RESOURCE_TYPES.BENEFICIARY,
    resourceId: record._id,
    outcome: 'success',
    metadata: { verifiedAt: record.verifiedAt },
  });

  res.json({
    data: clientRecord,
    record: clientRecord,
    undo,
  });
}));

const handleUndoVerify = async (req, res) => {
  const id = req.params.id || req.body.id;
  if (!id) throw new ApiError(400, 'Beneficiary id is required');
  const record = await Beneficiary.findById(validId(id, 'Beneficiary')).populate('ambassadorId listingId opportunityId addedBy');
  if (!record) throw notFound('Beneficiary');

  record.verified = Boolean(req.body.verified);
  record.verifiedAt = req.body.verifiedAt || undefined;
  await record.save();
  await record.populate('ambassadorId listingId opportunityId addedBy');

  const clientRecord = toBeneficiaryClientObject(record);
  await logActivity(req.auth.sub, 'undo verify', 'beneficiaries', record);
  await auditReq(req, {
    action: AUDIT_ACTIONS.BENEFICIARY_UNDO_VERIFY,
    resourceType: AUDIT_RESOURCE_TYPES.BENEFICIARY,
    resourceId: record._id,
    outcome: 'success',
    metadata: { verified: record.verified, verifiedAt: record.verifiedAt },
  });

  res.json({
    data: clientRecord,
    record: clientRecord,
  });
};

adminApiRouter.post('/beneficiaries/:id/undo-verify', requireAdminOrStaffAuth, requireScreen('database', 'edit'), validate(beneficiaryUndoVerifySchema), asyncHandler(handleUndoVerify));
adminApiRouter.post('/beneficiaries/:id/undo', requireAdminOrStaffAuth, requireScreen('database', 'edit'), validate(beneficiaryUndoVerifySchema), asyncHandler(handleUndoVerify));
adminApiRouter.post('/beneficiaries/undo-verify', requireAdminOrStaffAuth, requireScreen('database', 'edit'), validate(beneficiaryUndoVerifySchema), asyncHandler(handleUndoVerify));

adminApiRouter.post('/beneficiaries/:id/retry-wordpress-sync', requireAdminOrStaffAuth, requireScreen('database', 'edit'), asyncHandler(async (req, res) => {
  const record = await Beneficiary.findById(validId(req.params.id, 'Beneficiary'));
  if (!record) throw notFound('Beneficiary');
  itemResponse(res, { ...toBeneficiaryClientObject(record), sync: await syncManagedRecord('beneficiaries', record) });
}));

// BE-002: GET /targets?month= resolves the 10 KPI targets in force for the requested month
adminApiRouter.get('/targets', requireAdminOrStaffAuth, requireScreen('overview', 'view'), asyncHandler(async (req, res) => {
  const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
    ? req.query.month
    : new Date().toISOString().slice(0, 7);
  const targets = await getTargetsForMonth(month);
  listResponse(res, targets.map(toClientObject));
}));

// BE-002: GET /targets/history returns the append-only TargetChange log, newest first
adminApiRouter.get('/targets/history', requireAdminOrStaffAuth, requireScreen('settings_admin', 'view'), asyncHandler(async (req, res) => {
  const { page, skip, limit } = pageOptions(req.query);
  const { history, total } = await getTargetHistory({ limit, skip });
  listResponse(res, history.map(toClientObject), total, page, limit);
}));

// BE-002, BE-003: POST /targets saves a batch of target changes, optionally with thresholds under one effectiveFrom
adminApiRouter.post('/targets', requireAdminOrStaffAuth, requireScreen('settings_admin', 'edit'), validate(targetsBatchSchema), asyncHandler(async (req, res) => {
  const { effectiveFrom, targets = [], thresholds } = req.body;
  const callerUser = await User.findById(req.auth.sub).select('name email').lean();
  const callerName = callerUser?.name || req.auth.email || 'Admin';

  let insertedTargets = [];
  if (targets.length > 0) {
    insertedTargets = await saveTargetBatch({
      targets,
      effectiveFrom,
      changedBy: req.auth.sub,
      changedByName: callerName,
    });

    await auditReq(req, {
      action: AUDIT_ACTIONS.TARGETS_UPDATE,
      resourceType: AUDIT_RESOURCE_TYPES.SETTINGS,
      resourceId: insertedTargets[0]?._id,
      outcome: 'success',
      metadata: {
        targetKey: 'targets',
        effectiveFrom,
        changes: insertedTargets.map((row) => ({ kpi: row.kpi, value: row.value, previous: row.previous, seq: row.seq })),
      },
    });
  }

  let insertedThresholds = null;
  if (thresholds) {
    insertedThresholds = await saveThresholdChange({
      green: thresholds.green,
      amber: thresholds.amber,
      effectiveFrom,
      changedBy: req.auth.sub,
      changedByName: callerName,
    });

    await auditReq(req, {
      action: AUDIT_ACTIONS.THRESHOLDS_UPDATE,
      resourceType: AUDIT_RESOURCE_TYPES.SETTINGS,
      resourceId: insertedThresholds._id,
      outcome: 'success',
      metadata: {
        effectiveFrom,
        green: thresholds.green,
        amber: thresholds.amber,
        previous: insertedThresholds.previous,
        seq: insertedThresholds.seq,
      },
    });
  }

  res.status(201).json({
    data: {
      saved: insertedTargets.length + (insertedThresholds ? 1 : 0),
      effectiveFrom,
      targets: insertedTargets.map(toClientObject),
      thresholds: insertedThresholds ? toClientObject(insertedThresholds) : undefined,
    },
  });
}));

// BE-003: GET /thresholds?month= resolves status thresholds in force for the month
adminApiRouter.get('/thresholds', requireAdminOrStaffAuth, requireScreen('overview', 'view'), asyncHandler(async (req, res) => {
  const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
    ? req.query.month
    : new Date().toISOString().slice(0, 7);
  const thresholds = await getThresholdsInForce(month);
  itemResponse(res, toClientObject(thresholds));
}));

// BE-003: GET /thresholds/history returns append-only threshold history, newest first
adminApiRouter.get('/thresholds/history', requireAdminOrStaffAuth, requireScreen('settings_admin', 'view'), asyncHandler(async (req, res) => {
  const { page, skip, limit } = pageOptions(req.query);
  const { history, total } = await getThresholdHistory({ limit, skip });
  listResponse(res, history.map(toClientObject), total, page, limit);
}));

// BE-003: POST /thresholds saves new status thresholds for a month
adminApiRouter.post('/thresholds', requireAdminOrStaffAuth, requireScreen('settings_admin', 'edit'), validate(thresholdsSchema), asyncHandler(async (req, res) => {
  const { green, amber, effectiveFrom } = req.body;
  const callerUser = await User.findById(req.auth.sub).select('name email').lean();
  const callerName = callerUser?.name || req.auth.email || 'Admin';

  const row = await saveThresholdChange({
    green,
    amber,
    effectiveFrom,
    changedBy: req.auth.sub,
    changedByName: callerName,
  });

  await auditReq(req, {
    action: AUDIT_ACTIONS.THRESHOLDS_UPDATE,
    resourceType: AUDIT_RESOURCE_TYPES.SETTINGS,
    resourceId: row._id,
    outcome: 'success',
    metadata: {
      effectiveFrom,
      green,
      amber,
      previous: row.previous,
      seq: row.seq,
    },
  });

  res.status(201).json({
    data: toClientObject(row),
  });
}));

// BE-003: GET /change-history returns targets and thresholds together in ONE list, newest first
adminApiRouter.get('/change-history', requireAdminOrStaffAuth, requireScreen('settings_admin', 'view'), asyncHandler(async (req, res) => {
  const { page, skip, limit } = pageOptions(req.query);
  const { history, total } = await getCombinedChangeHistory({ limit, skip });
  listResponse(res, history.map(toClientObject), total, page, limit);
}));

// Legacy PUT /targets/:metric kept for backward compatibility until all callers migrate
adminApiRouter.put('/targets/:metric', requireAdminOrStaffAuth, requirePortalRoles('Desk Lead', 'Admin Support'), asyncHandler(async (req, res) => {
  const { month } = monthBounds(req.body.month);
  const target = Number(req.body.target);
  if (!Number.isFinite(target) || target < 0) throw new ApiError(400, 'target must be a non-negative number');
  const greenThreshold = Number.isFinite(Number(req.body.greenThreshold)) ? Number(req.body.greenThreshold) : 1;
  const amberThreshold = Number.isFinite(Number(req.body.amberThreshold)) ? Number(req.body.amberThreshold) : 0.7;
  if (greenThreshold < 0 || amberThreshold < 0 || amberThreshold > greenThreshold) {
    throw new ApiError(400, 'thresholds must be non-negative and amberThreshold cannot exceed greenThreshold');
  }
  const record = await MonthlyTarget.findOneAndUpdate(
    { month, metric: req.params.metric },
    { $set: {
      target,
      unit: req.body.unit || 'count',
      note: req.body.note,
      greenThreshold,
      amberThreshold,
      updatedBy: req.auth.sub,
    } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  // If this metric matches one of the 10 KPIs and target >= 1, also append to TargetChange to keep history in sync
  if (KPI_KEYS.includes(req.params.metric) && target >= 1) {
    const callerUser = await User.findById(req.auth.sub).select('name email').lean();
    await saveTargetBatch({
      targets: [{ kpi: req.params.metric, value: Math.round(target) }],
      effectiveFrom: month,
      changedBy: req.auth.sub,
      changedByName: callerUser?.name || 'Admin',
    });
  }

  itemResponse(res, toClientObject(record));
}));

const metricStatus = (value, target, thresholds = {}) => {
  if (!target) return 'green';
  const ratio = value / target;
  const green = Number.isFinite(thresholds.greenRatio)
    ? thresholds.greenRatio
    : Number.isFinite(thresholds.greenThreshold)
      ? thresholds.greenThreshold
      : 0.95;
  const amber = Number.isFinite(thresholds.amberRatio)
    ? thresholds.amberRatio
    : Number.isFinite(thresholds.amberThreshold)
      ? thresholds.amberThreshold
      : 0.7;
  return ratio >= green ? 'green' : ratio >= amber ? 'amber' : 'red';
};

const dashboardMetrics = async (month) => {
  const { start, end } = monthBounds(month);
  const [opportunitiesPublished, programsActive, programsDelivered, partnersClosed, ambassadorsActive, beneficiariesVerified, beneficiariesAdded, social, applications] = await Promise.all([
    Opportunity.countDocuments({ vetted: true, moderationStatus: { $in: ['published', 'approved'] }, createdAt: { $gte: start, $lt: end } }),
    Program.countDocuments({ status: { $in: ['planned', 'running'] } }),
    Program.countDocuments({
      status: 'delivered',
      $or: [
        { deliveredAt: { $gte: start, $lt: end } },
        { deliveredAt: { $exists: false }, endAt: { $gte: start, $lt: end } },
        { deliveredAt: null, endAt: { $gte: start, $lt: end } },
      ],
    }),
    Partner.countDocuments({
      $or: [
        {
          stageHistory: {
            $elemMatch: {
              stage: { $in: ['onboard', 'renew', 'Onboard', 'Renew'] },
              at: { $gte: start.toISOString().slice(0, 10), $lt: end.toISOString().slice(0, 10) },
            },
          },
        },
        {
          $and: [
            { stageHistory: { $size: 0 } },
            { closed: true, updatedAt: { $gte: start, $lt: end } },
          ],
        },
      ],
    }),
    (async () => {
      const summary = await calculateNetworkSummary(month);
      return summary.active;
    })(),
    Beneficiary.countDocuments({
      verified: true,
      $or: [
        { verifiedAt: { $gte: start.toISOString().slice(0, 10), $lt: end.toISOString().slice(0, 10) } },
        { verifiedAt: { $exists: false }, createdAt: { $gte: start, $lt: end } },
        { verifiedAt: null, createdAt: { $gte: start, $lt: end } },
      ],
    }),
    Beneficiary.countDocuments({
      $or: [
        { createdAtDate: { $gte: start.toISOString().slice(0, 10), $lt: end.toISOString().slice(0, 10) } },
        { createdAt: { $gte: start, $lt: end } },
      ],
    }),
    SocialPost.aggregate([
      {
        $match: {
          status: 'published',
          $or: [
            { postedAt: { $gte: start, $lt: end } },
            { postedAtDate: { $gte: start.toISOString().slice(0, 10), $lt: end.toISOString().slice(0, 10) } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          posts: { $sum: 1 },
          reach: { $sum: '$reach' },
          engagement: { $sum: '$engagement' },
        },
      },
    ]),
    OpportunityEngagement.countDocuments({ event: 'application', createdAt: { $gte: start, $lt: end } }),
  ]);
  const publishedPosts = social[0]?.posts || 0;
  const reachVal = social[0]?.reach || 0;
  const engagementVal = social[0]?.engagement || 0;
  return {
    opportunitiesPublished, programsActive, programsDelivered, partnersClosed, ambassadorsActive, beneficiariesVerified,
    beneficiariesAdded,
    postsPublished: publishedPosts,
    posts_published: publishedPosts,
    socialReach: reachVal,
    social_reach: reachVal,
    socialEngagement: engagementVal,
    social_engagement: engagementVal,
    opportunityApplications: applications,
  };
};

const partnerPipelineHealth = (month) => calculatePipelineHealth(month);

const targetProgress = (values, targets) => {
  const targetsByMetric = new Map(targets.map((target) => [target.metric, target]));
  return Object.entries(values).map(([metric, value]) => {
    const target = targetsByMetric.get(metric);
    const targetValue = target?.target || 0;
    return {
      metric,
      value,
      target: targetValue,
      unit: target?.unit || 'count',
      attainment: targetValue ? Math.min(100, Math.round((value / targetValue) * 100)) : null,
      status: metricStatus(value, targetValue, target),
      note: target?.note || '',
    };
  });
};

const sixMonthTrend = async (month) => {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(start);
    date.setUTCMonth(date.getUTCMonth() - (5 - index));
    return date.toISOString().slice(0, 7);
  });
  return Promise.all(months.map(async (value) => ({ month: value, values: await dashboardMetrics(value) })));
};

const databasePace = async (month, targetsByMetric) => {
  const { start, end } = monthBounds(month);
  const value = await Beneficiary.countDocuments({ createdAt: { $gte: start, $lt: end } });
  const target = targetsByMetric.get('beneficiariesAdded');
  return {
    value,
    target: target?.target || 0,
    unit: target?.unit || 'count',
    attainment: target?.target ? Math.min(100, Math.round((value / target.target) * 100)) : null,
    status: metricStatus(value, target?.target, target),
  };
};

const leaderboardEntries = async (month, limit) => {
  const entries = await calculateLeaderboard(month);
  return limit ? entries.slice(0, limit) : entries;
};

const staffRoles = (staff) => String(staff.role || '').split(',').map((role) => role.trim().toLowerCase());

const scorecardForStaff = async (staff, month, targetsByMetric) => {
  const { start, end } = monthBounds(month);
  const userId = staff.userId;
  const metrics = [];
  const roles = staffRoles(staff);
  if (roles.some((role) => ['opportunities officer', 'writer'].includes(role))) {
    metrics.push({ metric: 'opportunitiesPublished', value: await Opportunity.countDocuments({ createdBy: userId, vetted: true, createdAt: { $gte: start, $lt: end } }) });
  }
  if (roles.includes('training and capacity development officer')) {
    metrics.push({
      metric: 'programsDelivered',
      value: await Program.countDocuments({
        createdBy: userId,
        status: 'delivered',
        $or: [
          { deliveredAt: { $gte: start, $lt: end } },
          { deliveredAt: { $exists: false }, endAt: { $gte: start, $lt: end } },
          { deliveredAt: null, endAt: { $gte: start, $lt: end } },
        ],
      }),
    });
  }
  if (roles.includes('partnerships officer')) {
    metrics.push({
      metric: 'partnersClosed',
      value: await Partner.countDocuments({
        assignedOwnerId: userId,
        $or: [
          {
            stageHistory: {
              $elemMatch: {
                stage: { $in: ['onboard', 'renew', 'Onboard', 'Renew'] },
                at: { $gte: start.toISOString().slice(0, 10), $lt: end.toISOString().slice(0, 10) },
              },
            },
          },
          {
            $and: [
              { stageHistory: { $size: 0 } },
              { closed: true, updatedAt: { $gte: start, $lt: end } },
            ],
          },
        ],
      }),
    });
  }
  if (roles.some((role) => ['database officer', 'country lead'].includes(role))) {
    metrics.push({ metric: 'beneficiariesAdded', value: await Beneficiary.countDocuments({ addedBy: userId, createdAt: { $gte: start, $lt: end } }) });
  }
  if (roles.some((role) => ['communications officer', 'social media manager'].includes(role))) {
    const social = await SocialPost.aggregate([{ $match: { createdBy: userId, status: 'published', postedAt: { $gte: start, $lt: end } } }, { $group: { _id: null, reach: { $sum: '$reach' } } }]);
    metrics.push({ metric: 'socialReach', value: social[0]?.reach || 0 });
  }
  const scored = metrics.map((item) => {
    const target = targetsByMetric.get(item.metric)?.target || 0;
    return { ...item, target, attainment: target ? Math.min(100, Math.round((item.value / target) * 100)) : 0 };
  });
  const ordered = [...scored].sort((a, b) => b.attainment - a.attainment);
  const score = scored.length ? Math.round(scored.reduce((sum, item) => sum + item.attainment, 0) / scored.length) : 0;
  return { staff: { id: staff.id || staff._id.toString(), name: staff.name, role: staff.role }, score, metrics: scored, strongestMetric: ordered[0] || null, weakestMetric: ordered.at(-1) || null };
};

adminApiRouter.get('/scorecards', requireAdminOrStaffAuth, requirePortalRoles('Desk Lead', 'Admin Support'), asyncHandler(async (req, res) => {
  const { month } = monthBounds(req.query.month);
  const [staffMembers, targets] = await Promise.all([StaffMember.find({ status: 'active' }), MonthlyTarget.find({ month })]);
  const targetsByMetric = new Map(targets.map((target) => [target.metric, target]));
  const scorecards = await Promise.all(staffMembers.map((staff) => scorecardForStaff(staff, month, targetsByMetric)));
  listResponse(res, scorecards);
}));

adminApiRouter.get('/scorecards/me', requireAdminOrStaffAuth, requirePortalRoles(...ALL_PORTAL_ROLES), asyncHandler(async (req, res) => {
  const { month } = monthBounds(req.query.month);
  const staff = await StaffMember.findOne({ userId: req.auth.sub, status: 'active' });
  if (!staff) throw new ApiError(403, 'An active staff profile is required');
  const targets = await MonthlyTarget.find({ month });
  itemResponse(res, { month, ...await scorecardForStaff(staff, month, new Map(targets.map((target) => [target.metric, target]))) });
}));

adminApiRouter.get('/dashboard', requireAdminOrStaffAuth, requirePortalRoles(...ALL_PORTAL_ROLES), asyncHandler(async (req, res) => {
  const { month, start } = monthBounds(req.query.month);
  const [values, targets, pipeline, upcomingPrograms, activities, trend] = await Promise.all([
    dashboardMetrics(month),
    MonthlyTarget.find({ month }),
    partnerPipelineHealth(month),
    Program.find({ status: { $in: ['planned', 'running'] }, startAt: { $gte: start } }).sort({ startAt: 1 }).limit(10),
    AdminActivity.find().sort({ createdAt: -1 }).limit(10),
    sixMonthTrend(month),
  ]);
  const kpis = targetProgress(values, targets);
  itemResponse(res, { month, values, kpis, priorities: kpis.filter((kpi) => kpi.target > 0), trend, pipeline, upcomingPrograms: upcomingPrograms.map(toClientObject), recentActivity: activities.map(toClientObject) });
}));

adminApiRouter.get('/settings/pipeline-stages', requireAdminOrStaffAuth, requireScreen('settings_admin', 'view'), asyncHandler(async (req, res) => {
  const config = await PipelineStageConfig.findOne({ key: 'global' });
  const stages = config?.stages
    ? (config.stages.toJSON ? config.stages.toJSON() : { ...config.stages })
    : { ...DEFAULT_PIPELINE_STAGE_LABELS };
  itemResponse(res, stages);
}));

adminApiRouter.put('/settings/pipeline-stages', requireAdminOrStaffAuth, requireScreen('settings_admin', 'edit'), validate(pipelineStagesSchema), asyncHandler(async (req, res) => {
  const body = req.body;
  let stagesToSave;
  if (body.reset === true) {
    stagesToSave = { ...DEFAULT_PIPELINE_STAGE_LABELS };
  } else {
    const incoming = body.stages || body;
    stagesToSave = {
      prospect: incoming.prospect.trim(),
      outreach: incoming.outreach.trim(),
      proposal: incoming.proposal.trim(),
      mou: incoming.mou.trim(),
      onboard: incoming.onboard.trim(),
      renew: incoming.renew.trim(),
    };
  }

  let config = await PipelineStageConfig.findOne({ key: 'global' });
  const previous = config?.stages
    ? (config.stages.toJSON ? config.stages.toJSON() : { ...config.stages })
    : { ...DEFAULT_PIPELINE_STAGE_LABELS };

  if (!config) {
    config = new PipelineStageConfig({ key: 'global', stages: stagesToSave });
  } else {
    config.stages = stagesToSave;
  }
  config.updatedBy = req.auth.sub;
  await config.save();

  await auditReq(req, {
    action: AUDIT_ACTIONS.PIPELINE_STAGES_UPDATE,
    resourceType: AUDIT_RESOURCE_TYPES.SETTINGS,
    resourceId: config._id,
    outcome: 'success',
    metadata: { setting: 'pipeline_stages', previous, updated: stagesToSave, reset: Boolean(body.reset) },
  });

  const responseStages = config.stages.toJSON ? config.stages.toJSON() : config.stages;
  itemResponse(res, responseStages);
}));

adminApiRouter.get('/settings/integrations', requireAdminOrStaffAuth, requirePortalRoles('Desk Lead', 'Admin Support'), (req, res) => {
  itemResponse(res, {
    wordpress: { configured: configured(env.wordpressSyncBaseUrl) && configured(env.wordpressApiKey) },
    openai: { configured: configured(env.openaiApiKey), model: env.openaiModel },
    anthropic: { configured: configured(env.anthropicApiKey), model: env.anthropicModel },
    resend: { configured: configured(env.resendApiKey) && configured(env.resendFromEmail) },
  });
});

adminApiRouter.get('/leaderboard', requireAdminOrStaffAuth, requirePortalRoles(...AMBASSADOR_ROLES), asyncHandler(async (req, res) => {
  const { month } = monthBounds(req.query.month);
  const entries = await leaderboardEntries(month);
  itemResponse(res, { month, entries });
}));

adminApiRouter.get('/testimonials', requireAdminOrStaffAuth, requirePortalRoles(...SOCIAL_ROLES), asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const records = await Testimonial.find(filter).sort({ createdAt: -1 });
  listResponse(res, records.map(toClientObject));
}));

adminApiRouter.post('/testimonials/:id/moderate', requireAdminOrStaffAuth, requirePortalRoles(...SOCIAL_ROLES), asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!['approved', 'unpublished', 'rejected'].includes(status)) throw new ApiError(400, 'status must be approved, unpublished, or rejected');
  const record = await Testimonial.findById(validId(req.params.id, 'Testimonial'));
  if (!record) throw notFound('Testimonial');
  record.status = status;
  record.moderatedBy = req.auth.sub;
  record.moderatedAt = new Date();
  await record.save();
  await logActivity(req.auth.sub, status, 'testimonials', record);
  itemResponse(res, toClientObject(record));
}));

adminApiRouter.get('/reports/monthly', requireAdminOrStaffAuth, requirePortalRoles(...ALL_PORTAL_ROLES), asyncHandler(async (req, res) => {
  const { month } = monthBounds(req.query.month);
  const audience = req.query.audience === 'partner' ? 'partner' : 'internal';
  const { start, end } = monthBounds(month);
  const previousDate = new Date(start);
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previousMonth = previousDate.toISOString().slice(0, 7);
  const [metrics, pipeline, networkSize, social, targets, recordsBySource, topFive, activityCount, previousMetrics] = await Promise.all([
    dashboardMetrics(month), partnerPipelineHealth(month), Ambassador.countDocuments({ status: 'active' }), SocialPost.aggregate([{ $match: { status: 'published', postedAt: { $gte: start, $lt: end } } }, { $group: { _id: null, reach: { $sum: '$reach' }, engagement: { $sum: '$engagement' } } }]),
    MonthlyTarget.find({ month }),
    Beneficiary.aggregate([{ $match: { createdAt: { $gte: start, $lt: end } } }, { $group: { _id: '$sourceType', count: { $sum: 1 } } }]),
    leaderboardEntries(month, 5),
    AmbassadorAmplification.distinct('ambassadorId', { createdAt: { $gte: start, $lt: end } }),
    dashboardMetrics(previousMonth),
  ]);
  const targetsByMetric = new Map(targets.map((target) => [target.metric, target]));
  const percentGrowth = (value, prior) => prior ? Math.round(((value - prior) / prior) * 100) : null;
  const report = {
    month,
    audience,
    kpis: targetProgress(metrics, targets),
    pipeline,
    databasePace: await databasePace(month, targetsByMetric),
    recordsBySource: recordsBySource.map((item) => ({ sourceType: item._id, count: item.count })),
    ambassadorNetwork: { size: networkSize, activityRate: networkSize ? Math.round((activityCount.length / networkSize) * 100) : 0 },
    social: social[0] || { reach: 0, engagement: 0 },
    monthOverMonthGrowth: {
      opportunitiesPublished: percentGrowth(metrics.opportunitiesPublished, previousMetrics.opportunitiesPublished),
      beneficiariesAdded: percentGrowth(metrics.beneficiariesAdded, previousMetrics.beneficiariesAdded),
      socialReach: percentGrowth(metrics.socialReach, previousMetrics.socialReach),
    },
  };
  if (audience === 'internal') {
    const staffMembers = await StaffMember.find({ status: 'active' });
    report.topAmbassadors = topFive;
    report.teamScorecards = await Promise.all(staffMembers.map((staff) => scorecardForStaff(staff, month, targetsByMetric)));
  }
  itemResponse(res, report);
}));

adminApiRouter.get('/roles-permissions', requireAdminOrStaffAuth, requireScreen('roles_permissions', 'view'), asyncHandler(async (req, res) => {
  const toggles = await getEffectiveToggles();
  const matrix = computeFullMatrix(toggles);
  itemResponse(res, {
    roleIds: ROLE_IDS,
    screens: SCREENS,
    toggles,
    matrix,
  });
}));

adminApiRouter.put('/roles-permissions', requireAdminOrStaffAuth, requireScreen('roles_permissions', 'edit'), asyncHandler(async (req, res) => {
  const { toggles } = req.body;
  if (!toggles || typeof toggles !== 'object') {
    throw new ApiError(400, 'toggles object is required');
  }
  for (const role of ['Moderator', 'Support']) {
    if (!toggles[role] || typeof toggles[role] !== 'object') {
      throw new ApiError(400, `toggles.${role} is required`);
    }
  }

  const previous = await getEffectiveToggles();

  let config = await RolePermissionConfig.findOne({ key: 'global' });
  if (!config) {
    config = new RolePermissionConfig({ key: 'global' });
  }
  config.toggles = toggles;
  config.updatedBy = req.auth.sub;
  await config.save();

  invalidateTogglesCache();

  auditReq(req, {
    action: AUDIT_ACTIONS.ROLES_PERMISSIONS_UPDATE,
    resourceType: 'roles_permissions',
    resourceId: config._id,
    outcome: 'success',
    metadata: { previous, updated: toggles },
  });

  const matrix = computeFullMatrix(toggles);
  itemResponse(res, { toggles, matrix });
}));