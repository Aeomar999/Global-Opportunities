import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAdminOrStaffAuth } from '../middleware/auth.js';
import { requirePortalRoles, requireScreen } from '../middleware/portal-auth.js';
import { ApiError, asyncHandler, itemResponse, listResponse, notFound } from '../utils/http.js';
import { Opportunity } from '../models/Platform.js';
import { StaffMember, User } from '../models/User.js';
import {
  AdminActivity,
  Ambassador,
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
} from '../schemas/admin.js';
import { validate } from '../middleware/validate.js';

export const adminApiRouter = Router();

const ALL_PORTAL_ROLES = [
  'Partnerships Officer', 'Opportunities Officer', 'Writer', 'Training and Capacity Development Officer',
  'Database Officer', 'Communications Officer', 'Social Media Manager', 'Country Lead', 'Admin Support', 'Desk Lead',
];
const OPPORTUNITY_ROLES = ['Opportunities Officer', 'Writer', 'Desk Lead'];
const PROGRAM_ROLES = ['Training and Capacity Development Officer', 'Desk Lead'];
const PARTNER_ROLES = ['Partnerships Officer', 'Desk Lead'];
const AMBASSADOR_ROLES = ['Communications Officer', 'Social Media Manager', 'Country Lead', 'Desk Lead'];
const BENEFICIARY_ROLES = ['Database Officer', 'Country Lead', 'Desk Lead'];
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
addManagedRoutes({ path: '/ambassadors', Model: Ambassador, resource: 'ambassadors', roles: AMBASSADOR_ROLES, screen: 'network', filters: ['status', 'tier', 'country'] });
addManagedRoutes({ path: '/social-posts', Model: SocialPost, resource: 'social-posts', roles: SOCIAL_ROLES, screen: 'social', filters: ['platform'] });

adminApiRouter.post('/ambassadors/:id/amplifications', requireAdminOrStaffAuth, requirePortalRoles(...AMBASSADOR_ROLES), asyncHandler(async (req, res) => {
  const ambassador = await Ambassador.findById(validId(req.params.id, 'Ambassador'));
  if (!ambassador) throw notFound('Ambassador');
  const channel = String(req.body.channel || '').trim();
  if (!channel) throw new ApiError(400, 'channel is required');
  const amplification = await AmbassadorAmplification.create({ ambassadorId: ambassador._id, channel, note: req.body.note, loggedBy: req.auth.sub });
  await logActivity(req.auth.sub, 'logged amplification', 'ambassadors', ambassador);
  res.status(201).json({ data: toClientObject(amplification) });
}));

adminApiRouter.get('/beneficiaries', requireAdminOrStaffAuth, requirePortalRoles(...BENEFICIARY_ROLES), asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.sourceType) filter.sourceType = req.query.sourceType;
  if (req.query.verified !== undefined) filter.verified = req.query.verified === 'true';
  const { skip, limit } = pageOptions(req.query);
  const records = await Beneficiary.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  listResponse(res, records.map(toClientObject));
}));

const prepareBeneficiary = (body, existing = {}) => {
  const email = String(body.email ?? existing.email ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? existing.phone ?? '').trim();
  const sourceType = body.sourceType ?? existing.sourceType;
  const ambassadorId = body.ambassadorId ?? existing.ambassadorId;
  if (!email && !phone) throw new ApiError(400, 'email or phone is required');
  if (sourceType === 'ambassador-referral' && !ambassadorId) {
    throw new ApiError(400, 'ambassadorId is required for ambassador-referral records');
  }
  return { ...body, email: email || undefined, phone: phone || undefined, sourceType, ambassadorId };
};

const findDuplicateBeneficiary = ({ email, phone, existingId }) => {
  const identifiers = [email && { email }, phone && { phone }].filter(Boolean);
  const filter = { $or: identifiers };
  if (existingId) filter._id = { $ne: existingId };
  return Beneficiary.findOne(filter);
};

adminApiRouter.post('/beneficiaries', requireAdminOrStaffAuth, requirePortalRoles(...BENEFICIARY_ROLES), asyncHandler(async (req, res) => {
  const prepared = prepareBeneficiary(req.body);
  const existing = await findDuplicateBeneficiary(prepared);
  if (existing) throw new ApiError(409, 'A beneficiary with this email or phone already exists');
  const record = await Beneficiary.create({ ...prepared, addedBy: req.auth.sub });
  const sync = await syncManagedRecord('beneficiaries', record);
  await logActivity(req.auth.sub, 'created', 'beneficiaries', record);
  res.status(201).json({ data: { ...toClientObject(record), sync } });
}));

adminApiRouter.patch('/beneficiaries/:id', requireAdminOrStaffAuth, requirePortalRoles(...BENEFICIARY_ROLES), asyncHandler(async (req, res) => {
  const record = await Beneficiary.findById(validId(req.params.id, 'Beneficiary'));
  if (!record) throw notFound('Beneficiary');
  const prepared = prepareBeneficiary(req.body, record);
  const duplicate = await findDuplicateBeneficiary({ ...prepared, existingId: record._id });
  if (duplicate) throw new ApiError(409, 'A beneficiary with this email or phone already exists');
  Object.assign(record, prepared);
  await record.save();
  const sync = await syncManagedRecord('beneficiaries', record);
  await logActivity(req.auth.sub, 'updated', 'beneficiaries', record);
  itemResponse(res, { ...toClientObject(record), sync });
}));

adminApiRouter.post('/beneficiaries/:id/verify', requireAdminOrStaffAuth, requirePortalRoles(...BENEFICIARY_ROLES), asyncHandler(async (req, res) => {
  const record = await Beneficiary.findById(validId(req.params.id, 'Beneficiary'));
  if (!record) throw notFound('Beneficiary');
  record.verified = true;
  await record.save();
  const sync = await syncManagedRecord('beneficiaries', record);
  await logActivity(req.auth.sub, 'verified', 'beneficiaries', record);
  itemResponse(res, { ...toClientObject(record), sync });
}));

adminApiRouter.post('/beneficiaries/:id/retry-wordpress-sync', requireAdminOrStaffAuth, requirePortalRoles(...BENEFICIARY_ROLES), asyncHandler(async (req, res) => {
  const record = await Beneficiary.findById(validId(req.params.id, 'Beneficiary'));
  if (!record) throw notFound('Beneficiary');
  itemResponse(res, { ...toClientObject(record), sync: await syncManagedRecord('beneficiaries', record) });
}));

adminApiRouter.get('/social-posts/monthly-totals', requireAdminOrStaffAuth, requirePortalRoles(...SOCIAL_ROLES), asyncHandler(async (req, res) => {
  const { month, start, end } = monthBounds(req.query.month);
  const totals = await SocialPost.aggregate([
    { $match: { postedAt: { $gte: start, $lt: end } } },
    { $group: { _id: '$platform', posts: { $sum: 1 }, reach: { $sum: '$reach' }, engagement: { $sum: '$engagement' } } },
    { $sort: { _id: 1 } },
  ]);
  const team = totals.reduce((result, item) => ({ posts: result.posts + item.posts, reach: result.reach + item.reach, engagement: result.engagement + item.engagement }), { posts: 0, reach: 0, engagement: 0 });
  itemResponse(res, { month, team, platforms: totals.map((item) => ({ platform: item._id, ...item, _id: undefined })) });
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
    Ambassador.countDocuments({ status: 'active' }),
    Beneficiary.countDocuments({ verified: true }),
    Beneficiary.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    SocialPost.aggregate([{ $match: { postedAt: { $gte: start, $lt: end } } }, { $group: { _id: null, reach: { $sum: '$reach' }, engagement: { $sum: '$engagement' } } }]),
    OpportunityEngagement.countDocuments({ event: 'application', createdAt: { $gte: start, $lt: end } }),
  ]);
  return {
    opportunitiesPublished, programsActive, programsDelivered, partnersClosed, ambassadorsActive, beneficiariesVerified,
    beneficiariesAdded, socialReach: social[0]?.reach || 0, socialEngagement: social[0]?.engagement || 0, opportunityApplications: applications,
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
  const { start, end } = monthBounds(month);
  const [shares, signups, clicks] = await Promise.all([
    AmbassadorAmplification.aggregate([{ $match: { createdAt: { $gte: start, $lt: end } } }, { $group: { _id: '$ambassadorId', sharesLogged: { $sum: 1 } } }]),
    Beneficiary.aggregate([{ $match: { createdAt: { $gte: start, $lt: end }, verified: true, ambassadorId: { $ne: null } } }, { $group: { _id: '$ambassadorId', verifiedSignups: { $sum: 1 } } }]),
    OpportunityEngagement.aggregate([
      { $match: { event: 'view', ambassadorId: { $ne: null }, createdAt: { $gte: start, $lt: end } } },
      { $project: { ambassadorId: 1, identity: { $ifNull: ['$userId', '$visitorId'] } } },
      { $match: { identity: { $ne: null } } },
      { $group: { _id: { ambassadorId: '$ambassadorId', identity: '$identity' } } },
      { $group: { _id: '$_id.ambassadorId', distinctReferredClicks: { $sum: 1 } } },
    ]),
  ]);
  const shareMap = new Map(shares.map((item) => [String(item._id), item.sharesLogged]));
  const signupMap = new Map(signups.map((item) => [String(item._id), item.verifiedSignups]));
  const clickMap = new Map(clicks.map((item) => [String(item._id), item.distinctReferredClicks]));
  const ambassadors = await Ambassador.find({ status: 'active' });
  const entries = ambassadors.map((ambassador) => ({
    ambassador,
    sharesLogged: shareMap.get(String(ambassador._id)) || 0,
    distinctReferredClicks: clickMap.get(String(ambassador._id)) || 0,
    verifiedSignups: signupMap.get(String(ambassador._id)) || 0,
  }))
    .sort((a, b) => b.verifiedSignups - a.verifiedSignups || b.distinctReferredClicks - a.distinctReferredClicks || b.sharesLogged - a.sharesLogged)
    .map((entry, index) => ({ rank: index + 1, name: entry.ambassador.fullName, country: entry.ambassador.country, campus: entry.ambassador.campus, tier: entry.ambassador.tier, sharesLogged: entry.sharesLogged, distinctReferredClicks: entry.distinctReferredClicks, verifiedSignups: entry.verifiedSignups }));
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
    const social = await SocialPost.aggregate([{ $match: { createdBy: userId, postedAt: { $gte: start, $lt: end } } }, { $group: { _id: null, reach: { $sum: '$reach' } } }]);
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
  itemResponse(res, { month, kpis, priorities: kpis.filter((kpi) => kpi.target > 0), trend, pipeline, upcomingPrograms: upcomingPrograms.map(toClientObject), recentActivity: activities.map(toClientObject) });
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
    dashboardMetrics(month), partnerPipelineHealth(month), Ambassador.countDocuments({ status: 'active' }), SocialPost.aggregate([{ $match: { postedAt: { $gte: start, $lt: end } } }, { $group: { _id: null, reach: { $sum: '$reach' }, engagement: { $sum: '$engagement' } } }]),
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