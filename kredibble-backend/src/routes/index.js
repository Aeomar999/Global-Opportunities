import { Router } from 'express';
import mongoose from 'mongoose';
import { authRouter } from './auth.js';
import { uploadRouter, createUploadRouter, IMAGE_MIME_TYPES } from './upload.js';
import { assistantRouter } from './assistant.js';
import { newsRouter } from './news.js';
import { adminApiRouter } from './admin-api.js';
import { ambassadorRouter } from './ambassador.js';
import { asyncHandler, itemResponse, listResponse, notFound, stripSensitive, ApiError, parsePagination } from '../utils/http.js';
import { requireAuth, requireAdminAuth, optionalAuth, requireEmailVerified } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { validate } from '../middleware/validate.js';
import { staffInviteSchema } from '../schemas/admin.js';
import { pushTokenSchema } from '../schemas/auth.js';
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
import { Ambassador, AmbassadorRequest, OpportunityEngagement, Testimonial, Beneficiary } from '../models/AdminPortal.js';
import { auditReq, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../lib/audit.js';
import { searchLimiter, chatLimiter } from '../lib/rate-limiters.js';
import { normalizeLegacyRole } from '../lib/permissions.js';
import { postChannelMessage, listChannelMessages, getThread, findPost } from '../lib/chat.js';
import { evictFromChannelRoom } from '../socket.js';
import { chatMessageSchema } from '../schemas/ambassador.js';

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

  if (label === 'Opportunity') {
    const isOwner = (document.createdBy && String(document.createdBy) === String(req.auth?.sub)) ||
                    (document.hirerId && String(document.hirerId) === String(req.auth?.sub));
    if (!isOwner) {
      throw new ApiError(403, `You do not have permission to modify this ${label}`);
    }
    return;
  }

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
  // Replaces the default token check (e.g. requireAdminAuth for the admin dashboard's mounts).
  authenticate = null,
  // Query params that filter the list by exact value; "true"/"false" become booleans.
  filterFields = [],
  // async (pattern) => Mongo filter for `?q=`; replaces the `searchFields` $or.
  searchFilter = null,
  // Populate list and single reads, whatever `enablePopulate` says.
  populateAlways = false,
  // async (items, req) => items; runs on presented items for GET / and GET /:id.
  decorate = null,
}) => {
  const router = Router();
  const policy = RESOURCE_POLICIES[policyKey] || null;
  if (!policy) throw new Error(`Missing authorization policy for "${policyKey}"`);

  // SEC-002: nothing in a collection is readable without a valid token, unless the
  // resource is explicitly public-read - and even then writes still need one.
  router.use(authenticate || (publicRead
    ? (req, res, next) => (req.method === 'GET' ? optionalAuth : requireAuth)(req, res, next)
    : requireAuth));

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

      for (const field of filterFields) {
        const value = req.query[field];
        if (value === undefined) continue;
        // SEC-061: a filter value is a plain string, never an operator object.
        if (typeof value !== 'string') throw new ApiError(400, 'Invalid query parameters');
        filter[field] = value === 'true' ? true : value === 'false' ? false : value;
      }

      if (q) {
        // Escaped: `?q=a{999999}` would otherwise be a ReDoS payload.
        const pattern = searchPattern(q);
        if (pattern && searchFilter) {
          Object.assign(filter, await searchFilter(pattern));
        } else if (pattern && searchFields.length) {
          filter.$or = searchFields.map((field) => ({ [field]: pattern }));
        }
      }

      const scoped = withScope(filter, await readScope(req));
      let listQuery = Model.find(scoped).sort({ createdAt: -1 }).skip(skip).limit(limit);
      if (populateAlways && populate) listQuery = listQuery.populate(populate);
      const [data, total] = await Promise.all([listQuery, Model.countDocuments(scoped)]);

      let items = data.map((item) => present(item, req));
      if (decorate) items = await decorate(items, req);
      listResponse(res, items, total, page, limit);
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'read', req, resourceName);
      let query = Model.findOne(withScope({ _id: req.params.id }, await readScope(req)));
      if ((enablePopulate || populateAlways) && populate) {
        query = query.populate(populate);
      }
      const item = await query;
      if (!item) throw notFound(resourceName);

      let presented = present(item, req);
      if (decorate) [presented] = await decorate([presented], req);
      itemResponse(res, presented);
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'create', req, resourceName);
      await assertWritable(req.body, req);
      // SEC-007: the body is reduced to an explicit allowlist before it reaches the model.
      const allowed = buildCreatePayload(policy, req.body);
      // SEC-002: the owner is derived from the token, never from the body. Otherwise
      // a caller could create a seeker/hirer profile belonging to another user, or
      // post an opportunity under someone else's company.
      if (ownerField && req.auth?.role !== ADMIN) {
        allowed[ownerField] = req.auth.sub;
      }
      if (resourceName === 'Opportunity' && req.auth?.role !== ADMIN) {
        allowed.createdBy = req.auth.sub;
        if (!allowed.hirerId) {
          const hirerAccount = await HirerAccount.findOne({ userId: req.auth.sub }).select('_id').lean();
          if (hirerAccount) {
            allowed.hirerId = hirerAccount._id;
          }
        }
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
      await assertWritable(req.body, req);

      // SEC-007: unknown keys are dropped, admin-only keys only for admins.
      const allowed = buildUpdatePayload(policy, req.body, req.auth?.role);
      const data = normalizeIn ? normalizeIn(allowed) : allowed;
      const item = await Model.findByIdAndUpdate(
        req.params.id,
        data,
        { new: true, runValidators: true },
      );
      if (!item) throw notFound(resourceName);

      // SEC-017 / SEC-077: every admin update is audited, not only admin-only fields
      // (a report decision or a staff role change touches ordinary fields).
      if (req.auth?.role === ADMIN) {
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
const assertOpportunityWritable = async (body, req) => {
  if (req.auth?.role === ADMIN) return;
  if (body?.vetted === true || ['published', 'approved'].includes(body?.moderationStatus)) {
    throw new ApiError(403, 'Only the admin opportunity API can vet or publish an opportunity');
  }
  // SEC-062 / Q9: Enforce email verification on opportunity creation
  if (req.method === 'POST' && (!env.isTest || process.env.REQUIRE_EMAIL_VERIFICATION === 'true')) {
    const user = await User.findById(req.auth?.sub).select('emailVerified').lean();
    if (!user?.emailVerified) {
      const error = new ApiError(403, 'Email verification is required to create an opportunity');
      error.code = 'EMAIL_VERIFICATION_REQUIRED';
      throw error;
    }
  }
};

/** SEC-062 / Q9: Enforce email verification on company verification registration */
const assertVerificationCompanyWritable = async (body, req) => {
  if (req.auth?.role === ADMIN) return;
  if (req.method === 'POST' && (!env.isTest || process.env.REQUIRE_EMAIL_VERIFICATION === 'true')) {
    const user = await User.findById(req.auth?.sub).select('emailVerified').lean();
    if (!user?.emailVerified) {
      const error = new ApiError(403, 'Email verification is required to register a company verification');
      error.code = 'EMAIL_VERIFICATION_REQUIRED';
      throw error;
    }
  }
};

/**
 * Q3: Events public read scope — non-admins see non-cancelled events.
 */
const eventReadScope = (req) => {
  if (req.auth?.role === ADMIN) return {};
  return { status: { $ne: 'cancelled' } };
};

/**
 * Q3: Articles public read scope — non-admins see published articles.
 */
const articleReadScope = (req) => {
  if (req.auth?.role === ADMIN) return {};
  return { status: 'published' };
};

const findReferringAmbassador = async (rawCode) => {
  const referralCode = String(rawCode || '').trim().toUpperCase();
  if (!referralCode) return { referralCode: undefined, ambassador: null };
  const ambassador = await Ambassador.findOne({ referralCode });
  if (!ambassador) throw new ApiError(400, 'Invalid referral code');
  return { referralCode, ambassador };
};

/**
 * SEC-044: Notifications are targeted by audience; non-admins see only matching and active notifications.
 */
const notificationReadScope = (req) => {
  if (req.auth?.role === ADMIN) return {};
  const allowedAudiences = ['all', 'both'];
  if (req.auth?.role === SEEKER) {
    allowedAudiences.push('seekers', 'seeker');
  } else if (req.auth?.role === HIRER) {
    allowedAudiences.push('hirers', 'hirer');
  }
  // A person sees broadcasts for their audience plus anything addressed to them personally.
  return {
    isActive: { $ne: false },
    $or: [
      { audience: { $in: allowedAudiences } },
      ...(req.auth?.sub ? [{ userId: req.auth.sub }] : []),
    ],
  };
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
  Boolean(userId) && (channel.memberIds || []).some((memberId) => Boolean(memberId) && toId(memberId) === String(userId));

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

/** SEC-077: a channel an admin removed is gone for everyone else, owner included. */
const assertChannelVisible = (channel, user) => {
  if (channel.status === 'removed' && user?.role !== ADMIN) throw notFound('Channel');
};

const requireChannelAdmin = async (channel, user) => {
  if (!await canManageChannel(channel, user)) throw new ApiError(403, 'Only a community admin can manage this group');
};

/**
 * SEC-097: Private-channel posts are restricted to members, creator, or admin.
 * Generic GET /community/posts and GET /community/posts/:id use this scope.
 */
const communityPostsReadScope = async (req) => {
  if (req.auth?.role === ADMIN) return {};
  const userId = req.auth?.sub;
  if (!userId) {
    const publicChannels = await Channel.find({ visibility: 'public', status: { $ne: 'removed' } }).select('_id').lean();
    return { channelId: { $in: publicChannels.map((c) => c._id) } };
  }

  const [accessibleChannels, activeMemberships] = await Promise.all([
    Channel.find({
      status: { $ne: 'removed' },
      $or: [
        { visibility: 'public' },
        { createdBy: userId },
        { memberIds: userId },
      ],
    }).select('_id').lean(),
    CommunityMembership.find({ userId, status: 'active' }).select('channelId').lean(),
  ]);

  const channelIds = [
    ...accessibleChannels.map((c) => c._id),
    ...activeMemberships.map((m) => m.channelId),
  ];

  return { channelId: { $in: channelIds } };
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

const ADMIN_USER_FIELDS = 'name email avatarUrl emailVerified createdAt';

/** Search a profile collection by its own fields and by its owner's name or email. */
const searchProfilesByUser = (fields) => async (pattern) => {
  const owners = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select('_id').limit(500).lean();
  return {
    $or: [
      ...fields.map((field) => ({ [field]: pattern })),
      { userId: { $in: owners.map((owner) => owner._id) } },
    ],
  };
};

/** Lift the populated owner onto the record: the shape the admin pages read (`name`, `email`, `user`). */
const flattenProfileUser = (item) => {
  const user = item.userId && typeof item.userId === 'object' ? item.userId : null;
  return {
    ...item,
    userId: user ? String(user.id ?? user._id) : item.userId,
    user,
    name: user?.name,
    email: user?.email,
  };
};

/**
 * Add each hirer's verification case and posting count, with two queries per
 * page. Records point at a hirer by HirerAccount id or by the owner's User id
 * (SEC-047), so both are matched.
 */
const decorateHirers = async (items) => {
  const hirers = items.map(flattenProfileUser);
  const keysOf = (hirer) => [hirer.id, hirer.userId].filter((id) => mongoose.isValidObjectId(id)).map(String);
  const objectIds = [...new Set(hirers.flatMap(keysOf))].map((id) => new mongoose.Types.ObjectId(id));

  const [cases, postings] = await Promise.all([
    CompanyVerification.find({ hirerId: { $in: objectIds } }).select('hirerId overallStatus').lean(),
    Opportunity.aggregate([
      { $match: { $or: [{ hirerId: { $in: objectIds } }, { createdBy: { $in: objectIds } }] } },
      { $group: { _id: { $ifNull: ['$hirerId', '$createdBy'] }, count: { $sum: 1 } } },
    ]),
  ]);
  const caseByHirer = new Map(cases.map((entry) => [String(entry.hirerId), entry]));
  const countByHirer = new Map(postings.map((entry) => [String(entry._id), entry.count]));

  return hirers.map((hirer) => {
    const keys = keysOf(hirer);
    const verification = keys.map((key) => caseByHirer.get(key)).find(Boolean);
    return {
      ...hirer,
      overallStatus: verification?.overallStatus ?? null,
      linkedVerificationId: verification ? String(verification._id) : null,
      postingsCount: keys.reduce((sum, key) => sum + (countByHirer.get(key) || 0), 0),
    };
  });
};

/**
 * SEC-075 / SEC-077: the admin dashboard's data API. Every route takes only an
 * admin session (admin secret and audience, via cookie or Bearer). A user
 * Bearer token is rejected even for an admin account. The paths mirror
 * kredibble-admin/src/lib/api.ts, and tests/admin-api-contract.test.js holds
 * the two together.
 */
const mountAdminDataRoutes = (router) => {
  router.get('/admin/analytics', requireAdminAuth, asyncHandler(async (req, res) => {
    const [seekers, activeSeekers, hirers, verifiedHirers, applications, reports, openReports, byType] = await Promise.all([
      SeekerProfile.countDocuments(),
      SeekerProfile.countDocuments({ status: 'active' }),
      HirerAccount.countDocuments(),
      HirerAccount.countDocuments({ verified: true }),
      Applicant.countDocuments(),
      Report.countDocuments(),
      Report.countDocuments({ status: 'open' }),
      Opportunity.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ]);
    itemResponse(res, {
      seekers: { total: seekers, active: activeSeekers },
      hirers: { total: hirers, verified: verifiedHirers },
      applications: { total: applications },
      reports: { total: reports, open: openReports },
      opportunitiesByType: byType.map(({ _id, count }) => ({ type: _id, count })),
    });
  }));

  // Staff are existing Kredibble accounts; there is no email-invite flow (2026-10-04 decision).
  router.post('/admin/staff/invite', requireAdminAuth, validate(staffInviteSchema), asyncHandler(async (req, res) => {
    const user = await User.findOne({ emailNormalized: req.body.email.trim().toLowerCase(), role: { $ne: 'deleted' } });
    if (!user) throw new ApiError(404, 'No Kredibble account uses that email. Ask them to sign up first.');
    if (await StaffMember.exists({ userId: user._id })) {
      throw new ApiError(409, 'That account is already on the staff list');
    }
    const roles = req.body.roles && req.body.roles.length > 0
      ? req.body.roles
      : normalizeLegacyRole(req.body.role);
    const staff = await StaffMember.create({
      userId: user._id,
      name: user.name,
      email: user.email,
      roles,
      role: req.body.role || roles.join(','),
      status: 'active',
      joinedDate: new Date().toISOString().slice(0, 10),
    });
    await auditReq(req, {
      action: AUDIT_ACTIONS.ADMIN_USER_UPDATE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
      metadata: { staffInvite: true, roles, role: req.body.role || roles.join(',') },
    });
    res.status(201).json({ data: toClientObject(staff) });
  }));

  // Article banners: images only, stored outside any user's folder.
  router.use('/admin/upload', createUploadRouter({
    authenticate: requireAdminAuth,
    purposes: ['article-banner'],
    folderFor: (req, purpose) => `kredibble/admin/${purpose}`,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  }));

  // Nested lists first, so the collection mounts' `/:id` never sees them.
  router.get('/admin/verification/companies/:companyId/documents', requireAdminAuth, asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.companyId)) throw notFound('Company verification');
    const verification = await CompanyVerification.findById(req.params.companyId).select('hirerId').lean();
    if (!verification) throw notFound('Company verification');
    // A document points at its case, or only at the hirer (`companyId`).
    const filter = {
      $or: [
        { verificationCaseId: verification._id },
        ...(verification.hirerId ? [{ companyId: verification.hirerId }] : []),
      ],
    };
    const { page, limit, skip } = parsePagination(req.query);
    const [docs, total] = await Promise.all([
      VerificationDoc.find(filter).sort({ _id: -1 }).skip(skip).limit(limit),
      VerificationDoc.countDocuments(filter),
    ]);
    listResponse(res, docs.map(toClientObject), total, page, limit);
  }));

  router.get('/admin/community/channels/:channelId/posts', requireAdminAuth, asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.channelId)) throw notFound('Channel');
    const filter = { channelId: req.params.channelId };
    const { page, limit, skip } = parsePagination(req.query);
    const [posts, total] = await Promise.all([
      ChannelPost.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate({ path: 'authorId', select: 'name email avatarUrl' }),
      ChannelPost.countDocuments(filter),
    ]);
    listResponse(res, posts.map(toClientObject), total, page, limit);
  }));

  const adminCollection = (path, options) => router.use(
    `/admin${path}`,
    collectionRoutes({ ...options, authenticate: requireAdminAuth, populateAlways: true }),
  );

  adminCollection('/seekers', {
    Model: SeekerProfile, resourceName: 'Seeker', policyKey: 'seekers',
    populate: { path: 'userId', select: ADMIN_USER_FIELDS },
    searchFilter: searchProfilesByUser(['profession', 'university', 'country']),
    filterFields: ['verified', 'status', 'country'],
    decorate: async (items) => items.map(flattenProfileUser),
  });
  adminCollection('/hirers', {
    Model: HirerAccount, resourceName: 'Hirer', policyKey: 'hirers',
    populate: { path: 'userId', select: ADMIN_USER_FIELDS },
    searchFilter: searchProfilesByUser(['companyName', 'industry', 'location', 'companyEmail']),
    filterFields: ['verified', 'status', 'industry'],
    decorate: decorateHirers,
  });
  adminCollection('/verification/companies', {
    Model: CompanyVerification, resourceName: 'Company verification', policyKey: 'verification/companies',
    searchFields: ['name', 'industry', 'companyEmail'], filterFields: ['overallStatus'],
  });
  adminCollection('/verification/documents', {
    Model: VerificationDoc, resourceName: 'VerificationDoc', policyKey: 'verification/documents',
    searchFields: ['label', 'fileName'], filterFields: ['status'],
  });
  adminCollection('/events', {
    Model: Event, resourceName: 'Event', policyKey: 'events',
    searchFields: ['title', 'location', 'hirer'], filterFields: ['status'],
  });
  adminCollection('/grants', {
    Model: Grant, resourceName: 'Grant', policyKey: 'grants',
    searchFields: ['title', 'sector', 'hirer'], filterFields: ['status', 'sector'],
  });
  adminCollection('/articles', {
    Model: Article, resourceName: 'Article', policyKey: 'articles',
    searchFields: ['title', 'category'], filterFields: ['status', 'category'],
  });
  adminCollection('/staff', {
    Model: StaffMember, resourceName: 'Staff', policyKey: 'staff',
    searchFields: ['name', 'email'], filterFields: ['role', 'status'],
  });
  adminCollection('/reports', {
    Model: Report, resourceName: 'Report', policyKey: 'reports',
    searchFields: ['reason', 'details', 'targetLabel'], filterFields: ['status', 'targetType'],
  });
  adminCollection('/community/channels', {
    Model: Channel, resourceName: 'Channel', policyKey: 'community/channels',
    searchFields: ['name', 'category'], filterFields: ['status', 'category', 'visibility'],
  });
  adminCollection('/community/posts', {
    Model: ChannelPost, resourceName: 'ChannelPost', policyKey: 'community/posts',
    populate: { path: 'authorId', select: 'name email avatarUrl' },
    searchFields: ['title', 'body'], filterFields: ['channelId', 'flagged'],
  });
  adminCollection('/grant-applications', {
    Model: GrantApplication, resourceName: 'GrantApplication', policyKey: 'grant-applications',
    searchFields: ['applicantName'], filterFields: ['grantId', 'status'],
  });

  // The staff-portal router has list/update/delete for postings but no read by id.
  router.get('/admin/opportunities/:id', requireAdminAuth, asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Opportunity');
    const opportunity = await Opportunity.findById(req.params.id);
    if (!opportunity) throw notFound('Opportunity');
    itemResponse(res, toClientObject(opportunity));
  }));
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
  router.use('/ambassador-requests', ambassadorRouter);
  // After the staff-portal router, so its paths (e.g. /admin/reports/monthly) match first.
  mountAdminDataRoutes(router);

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
      // SEC-112: lets a deploy confirm the new release is the one answering.
      environment: env.appEnv,
      release: env.release,
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
      pendingAmbassadorRequests,
      pendingRecords,
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
      AmbassadorRequest.countDocuments({ status: 'pending' }),
      Beneficiary.countDocuments({ verified: false }),
    ]);

    itemResponse(res, {
      // Keys read by the admin dashboard.
      pendingVerifications,
      pendingAmbassadorRequests,
      pendingOpportunities,
      pendingRecords,
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
    if (req.auth?.role !== ADMIN) clauses.push({ status: { $ne: 'removed' } });
    if (req.query.visibility) clauses.push({ visibility: String(req.query.visibility) });
    const pattern = searchPattern(req.query.q);
    if (pattern) clauses.push({ $or: [{ name: pattern }, { category: pattern }] });
    const filter = clauses.length === 1 ? visible : { $and: clauses };

    const { page, limit, skip } = parsePagination(req.query);
    const [channels, total] = await Promise.all([
      Channel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Channel.countDocuments(filter),
    ]);
    // `followed`: the caller already belongs to it (so the app lists it under their channels, not under "find channels").
    // `announcement`: an admin created it, so it opens as an announcement channel (posts, with optional replies).
    const me = req.auth?.sub;
    const memberOf = new Set(membershipChannelIds.map(String));
    const creatorIds = [...new Set(channels.map((c) => toId(c.createdBy)).filter(Boolean))];
    const adminCreators = new Set((await User.find({ _id: { $in: creatorIds }, role: ADMIN }).select('_id').lean()).map((u) => String(u._id)));
    listResponse(res, channels.map((channel) => ({
      ...toClientObject(channel),
      followed: Boolean(me) && (memberOf.has(String(channel._id)) || isChannelCreator(channel, req.auth) || isLegacyMember(channel, me)),
      announcement: adminCreators.has(toId(channel.createdBy)),
    })), total, page, limit);
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
    assertChannelVisible(channel, req.auth);
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
    evictFromChannelRoom(channel._id, req.params.userId);
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
    evictFromChannelRoom(channel._id, req.params.userId);
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

  // Group chat. History and sending are limited to people who can access the channel and are not banned.
  const assertCanChat = async (channel, auth) => {
    assertChannelVisible(channel, auth);
    if (!await canAccessChannel(channel, auth)) throw new ApiError(403, 'You do not have access to this group');
    const membership = await getMembership(channel._id, auth.sub);
    if (membership?.status === 'banned') throw new ApiError(403, 'You have been removed from this group');
  };

  // Announcements: members read them, only channel admins post them. Whether members may reply is chosen per post.
  router.get('/community/channels/:channelId/messages', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await assertCanChat(channel, req.auth);
    const [posts, canPost] = await Promise.all([
      listChannelMessages(channel._id, { before: req.query.before, limit: req.query.limit }),
      canManageChannel(channel, req.auth),
    ]);
    itemResponse(res, { posts, canPost });
  }));

  router.get('/community/channels/:channelId/messages/:messageId/replies', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await assertCanChat(channel, req.auth);
    if (!mongoose.isValidObjectId(req.params.messageId)) throw notFound('Message');
    const thread = await getThread(channel._id, req.params.messageId);
    if (!thread) throw notFound('Message');
    const isManager = await canManageChannel(channel, req.auth);
    itemResponse(res, { ...thread, canReply: isManager || thread.post.allowReplies, canManage: isManager });
  }));

  router.post('/community/channels/:channelId/messages', requireAuth, chatLimiter, validate(chatMessageSchema), asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    await assertCanChat(channel, req.auth);
    const isManager = await canManageChannel(channel, req.auth);
    const { parentId } = req.body;
    if (parentId) {
      const parent = await findPost(channel._id, parentId);
      if (!parent) throw notFound('Message');
      if (!isManager && !parent.allowReplies) throw new ApiError(403, 'Replies are turned off for this post');
    } else if (!isManager) {
      throw new ApiError(403, 'Only admins can post in this channel. You can reply to posts that allow replies.');
    }
    const sender = await User.findById(req.auth.sub).select('name role');
    const message = await postChannelMessage({ channel, sender, body: req.body.body, parentId, allowReplies: req.body.allowReplies });
    res.status(201).json({ data: message });
  }));

  router.get('/community/channels/:channelId/posts', optionalAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    assertChannelVisible(channel, req.auth);
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
    assertChannelVisible(channel, req.auth);
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

  // Push notification token registration
  router.post('/users/me/push-token', requireAuth, validate(pushTokenSchema), asyncHandler(async (req, res) => {
    const userId = req.auth.sub || req.auth.id || req.auth.userId;
    const { token, platform } = req.body;
    const update = {
      pushToken: token,
      pushTokenUpdatedAt: new Date(),
    };
    if (platform) {
      update.pushPlatform = platform;
    }
    await User.findByIdAndUpdate(userId, { $set: update });
    itemResponse(res, { success: true });
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
  router.use('/events', collectionRoutes({
    Model: Event,
    resourceName: 'Event',
    policyKey: 'events',
    searchFields: ['title', 'location'],
    ownerField: 'createdBy',
    enablePopulate,
    publicRead: true,
    readScope: eventReadScope,
  }));
  router.use('/grants', collectionRoutes({ Model: Grant, resourceName: 'Grant', policyKey: 'grants', searchFields: ['title', 'sector'], enablePopulate }));
  router.use('/articles', collectionRoutes({
    Model: Article,
    resourceName: 'Article',
    policyKey: 'articles',
    searchFields: ['title', 'category'],
    enablePopulate,
    publicRead: true,
    readScope: articleReadScope,
  }));
  router.post('/notifications/:id/read', requireAuth, asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Notification');
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.auth.sub },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!notification) throw notFound('Notification');
    itemResponse(res, toClientObject(notification));
  }));
  router.use('/notifications', collectionRoutes({ Model: Notification, resourceName: 'Notification', policyKey: 'notifications', searchFields: ['title', 'message'], enablePopulate, readScope: notificationReadScope }));
  router.use('/verification/companies', collectionRoutes({
    Model: CompanyVerification,
    resourceName: 'Company verification',
    policyKey: 'verification/companies',
    searchFields: ['name', 'industry'],
    ownerField: 'hirerId',
    enablePopulate,
    assertWritable: assertVerificationCompanyWritable,
  }));

  // Special nested routes
  router.post('/opportunities/:opportunityId/applicants', ...guard('applicants', 'create', 'applicant'), requireEmailVerified, asyncHandler(async (req, res) => {
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
    if (req.auth.role !== ADMIN && String(opportunity.createdBy) !== req.auth.sub && String(opportunity.hirerId) !== req.auth.sub) {
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

  router.post('/grants/:grantId/applications', ...guard('grant-applications', 'create', 'grantApplication'), requireEmailVerified, asyncHandler(async (req, res) => {
    const grantId = req.params.grantId;
    const grant = await Grant.findById(grantId);
    if (!grant) throw notFound('Grant');
    if (grant.status !== 'open') throw new ApiError(400, 'Grant is not open for applications');

    const requestedAmount = Number(req.body.requestedAmount);
    if (!requestedAmount || requestedAmount <= 0) {
      throw new ApiError(400, 'Requested amount must be greater than 0');
    }
    if (requestedAmount > grant.fundingPool) {
      throw new ApiError(400, 'Requested amount cannot exceed grant funding pool');
    }

    // SEC-060: Atomic conditional reservation on fundingPool
    const updatedGrant = await Grant.findOneAndUpdate(
      {
        _id: grantId,
        status: 'open',
        $expr: { $lte: [{ $add: ['$allocated', requestedAmount] }, '$fundingPool'] },
      },
      { $inc: { allocated: requestedAmount } },
      { returnDocument: 'after' },
    );

    if (!updatedGrant) {
      throw new ApiError(400, 'Grant funding pool capacity exceeded');
    }

    const application = new GrantApplication({
      ...buildCreatePayload(RESOURCE_POLICIES['grant-applications'], req.body),
      grantId,
      applicantUserId: req.auth?.sub,
      applicantName: req.body.applicantName || req.auth?.name || 'Applicant',
      requestedAmount,
    });
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

  router.post('/verification/companies/:companyId/documents', ...guard('verification/documents', 'create', 'document'), requireEmailVerified, asyncHandler(async (req, res) => {
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
    if (req.auth.role === HIRER && (String(opportunity.createdBy) === req.auth.sub || String(opportunity.hirerId) === req.auth.sub)) return applicant;
    
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
  router.use('/community/posts', collectionRoutes({ Model: ChannelPost, resourceName: 'ChannelPost', policyKey: 'community/posts', ownerField: 'authorId', enablePopulate, readScope: communityPostsReadScope }));

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

  /**
   * SEC-072: Seekers can list their own applications populated with opportunity summary.
   */
  router.get('/users/me/applications', requireAuth, asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { seekerId: req.auth.sub };
    const [applications, total] = await Promise.all([
      Applicant.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'opportunityId',
          select: 'title company type location status moderationStatus',
        })
        .lean(),
      Applicant.countDocuments(filter),
    ]);

    const formatted = applications.map((app) => ({
      ...toClientObject(app),
      opportunity: app.opportunityId ? toClientObject(app.opportunityId) : null,
    }));

    listResponse(res, formatted, total, page, limit);
  }));

  /**
   * SEC-060: Authenticated users can list their own grant applications with populated grant info.
   */
  router.get('/users/me/grant-applications', requireAuth, asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { applicantUserId: req.auth.sub };
    const [applications, total] = await Promise.all([
      GrantApplication.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'grantId',
          select: 'title hirer sector fundingPool status',
        })
        .lean(),
      GrantApplication.countDocuments(filter),
    ]);

    const formatted = applications.map((app) => ({
      ...toClientObject(app),
      grant: app.grantId ? toClientObject(app.grantId) : null,
    }));

    listResponse(res, formatted, total, page, limit);
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
