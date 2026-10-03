import { Router } from 'express';
import mongoose from 'mongoose';
import { authRouter } from './auth.js';
import { uploadRouter } from './upload.js';
import { assistantRouter } from './assistant.js';
import { newsRouter } from './news.js';
import { adminApiRouter } from './admin-api.js';
import { asyncHandler, itemResponse, listResponse, notFound, stripSensitive, ApiError, parsePagination } from '../utils/http.js';
import { requireAuth, requireAdminAuth, optionalAuth } from '../middleware/auth.js';
import {
  RESOURCE_POLICIES,
  ADMIN,
  HIRER,
  SEEKER,
  isAllowed,
  buildCreatePayload,
  buildUpdatePayload,
  stripPiiIfNeeded,
} from '../lib/policies.js';
import { User, StaffMember } from '../models/User.js';
import { SeekerProfile, HirerAccount, Candidate } from '../models/Profiles.js';
import {
  Opportunity, Applicant, Event, Grant,
  GrantApplication, CompanyVerification, VerificationDoc, EventAttendee, opportunityTypes,
} from '../models/Platform.js';
import { Channel, ChannelPost, CommunityMembership, Report } from '../models/Community.js';
import { Article, Notification } from '../models/Content.js';
import { Ambassador, OpportunityEngagement, Testimonial } from '../models/AdminPortal.js';
import { auditReq, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../lib/audit.js';
import { searchLimiter } from '../lib/rate-limiters.js';

const parseJson = (value, fallback = []) => {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};

const stringifyArrayFields = (data, fields) => {
  const next = { ...data };
  for (const field of fields) {
    if (Array.isArray(next[field])) next[field] = JSON.stringify(next[field]);
  }
  return next;
};

const withParsedProfile = (profile) =>
  profile && {
    ...toClientObject(profile),
    technicalSkills: parseJson(profile.technicalSkills),
    softSkills: parseJson(profile.softSkills),
    tools: parseJson(profile.tools),
    certifications: parseJson(profile.certifications),
  };

const withParsedOpportunity = (opportunity) =>
  opportunity && {
    ...toClientObject(opportunity),
    experienceLevels: parseJson(opportunity.experienceLevels),
  };

const withParsedCandidate = (candidate) =>
  candidate && {
    ...toClientObject(candidate),
    skills: parseJson(candidate.skills),
  };

const toClientObject = (document) => {
  if (!document) return null;
  const value = document.toJSON ? document.toJSON() : document;
  // `stripSensitive` runs last so no caller can bypass the redaction (SEC-011/012).
  return stripSensitive({
    id: value.id || value._id?.toString(),
    ...value,
    _id: undefined,
    __v: undefined,
  });
};


/**
 * Throws 403 when the caller's role is not permitted for `action`.
 * `AUTHENTICATED` (any valid token) short-circuits to allowed.
 */
const assertPolicy = (policy, action, req, label = 'resource') => {
  if (!isAllowed(policy, action, req.auth?.role)) {
    const actionLabel = { read: 'view', create: 'create', update: 'update', delete: 'delete' }[action] || action;
    throw new ApiError(403, `You do not have permission to ${actionLabel} this ${label}`);
  }
};

/**
 * Express middleware pair for hand-written routes: authenticate, then authorize
 * against the same policy table the CRUD factory uses. `requireAuth` is always
 * first so an anonymous caller receives 401 (not 403) and cannot probe which
 * resources exist.
 */
const guard = (policyKey, action, label = 'resource') => {
  if (!RESOURCE_POLICIES[policyKey]) {
    throw new Error(`Missing authorization policy for "${policyKey}"`);
  }
  return [
  requireAuth,
  (req, res, next) => {
    try {
      assertPolicy(RESOURCE_POLICIES[policyKey], action, req, label);
      next();
    } catch (error) {
      next(error);
    }
  },
];
};

/** Reduce a hand-written route's body to its policy allowlist (SEC-007). */
const writableBody = (policyKey, req) => buildCreatePayload(RESOURCE_POLICIES[policyKey], req.body);

/**
 * Escape regex metacharacters before interpolating user input into a $regex.
 * Without this, a query like `a{999999}` is both a regex-injection vector and a
 * catastrophic-backtracking (ReDoS) denial of service against the search routes.
 */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build a case-insensitive escaped regex, or undefined for blank input. */
const searchPattern = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  return { $regex: escapeRegex(trimmed), $options: 'i' };
};

/** "a,b,c" -> escaped alternation. Returns undefined when the list is empty. */
const searchAlternation = (value) => {
  if (!value) return undefined;
  const terms = String(value)
    .split(',')
    .map((term) => escapeRegex(term.trim()))
    .filter(Boolean);
  return terms.length > 0 ? { $regex: terms.join('|'), $options: 'i' } : undefined;
};

/** AND a caller-scope filter onto a query filter without clobbering either's `$or`. */
const withScope = (filter, scope) =>
  scope && Object.keys(scope).length > 0 ? { $and: [scope, filter] } : filter;

/**
 * Enforce record-level ownership (SEC-002). A role policy answers "may this ROLE
 * write?"; it cannot answer "is this THEIR record?". Without this check any
 * authenticated user could PATCH or DELETE another user's seeker profile by id.
 *
 * Admins bypass ownership - they are the moderation surface. A document whose
 * owner field is missing fails closed rather than defaulting to allow.
 */
const assertOwnership = (document, ownerField, req, label) => {
  if (!ownerField) return;
  if (req.auth?.role === ADMIN) return;

  const owner = document?.[ownerField];
  if (!owner || String(owner) !== String(req.auth?.sub)) {
    throw new ApiError(403, `You do not have permission to modify this ${label}`);
  }
};

const collectionRoutes = ({
  Model,
  resourceName,
  policyKey,
  normalizeIn,
  normalizeOut,
  searchFields = [],
  ownerField = null,
  populate = null,
  enablePopulate = false,
  // GETs accept anonymous callers; every write still requires a token.
  publicRead = false,
  // Caller-specific read scope, e.g. "only vetted listings unless you are an admin".
  readScope = () => ({}),
  // Final per-caller projection, applied after PII stripping.
  redact = (item) => item,
  // Inspects the raw body before the allowlist runs; throws to reject the write outright.
  assertWritable = () => {},
}) => {
  const router = Router();
  const policy = RESOURCE_POLICIES[policyKey] || null;
  if (!policy) throw new Error(`Missing authorization policy for "${policyKey}"`);

  // SEC-002: nothing in a collection is readable without a valid token, unless the
  // resource is explicitly public-read - and even then writes still need one.
  router.use(publicRead
    ? (req, res, next) => (req.method === 'GET' ? optionalAuth : requireAuth)(req, res, next)
    : requireAuth);

  // SEC-023: strip PII fields for non-owners/non-admins
  const present = (item, req) => {
    const base = normalizeOut ? normalizeOut(item) : toClientObject(item);
    return redact(stripPiiIfNeeded(base, policyKey, req.auth, ownerField), req);
  };

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'read', req, resourceName);
      const { status, type, q } = req.query;
      
      // SEC-061: Reject object-valued query params to prevent NoSQL operator injection
      if (typeof status === 'object' || typeof type === 'object' || typeof q === 'object') {
        throw new ApiError(400, 'Invalid query parameters');
      }
      const { page, limit, skip } = parsePagination(req.query);
      const filter = {};

      if (status) {
        if (resourceName === 'Company verification') filter.overallStatus = status;
        else if (resourceName === 'Opportunity') filter.moderationStatus = status;
        else filter.status = status;
      }

      if (type && resourceName === 'Opportunity') filter.type = type;

      if (q) {
        // Escaped: `?q=a{999999}` would otherwise be a ReDoS payload.
        const pattern = searchPattern(q);
        if (pattern) {
          filter.$or = searchFields.map((field) => ({ [field]: pattern }));
        }
      }

      // SEC-026: for notifications, filter by authenticated user unless admin
      if (policyKey === 'notifications' && req.auth?.role !== ADMIN) {
        filter.userId = req.auth.sub;
      }

      const scoped = withScope(filter, readScope(req));
      const [data, total] = await Promise.all([
        Model.find(scoped).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Model.countDocuments(scoped),
      ]);

      listResponse(res, data.map((item) => present(item, req)), total, page, limit);
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'read', req, resourceName);
      let query = Model.findOne(withScope({ _id: req.params.id }, readScope(req)));
      if (enablePopulate && populate) {
        query = query.populate(populate);
      }
      const item = await query;
      if (!item) throw notFound(resourceName);

      itemResponse(res, present(item, req));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'create', req, resourceName);
      assertWritable(req.body, req);
      // SEC-007: the body is reduced to an explicit allowlist before it reaches the model.
      const allowed = buildCreatePayload(policy, req.body);
      // SEC-002: the owner is derived from the token, never from the body. Otherwise
      // a caller could create a seeker/hirer profile belonging to another user, or
      // post an opportunity under someone else's company.
      if (ownerField && req.auth?.role !== ADMIN) {
        allowed[ownerField] = req.auth.sub;
      }
      const data = normalizeIn ? normalizeIn(allowed) : allowed;
      const item = new Model(data);
      await item.save();

      // SEC-017: audit log for create
      await auditReq(req, {
        action: AUDIT_ACTIONS.ADMIN_USER_UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES[resourceName.toUpperCase().replace(/ /g, '_')] || resourceName.toLowerCase().replace(/ /g, '_'),
        resourceId: item._id,
        outcome: 'success',
        metadata: { role: req.auth?.role },
      });

      res.status(201).json({ data: normalizeOut ? normalizeOut(item) : toClientObject(item) });
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'update', req, resourceName);
      // Load first so ownership can be checked before anything is written.
      const existing = await Model.findById(req.params.id);
      if (!existing) throw notFound(resourceName);
      assertOwnership(existing, ownerField, req, resourceName);
      assertWritable(req.body, req);

      // SEC-007: unknown keys are dropped, admin-only keys only for admins.
      const allowed = buildUpdatePayload(policy, req.body, req.auth?.role);
      const data = normalizeIn ? normalizeIn(allowed) : allowed;
      const item = await Model.findByIdAndUpdate(
        req.params.id,
        data,
        { new: true, runValidators: true },
      );
      if (!item) throw notFound(resourceName);

      // SEC-017: audit log for admin mutations
      const isAdminMutation = req.auth?.role === ADMIN && policy.adminUpdateFields && Object.keys(data).some(k => policy.adminUpdateFields.includes(k));
      if (isAdminMutation) {
        await auditReq(req, {
          action: AUDIT_ACTIONS.ADMIN_USER_UPDATE,
          resourceType: AUDIT_RESOURCE_TYPES[resourceName.toUpperCase().replace(/ /g, '_')] || resourceName.toLowerCase().replace(/ /g, '_'),
          resourceId: item._id,
          outcome: 'success',
          metadata: { updatedFields: Object.keys(data), adminFields: Object.keys(data).filter(k => policy.adminUpdateFields?.includes(k)) },
        });
      }

      itemResponse(res, normalizeOut ? normalizeOut(item) : toClientObject(item));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'delete', req, resourceName);
      const existing = await Model.findById(req.params.id);
      if (!existing) throw notFound(resourceName);
      assertOwnership(existing, ownerField, req, resourceName);
      await Model.findByIdAndDelete(req.params.id);

      // SEC-017: audit log for delete
      await auditReq(req, {
        action: AUDIT_ACTIONS.ADMIN_DELETE,
        resourceType: AUDIT_RESOURCE_TYPES[resourceName.toUpperCase().replace(/ /g, '_')] || resourceName.toLowerCase().replace(/ /g, '_'),
        resourceId: req.params.id,
        outcome: 'success',
        metadata: { role: req.auth?.role },
      });

      res.status(204).send();
    }),
  );

  return router;
};

// --- Opportunities --------------------------------------------------------

const publicOpportunityFilter = () => ({ vetted: true, moderationStatus: { $in: ['published', 'approved'] } });

/**
 * Who sees which listings. Admins moderate everything; a hirer also sees their
 * own unpublished listings; everyone else - including anonymous website and
 * app visitors - sees only vetted, published listings.
 */
const opportunityReadScope = (req) => {
  if (req.auth?.role === ADMIN) return {};
  if (req.auth?.role === HIRER) {
    return { $or: [publicOpportunityFilter(), { hirerId: req.auth.sub }, { createdBy: req.auth.sub }] };
  }
  return publicOpportunityFilter();
};

/** Moderation and integration bookkeeping stays with administrators. */
const redactOpportunity = (opportunity, req) => {
  if (req.auth?.role === ADMIN) return opportunity;
  const { wordpressSync, assignedWriterId, vettedBy, vettedAt, ...visible } = opportunity;
  return visible;
};

/** Vetting and publishing go through the admin opportunity API, never the standard one. */
const assertOpportunityWritable = (body, req) => {
  if (req.auth?.role === ADMIN) return;
  if (body?.vetted === true || ['published', 'approved'].includes(body?.moderationStatus)) {
    throw new ApiError(403, 'Only the admin opportunity API can vet or publish an opportunity');
  }
};

const findReferringAmbassador = async (rawCode) => {
  const referralCode = String(rawCode || '').trim().toUpperCase();
  if (!referralCode) return { referralCode: undefined, ambassador: null };
  const ambassador = await Ambassador.findOne({ referralCode });
  if (!ambassador) throw new ApiError(400, 'Invalid referral code');
  return { referralCode, ambassador };
};

// --- Community ------------------------------------------------------------

const toId = (value) => value?.toString();

// A channel whose creator was deleted has `createdBy: null`; without the guards an
// anonymous caller (no `sub`) would match it as `undefined === undefined`.
const isChannelCreator = (channel, user) =>
  Boolean(user?.sub && channel.createdBy && toId(channel.createdBy) === user.sub);

const getChannelOrThrow = async (channelId) => {
  const channel = await Channel.findById(channelId);
  if (!channel) throw notFound('Channel');
  return channel;
};

const getCommunityUserOrThrow = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw new ApiError(400, 'A valid userId is required');
  const user = await User.findById(userId);
  if (!user) throw notFound('User');
  return user;
};

const getMembership = (channelId, userId) =>
  userId ? CommunityMembership.findOne({ channelId, userId }) : null;

const isLegacyMember = (channel, userId) =>
  (channel.memberIds || []).some((memberId) => toId(memberId) === userId);

const canAccessChannel = async (channel, user) => {
  if (channel.visibility === 'public' || user?.role === ADMIN || isChannelCreator(channel, user)) return true;
  const membership = await getMembership(channel._id, user?.sub);
  return membership?.status === 'active' || isLegacyMember(channel, user?.sub);
};

const canManageChannel = async (channel, user) => {
  if (user?.role === ADMIN || isChannelCreator(channel, user)) return true;
  const membership = await getMembership(channel._id, user?.sub);
  return membership?.status === 'active' && membership.role === 'admin';
};

const requireChannelAdmin = async (channel, user) => {
  if (!await canManageChannel(channel, user)) throw new ApiError(403, 'Only a community admin can manage this group');
};

const submitJoinRequest = async (channel, userId, body = {}) => {
  let membership = await getMembership(channel._id, userId);
  if (membership?.status === 'banned') throw new ApiError(403, 'This user is banned from this community');
  if (membership?.status === 'active') return { membership, accepted: true };
  if (!membership && isLegacyMember(channel, userId)) {
    membership = await CommunityMembership.create({ channelId: channel._id, userId, status: 'active' });
    return { membership, accepted: true };
  }
  const status = channel.visibility === 'private' || channel.requiresApproval ? 'pending' : 'active';
  if (!membership) membership = new CommunityMembership({ channelId: channel._id, userId });
  membership.status = status;
  membership.application = {
    message: String(body.message || '').trim(),
    answers: body.answers && typeof body.answers === 'object' ? body.answers : {},
  };
  membership.reviewedBy = null;
  membership.reviewedAt = null;
  membership.bannedReason = undefined;
  await membership.save();
  return { membership, accepted: status === 'active' };
};

const CHANNEL_POST_FIELDS = ['body', 'title', 'bannerImage', 'link', 'linkText', 'hasRespondButton', 'reactions'];
const CHANNEL_UPDATE_FIELDS = ['name', 'category', 'bio', 'avatar', 'visibility', 'status', 'requiresApproval'];

const publicTestimonial = (testimonial) => {
  const { email, ...visible } = toClientObject(testimonial);
  return visible;
};

/**
 * Build the API router. It is mounted twice by app.js - at /api/v1 with populate
 * and at the deprecated /api without - so every route lives here exactly once.
 * @param {Object} options - Configuration options
 * @param {boolean} options.enablePopulate - Whether to enable populate on single item endpoints (SEC-032)
 * @returns {Router} Express router with all API routes
 */
export const createApiRouter = ({ enablePopulate = false } = {}) => {
  const router = Router();

  router.use('/auth', authRouter);
  router.use('/upload', uploadRouter);
  router.use('/assistant', assistantRouter);
  router.use('/news', newsRouter);
  router.use('/admin', adminApiRouter);

  router.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState;
    const statusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    const isHealthy = dbStatus === 1;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'error',
      service: 'kredibble-backend',
      database: {
        status: statusMap[dbStatus] || 'unknown',
        connected: isHealthy,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // SEC-003: platform-wide counts are admin-only. `requireAdminAuth` validates the
  // admin cookie or header and enforces role=admin + audience=kredibble-admin.
  router.get('/dashboard/summary', requireAdminAuth, asyncHandler(async (req, res) => {
    const [
      pendingVerifications,
      pendingOpportunities,
      activeSeekers,
      activeHirers,
      openReports,
      totalUsers,
      totalSeekers,
      totalHirers,
      totalOpportunities,
      totalApplications,
      totalEvents,
      totalGrants,
      totalGrantApplications,
    ] = await Promise.all([
      CompanyVerification.countDocuments({ overallStatus: 'pending' }),
      Opportunity.countDocuments({ moderationStatus: 'pending' }),
      SeekerProfile.countDocuments({ status: 'active' }),
      HirerAccount.countDocuments({ status: 'active' }),
      Report.countDocuments({ status: 'open' }),
      User.countDocuments(),
      SeekerProfile.countDocuments(),
      HirerAccount.countDocuments(),
      Opportunity.countDocuments(),
      Applicant.countDocuments(),
      Event.countDocuments(),
      Grant.countDocuments(),
      GrantApplication.countDocuments(),
    ]);

    itemResponse(res, {
      // Keys read by the admin dashboard.
      pendingVerifications,
      pendingOpportunities,
      activeSeekers,
      activeHirers,
      openReports,
      totalUsers,
      totalOpportunities,
      // Totals added with API versioning (SEC-019).
      users: totalUsers,
      seekers: totalSeekers,
      hirers: totalHirers,
      opportunities: totalOpportunities,
      applications: totalApplications,
      events: totalEvents,
      grants: totalGrants,
      grantApplications: totalGrantApplications,
    });
  }));

  router.get('/opportunity-types', (req, res) => {
    itemResponse(res, opportunityTypes);
  });

  // The caller's own seeker or hirer profile, resolved from the token.
  router.get('/me/profile', requireAuth, asyncHandler(async (req, res) => {
    const isSeeker = req.auth.role === SEEKER;
    const Model = isSeeker ? SeekerProfile : req.auth.role === HIRER ? HirerAccount : null;
    if (!Model) throw new ApiError(404, 'Profile not found');
    const profile = await Model.findOne({ userId: req.auth.sub });
    if (!profile) throw notFound('Profile');
    itemResponse(res, isSeeker ? withParsedProfile(profile) : toClientObject(profile));
  }));

  router.patch('/me/profile', requireAuth, asyncHandler(async (req, res) => {
    const isSeeker = req.auth.role === SEEKER;
    const Model = isSeeker ? SeekerProfile : req.auth.role === HIRER ? HirerAccount : null;
    if (!Model) throw new ApiError(403, 'Only seeker and hirer accounts have editable profiles');
    // SEC-007: the same self-service allowlist as PATCH /seekers/:id and /hirers/:id.
    const updates = buildUpdatePayload(RESOURCE_POLICIES[isSeeker ? 'seekers' : 'hirers'], req.body, req.auth.role);
    const normalized = isSeeker ? stringifyArrayFields(updates, ['technicalSkills', 'softSkills', 'tools', 'certifications']) : updates;
    const profile = await Model.findOneAndUpdate({ userId: req.auth.sub }, normalized, { new: true, runValidators: true });
    if (!profile) throw notFound('Profile');
    itemResponse(res, isSeeker ? withParsedProfile(profile) : toClientObject(profile));
  }));

  // Only approved testimonials are public, and never with the submitter's email.
  router.get('/testimonials', asyncHandler(async (req, res) => {
    const testimonials = await Testimonial.find({ status: 'approved' }).sort({ createdAt: -1 });
    listResponse(res, testimonials.map(publicTestimonial));
  }));

  router.post('/testimonials', requireAuth, asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const comment = String(req.body.comment || '').trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !comment) throw new ApiError(400, 'name, a valid email, and comment are required');
    const testimonial = await Testimonial.create({ name, email, comment, photo: req.body.photo });
    res.status(201).json({ data: publicTestimonial(testimonial) });
  }));

  // Search routes (must be registered BEFORE collection routes to avoid /:id swallowing them)
  router.get('/candidates/search', searchLimiter, ...guard('candidates', 'read', 'candidate'), asyncHandler(async (req, res) => {
    const { skills, university, country, q } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};

    const query = searchPattern(q);
    if (query) filter.$or = [{ name: query }, { profession: query }];
    const location = searchPattern(country);
    if (location) filter.location = location;
    const school = searchPattern(university);
    if (school) filter.university = school;
    const skillMatch = searchAlternation(skills);
    if (skillMatch) filter.skills = skillMatch;

    const [data, total] = await Promise.all([
      Candidate.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Candidate.countDocuments(filter),
    ]);
    
    const mapped = data.map(item => stripPiiIfNeeded(withParsedCandidate(item), 'candidates', req.auth, 'userId'));
    listResponse(res, mapped, { page, limit, total });
  }));

  router.get('/seekers/search', searchLimiter, ...guard('seekers', 'read', 'seeker'), asyncHandler(async (req, res) => {
    const { skills, university, country, q } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};

    const query = searchPattern(q);
    if (query) filter.profession = query;
    const origin = searchPattern(country);
    if (origin) filter.country = origin;
    const school = searchPattern(university);
    if (school) filter.university = school;
    const skillMatch = searchAlternation(skills);
    if (skillMatch) filter.technicalSkills = skillMatch;

    const [data, total] = await Promise.all([
      SeekerProfile.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      SeekerProfile.countDocuments(filter),
    ]);
    
    const mapped = data.map(item => stripPiiIfNeeded(withParsedProfile(item), 'seekers', req.auth, 'userId'));
    listResponse(res, mapped, { page, limit, total });
  }));

  // Website and app view tracking, including ambassador referral attribution. Public
  // by design (the WordPress site reports anonymous visitors), so it is registered
  // before the /opportunities collection, whose router requires a token for writes.
  router.post('/opportunities/:opportunityId/views', optionalAuth, asyncHandler(async (req, res) => {
    const opportunity = await Opportunity.findById(req.params.opportunityId);
    if (!opportunity) throw notFound('Opportunity');
    const { referralCode, ambassador } = await findReferringAmbassador(req.body.referralCode);
    await OpportunityEngagement.create({
      opportunityId: opportunity._id,
      event: 'view',
      source: req.body.source === 'website' ? 'website' : 'app',
      userId: req.auth?.sub,
      ambassadorId: ambassador?._id,
      referralCode,
      visitorId: String(req.body.visitorId || '').trim() || undefined,
    });
    res.status(202).json({ data: { recorded: true } });
  }));

  // Community groups. Membership-aware routes are registered before the generic
  // /community/channels collection so they take precedence over its CRUD handlers.
  router.get('/community/channels', optionalAuth, asyncHandler(async (req, res) => {
    const membershipChannelIds = req.auth
      ? await CommunityMembership.find({ userId: req.auth.sub, status: 'active' }).distinct('channelId')
      : [];
    const visible = req.auth
      ? { $or: [{ visibility: 'public' }, { createdBy: req.auth.sub }, { memberIds: req.auth.sub }, { _id: { $in: membershipChannelIds } }] }
      : { visibility: 'public' };
    const clauses = [visible];
    if (req.query.visibility) clauses.push({ visibility: String(req.query.visibility) });
    const pattern = searchPattern(req.query.q);
    if (pattern) clauses.push({ $or: [{ name: pattern }, { category: pattern }] });
    const filter = clauses.length === 1 ? visible : { $and: clauses };

    const { page, limit, skip } = parsePagination(req.query);
    const [channels, total] = await Promise.all([
      Channel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Channel.countDocuments(filter),
    ]);
    listResponse(res, channels.map(toClientObject), total, page, limit);
  }));

  router.post('/community/channels', requireAuth, asyncHandler(async (req, res) => {
    const { visibility = 'public', bio, avatar } = req.body;
    const name = String(req.body.name || '').trim();
    const category = String(req.body.category || '').trim();
    if (!name || !category) throw new ApiError(400, 'name and category are required');
    if (!['public', 'private'].includes(visibility)) throw new ApiError(400, 'visibility must be public or private');
    const channel = await Channel.create({
      name,
      category,
      visibility,
      bio,
      avatar,
      createdBy: req.auth.sub,
      requiresApproval: typeof req.body.requiresApproval === 'boolean' ? req.body.requiresApproval : visibility === 'private',
    });
    await CommunityMembership.create({ channelId: channel._id, userId: req.auth.sub, role: 'admin', status: 'active' });

    await auditReq(req, {
      action: AUDIT_ACTIONS.ADMIN_USER_UPDATE,
      resourceType: AUDIT_RESOURCE_TYPES.COMMUNITY_CHANNEL,
      resourceId: channel._id,
      outcome: 'success',
      metadata: { visibility },
    });

    res.status(201).json({ data: toClientObject(channel) });
  }));

  router.get('/community/channels/:channelId', optionalAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    if (!await canAccessChannel(channel, req.auth)) throw new ApiError(403, 'You do not have access to this private group');
    itemResponse(res, toClientObject(channel));
  }));

  router.patch('/community/channels/:channelId', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await requireChannelAdmin(channel, req.auth);
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => CHANNEL_UPDATE_FIELDS.includes(key)));
    if (updates.visibility && !['public', 'private'].includes(updates.visibility)) throw new ApiError(400, 'visibility must be public or private');
    Object.assign(channel, updates);
    await channel.save();
    itemResponse(res, toClientObject(channel));
  }));

  router.post('/community/channels/:channelId/join-requests', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    const result = await submitJoinRequest(channel, req.auth.sub, req.body);
    res.status(result.accepted ? 201 : 202).json({ data: { membership: toClientObject(result.membership), accepted: result.accepted } });
  }));

  router.get('/community/channels/:channelId/join-requests', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await requireChannelAdmin(channel, req.auth);
    const status = String(req.query.status || 'pending');
    const memberships = await CommunityMembership.find({ channelId: channel._id, status }).populate('userId', 'name email avatarUrl');
    listResponse(res, memberships.map(toClientObject));
  }));

  router.post('/community/channels/:channelId/members', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await requireChannelAdmin(channel, req.auth);
    const userId = String(req.body.userId || '');
    await getCommunityUserOrThrow(userId);
    if (toId(channel.createdBy) === userId && req.body.role !== 'admin') throw new ApiError(400, 'The group creator must remain an admin');
    const membership = await CommunityMembership.findOneAndUpdate(
      { channelId: channel._id, userId },
      { $set: { status: 'active', role: req.body.role === 'admin' ? 'admin' : 'member', reviewedBy: req.auth.sub, reviewedAt: new Date(), bannedReason: undefined } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    itemResponse(res, toClientObject(membership));
  }));

  router.post('/community/channels/:channelId/members/:userId/accept', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await requireChannelAdmin(channel, req.auth);
    const membership = await CommunityMembership.findOne({ channelId: channel._id, userId: req.params.userId });
    if (!membership || membership.status !== 'pending') throw new ApiError(404, 'Pending join request not found');
    membership.status = 'active';
    membership.role = req.body.role === 'admin' ? 'admin' : 'member';
    membership.reviewedBy = req.auth.sub;
    membership.reviewedAt = new Date();
    await membership.save();
    itemResponse(res, toClientObject(membership));
  }));

  router.delete('/community/channels/:channelId/members/:userId', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await requireChannelAdmin(channel, req.auth);
    if (toId(channel.createdBy) === req.params.userId) throw new ApiError(400, 'The group creator cannot be removed');
    const membership = await CommunityMembership.findOneAndUpdate(
      { channelId: channel._id, userId: req.params.userId },
      { $set: { status: 'removed', reviewedBy: req.auth.sub, reviewedAt: new Date() } },
      { new: true },
    );
    if (!membership) throw notFound('Community member');
    itemResponse(res, toClientObject(membership));
  }));

  router.post('/community/channels/:channelId/members/:userId/ban', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await requireChannelAdmin(channel, req.auth);
    if (toId(channel.createdBy) === req.params.userId) throw new ApiError(400, 'The group creator cannot be banned');
    await getCommunityUserOrThrow(req.params.userId);
    const membership = await CommunityMembership.findOneAndUpdate(
      { channelId: channel._id, userId: req.params.userId },
      { $set: { status: 'banned', reviewedBy: req.auth.sub, reviewedAt: new Date(), bannedReason: String(req.body.reason || '').trim() || undefined } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    itemResponse(res, toClientObject(membership));
  }));

  router.post('/community/channels/:channelId/members/:userId/unban', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await requireChannelAdmin(channel, req.auth);
    const membership = await CommunityMembership.findOneAndUpdate(
      { channelId: channel._id, userId: req.params.userId, status: 'banned' },
      { $set: { status: 'removed', reviewedBy: req.auth.sub, reviewedAt: new Date(), bannedReason: undefined } },
      { new: true },
    );
    if (!membership) throw new ApiError(404, 'Banned community member not found');
    itemResponse(res, toClientObject(membership));
  }));

  router.get('/community/channels/:channelId/posts', optionalAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    if (!await canAccessChannel(channel, req.auth)) throw new ApiError(403, 'You do not have access to this private group');
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { channelId: channel._id };
    const [posts, total] = await Promise.all([
      ChannelPost.find(filter).sort({ pinnedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
      ChannelPost.countDocuments(filter),
    ]);
    listResponse(res, posts.map(toClientObject), total, page, limit);
  }));

  router.post('/community/channels/:channelId/posts', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    if (!await canAccessChannel(channel, req.auth)) throw new ApiError(403, 'You do not have access to this private group');
    const author = await User.findById(req.auth.sub);
    // SEC-007: author identity comes from the token; only content fields come from the body.
    const post = new ChannelPost({
      ...Object.fromEntries(Object.entries(req.body).filter(([key]) => CHANNEL_POST_FIELDS.includes(key))),
      channelId: channel._id,
      authorId: req.auth.sub,
      authorName: author?.name || 'Community member',
    });
    await post.save();
    await Channel.findByIdAndUpdate(channel._id, { $inc: { postsCount: 1 } });

    await auditReq(req, {
      action: AUDIT_ACTIONS.ADMIN_USER_UPDATE,
      resourceType: AUDIT_RESOURCE_TYPES.COMMUNITY_POST,
      resourceId: post._id,
      outcome: 'success',
      metadata: { channelId: String(channel._id) },
    });

    res.status(201).json({ data: toClientObject(post) });
  }));

  router.put('/community/channels/:channelId/posts/:postId/pin', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await requireChannelAdmin(channel, req.auth);
    const post = await ChannelPost.findOne({ _id: req.params.postId, channelId: channel._id });
    if (!post) throw notFound('Channel post');
    if (channel.pinnedPostId && toId(channel.pinnedPostId) !== toId(post._id)) {
      await ChannelPost.findByIdAndUpdate(channel.pinnedPostId, { pinnedAt: null, pinnedBy: null });
    }
    post.pinnedAt = new Date();
    post.pinnedBy = req.auth.sub;
    channel.pinnedPostId = post._id;
    await Promise.all([post.save(), channel.save()]);
    itemResponse(res, { channel: toClientObject(channel), post: toClientObject(post) });
  }));

  router.delete('/community/channels/:channelId/posts/:postId/pin', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await requireChannelAdmin(channel, req.auth);
    if (toId(channel.pinnedPostId) !== req.params.postId) throw new ApiError(400, 'This message is not pinned');
    const post = await ChannelPost.findOne({ _id: req.params.postId, channelId: channel._id });
    if (!post) throw notFound('Channel post');
    channel.pinnedPostId = null;
    post.pinnedAt = null;
    post.pinnedBy = null;
    await Promise.all([post.save(), channel.save()]);
    itemResponse(res, { channel: toClientObject(channel), post: toClientObject(post) });
  }));

  // Collection routes with populate option
  router.use('/users', collectionRoutes({ Model: User, resourceName: 'User', policyKey: 'users', searchFields: ['name', 'email'], enablePopulate }));
  router.use('/staff', collectionRoutes({ Model: StaffMember, resourceName: 'Staff', policyKey: 'staff', searchFields: ['name', 'email'], enablePopulate }));
  router.use('/seekers', collectionRoutes({
    Model: SeekerProfile,
    resourceName: 'Seeker',
    policyKey: 'seekers',
    normalizeIn: (data) => stringifyArrayFields(data, ['technicalSkills', 'softSkills', 'tools', 'certifications']),
    normalizeOut: withParsedProfile,
    searchFields: ['profession', 'university', 'country'],
    ownerField: 'userId',
    populate: { path: 'userId', select: 'name avatarUrl' },
    enablePopulate,
  }));
  router.use('/hirers', collectionRoutes({ Model: HirerAccount, resourceName: 'Hirer', policyKey: 'hirers', searchFields: ['companyName', 'industry'], ownerField: 'userId', populate: { path: 'userId', select: 'name avatarUrl' }, enablePopulate }));
  router.use('/opportunities', collectionRoutes({
    Model: Opportunity,
    resourceName: 'Opportunity',
    policyKey: 'opportunities',
    normalizeIn: (data) => stringifyArrayFields(data, ['experienceLevels']),
    normalizeOut: withParsedOpportunity,
    searchFields: ['title', 'company', 'location'],
    ownerField: 'hirerId',
    populate: { path: 'hirerId', select: 'companyName tagline logo industry location' },
    enablePopulate,
    publicRead: true,
    readScope: opportunityReadScope,
    redact: redactOpportunity,
    assertWritable: assertOpportunityWritable,
  }));
  router.use('/candidates', collectionRoutes({
    Model: Candidate,
    resourceName: 'Candidate',
    policyKey: 'candidates',
    normalizeIn: (data) => stringifyArrayFields(data, ['skills']),
    normalizeOut: withParsedCandidate,
    searchFields: ['name', 'profession'],
    enablePopulate,
  }));
  router.use('/community/channels', collectionRoutes({ Model: Channel, resourceName: 'Channel', policyKey: 'community/channels', searchFields: ['name', 'category'], ownerField: 'createdBy', enablePopulate }));
  router.use('/reports', collectionRoutes({ Model: Report, resourceName: 'Report', policyKey: 'reports', searchFields: ['reason', 'details'], enablePopulate }));
  router.use('/events', collectionRoutes({ Model: Event, resourceName: 'Event', policyKey: 'events', searchFields: ['title', 'location'], ownerField: 'createdBy', enablePopulate }));
  router.use('/grants', collectionRoutes({ Model: Grant, resourceName: 'Grant', policyKey: 'grants', searchFields: ['title', 'sector'], enablePopulate }));
  router.use('/articles', collectionRoutes({ Model: Article, resourceName: 'Article', policyKey: 'articles', searchFields: ['title', 'category'], enablePopulate }));
  router.use('/notifications', collectionRoutes({ Model: Notification, resourceName: 'Notification', policyKey: 'notifications', searchFields: ['title', 'message'], enablePopulate }));
  router.use('/verification/companies', collectionRoutes({ Model: CompanyVerification, resourceName: 'Company verification', policyKey: 'verification/companies', searchFields: ['name', 'industry'], ownerField: 'hirerId', enablePopulate }));

  // Special nested routes
  router.post('/opportunities/:opportunityId/applicants', ...guard('applicants', 'create', 'applicant'), asyncHandler(async (req, res) => {
    // Applications are only accepted for listings this caller can see.
    const opportunity = await Opportunity.findOne(withScope({ _id: req.params.opportunityId }, opportunityReadScope(req)));
    if (!opportunity) throw notFound('Opportunity');
    const { referralCode, ambassador } = opportunity.referralCodeOnApply
      ? await findReferringAmbassador(req.body.referralCode)
      : { referralCode: undefined, ambassador: null };

    // SEC-056: Force seekerId from token; unique index handles duplicate applications
    const existing = await Applicant.findOne({ opportunityId: opportunity._id, seekerId: req.auth.sub });
    if (existing) throw new ApiError(409, 'You have already applied for this opportunity');

    const applicant = new Applicant(
      stringifyArrayFields(buildCreatePayload(RESOURCE_POLICIES.applicants, req.body), ['skills']),
    );
    applicant.set('opportunityId', opportunity._id);
    applicant.set('seekerId', req.auth.sub);
    
    if (ambassador) {
      applicant.set('referralCode', referralCode);
      applicant.set('ambassadorId', ambassador._id);
    }
    await applicant.save();
    await Opportunity.findByIdAndUpdate(opportunity._id, { $inc: { applicantsCount: 1 } });
    await OpportunityEngagement.create({
      opportunityId: opportunity._id,
      event: 'application',
      source: 'app',
      userId: req.auth.sub,
      ambassadorId: ambassador?._id,
      referralCode,
    });

    await auditReq(req, {
      action: AUDIT_ACTIONS.APPLICATION_SUBMIT,
      resourceType: AUDIT_RESOURCE_TYPES.APPLICANT,
      resourceId: applicant._id,
      outcome: 'success',
      metadata: { opportunityId: String(opportunity._id), referred: Boolean(ambassador) },
    });

    res.status(201).json({ data: toClientObject(applicant) });
  }));

  router.get('/opportunities/:opportunityId/applicants', ...guard('applicants', 'read', 'applicant'), asyncHandler(async (req, res) => {
    const opportunity = await Opportunity.findById(req.params.opportunityId);
    if (!opportunity) throw notFound('Opportunity');
    if (req.auth.role !== ADMIN && String(opportunity.createdBy) !== req.auth.sub) {
      throw new ApiError(403, 'You do not have permission to view applicants for this opportunity');
    }

    const { page, limit, skip } = parsePagination(req.query);
    const filter = { opportunityId: req.params.opportunityId };
    const [data, total] = await Promise.all([
      Applicant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Applicant.countDocuments(filter),
    ]);
    listResponse(res, data.map(toClientObject), total, page, limit);
  }));

  router.post('/grants/:grantId/applications', ...guard('grant-applications', 'create', 'grantApplication'), asyncHandler(async (req, res) => {
    const application = new GrantApplication(buildCreatePayload(RESOURCE_POLICIES['grant-applications'], req.body));
    application.set('grantId', req.params.grantId);
    await application.save();
    await auditReq(req, {
      action: AUDIT_ACTIONS.GRANT_APPLY,
      resourceType: AUDIT_RESOURCE_TYPES.GRANT_APPLICATION,
      resourceId: application._id,
      outcome: 'success',
    });
    res.status(201).json({ data: toClientObject(application) });
  }));

  router.get('/grants/:grantId/applications', ...guard('grant-applications', 'read', 'grantApplication'), asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { grantId: req.params.grantId };
    const [data, total] = await Promise.all([
      GrantApplication.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      GrantApplication.countDocuments(filter),
    ]);
    listResponse(res, data.map(toClientObject), total, page, limit);
  }));

  router.post('/verification/companies/:companyId/documents', ...guard('verification/documents', 'create', 'document'), asyncHandler(async (req, res) => {
    // SEC-058: Verify companyId belongs to the caller
    if (req.auth.role !== ADMIN && String(req.params.companyId) !== req.auth.sub) {
      throw new ApiError(403, 'You do not have permission to attach documents to this company');
    }

    const doc = new VerificationDoc(buildCreatePayload(RESOURCE_POLICIES['verification/documents'], req.body));
    doc.set('companyId', req.params.companyId);
    await doc.save();
    await auditReq(req, {
      action: AUDIT_ACTIONS.UPLOAD,
      resourceType: AUDIT_RESOURCE_TYPES.VERIFICATION_DOC,
      resourceId: doc._id,
      outcome: 'success',
      metadata: { companyId: req.params.companyId },
    });
    res.status(201).json({ data: toClientObject(doc) });
  }));

  router.get('/verification/companies/:companyId/documents', ...guard('verification/documents', 'read', 'document'), asyncHandler(async (req, res) => {
    // SEC-058: Verify companyId belongs to the caller
    if (req.auth.role !== ADMIN && String(req.params.companyId) !== req.auth.sub) {
      throw new ApiError(403, 'You do not have permission to view documents for this company');
    }

    const docs = await VerificationDoc.find({ companyId: req.params.companyId }).sort({ createdAt: -1 });
    listResponse(res, docs.map(toClientObject));
  }));

  // Provide basic CRUD for these nested resources so they can be read, updated, or deleted directly by ID
  // SEC-056: Explicit applicant routes with ownership checks (Seeker owns applicant, Hirer owns opportunity)
  const verifyApplicantAccess = async (req, applicantId) => {
    const applicant = await Applicant.findById(applicantId);
    if (!applicant) throw notFound('Applicant');
    if (req.auth.role === ADMIN) return applicant;

    const opportunity = await Opportunity.findById(applicant.opportunityId);
    if (!opportunity) throw notFound('Opportunity');

    if (req.auth.role === SEEKER && String(applicant.seekerId) === req.auth.sub) return applicant;
    if (req.auth.role === HIRER && String(opportunity.createdBy) === req.auth.sub) return applicant;
    
    throw new ApiError(403, 'Insufficient permissions to access this applicant');
  };

  router.get('/applicants/:id', requireAuth, asyncHandler(async (req, res) => {
    const applicant = await verifyApplicantAccess(req, req.params.id);
    itemResponse(res, toClientObject(applicant));
  }));

  router.patch('/applicants/:id', requireAuth, asyncHandler(async (req, res) => {
    const applicant = await verifyApplicantAccess(req, req.params.id);
    // SEC-056: Hirers can update status; Seekers can't update status, but can update resume
    const updates = buildUpdatePayload(RESOURCE_POLICIES.applicants, req.body, req.auth.role);
    Object.assign(applicant, updates);
    await applicant.save();
    itemResponse(res, toClientObject(applicant));
  }));

  router.delete('/applicants/:id', requireAuth, asyncHandler(async (req, res) => {
    const applicant = await verifyApplicantAccess(req, req.params.id);
    await applicant.deleteOne();
    await Opportunity.findByIdAndUpdate(applicant.opportunityId, { $inc: { applicantsCount: -1 } });
    res.status(204).end();
  }));

  router.use('/grant-applications', collectionRoutes({ Model: GrantApplication, resourceName: 'GrantApplication', policyKey: 'grant-applications', enablePopulate }));
  router.use('/verification/documents', collectionRoutes({ Model: VerificationDoc, resourceName: 'VerificationDoc', policyKey: 'verification/documents', ownerField: 'companyId', enablePopulate }));
  router.use('/community/posts', collectionRoutes({ Model: ChannelPost, resourceName: 'ChannelPost', policyKey: 'community/posts', ownerField: 'authorId', enablePopulate }));

  /**
   * Saved items are private to their owner (SEC-026). The path is `/users/me/saved`
   * so the user ID always comes from the token; there is no `/users/:id/saved`
   * through which one user could address another's list.
   */
  router.post('/users/me/saved', ...guard('saved-items', 'create', 'savedItem'), asyncHandler(async (req, res) => {
    const { SavedItem } = await import('../models/User.js');
    const { itemId, itemType } = req.body;
    if (!itemId || !['opportunities', 'events', 'grants', 'internships'].includes(itemType)) {
      throw new ApiError(400, 'A valid itemId and itemType are required');
    }
    const userId = req.auth.sub;
    const existing = await SavedItem.findOne({ userId, itemId, itemType });
    if (existing) {
      await existing.deleteOne();

      await auditReq(req, {
        action: AUDIT_ACTIONS.SAVED_ITEM_TOGGLE,
        resourceType: AUDIT_RESOURCE_TYPES.SAVED_ITEM,
        resourceId: existing._id,
        outcome: 'success',
        metadata: { action: 'removed', itemId, itemType },
      });

      res.json({ action: 'removed' });
    } else {
      const newItem = new SavedItem({ userId, itemId, itemType });
      await newItem.save();

      await auditReq(req, {
        action: AUDIT_ACTIONS.SAVED_ITEM_TOGGLE,
        resourceType: AUDIT_RESOURCE_TYPES.SAVED_ITEM,
        resourceId: newItem._id,
        outcome: 'success',
        metadata: { action: 'added', itemId, itemType },
      });

      res.status(201).json({ action: 'added', data: toClientObject(newItem) });
    }
  }));

  router.get('/users/me/saved', ...guard('saved-items', 'read', 'savedItem'), asyncHandler(async (req, res) => {
    const { SavedItem } = await import('../models/User.js');
    const savedItems = await SavedItem.find({ userId: req.auth.sub }).sort({ createdAt: -1 });
    listResponse(res, savedItems.map(toClientObject));
  }));

  // Event attendees
  router.post('/events/:eventId/attendees', ...guard('event-attendees', 'create', 'booking'), asyncHandler(async (req, res) => {
    const body = writableBody('event-attendees', req);
    const quantity = Math.min(Math.max(Number.parseInt(body.quantity, 10) || 1, 1), 10);
    
    // SEC-059: Atomic $expr capacity guard
    const event = await Event.findOneAndUpdate(
      { 
        _id: req.params.eventId,
        $expr: { $lte: [{ $add: ['$attendeesCount', quantity] }, '$capacity'] }
      },
      { $inc: { attendeesCount: quantity } },
      { new: true }
    );
    
    if (!event) {
      // Differentiate between event not found and full
      const exists = await Event.exists({ _id: req.params.eventId });
      if (!exists) throw notFound('Event');
      throw new ApiError(400, 'Event has reached capacity');
    }

    const attendee = new EventAttendee({ ...body, quantity });
    attendee.set('eventId', req.params.eventId);
    await attendee.save();

    await auditReq(req, {
      action: AUDIT_ACTIONS.EVENT_BOOK,
      resourceType: AUDIT_RESOURCE_TYPES.EVENT_ATTENDEE,
      resourceId: attendee._id,
      outcome: 'success',
      metadata: { eventId: req.params.eventId, quantity },
    });

    res.status(201).json({ data: toClientObject(attendee) });
  }));

  router.get('/events/:eventId/attendees', ...guard('event-attendees', 'read', 'attendee'), asyncHandler(async (req, res) => {
    // SEC-059: Enforce event ownership
    const event = await Event.findById(req.params.eventId);
    if (!event) throw notFound('Event');
    if (req.auth.role !== ADMIN && String(event.createdBy) !== req.auth.sub) {
      throw new ApiError(403, 'You do not have permission to view attendees for this event');
    }

    const attendees = await EventAttendee.find({ eventId: req.params.eventId }).sort({ createdAt: -1 });
    listResponse(res, attendees.map(toClientObject));
  }));

  return router;
};
