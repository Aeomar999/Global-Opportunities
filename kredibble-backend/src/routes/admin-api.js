import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAdminOrStaffAuth, requireAdminAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requirePortalRoles } from '../middleware/portal-auth.js';
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
} from '../models/AdminPortal.js';
import { deleteFromWordpress, syncToWordpress } from '../lib/wordpress-sync.js';
import { env } from '../config/env.js';
import { auditReq, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../lib/audit.js';
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

const preparePartner = (data) => {
  const next = { ...data };
  if (String(next.stage || '').toLowerCase() === 'mou') next.stage = 'MOU';
  if (next.stage) next.closed = ['onboard', 'renew'].includes(next.stage);
  else delete next.closed;
  return next;
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

const addManagedRoutes = ({ path, Model, resource, roles, prepare = (data) => data, filters = [] }) => {
  adminApiRouter.get(path, requireAdminOrStaffAuth, requirePortalRoles(...roles), asyncHandler(async (req, res) => {
    const filter = {};
    for (const key of filters) if (req.query[key]) filter[key] = req.query[key];
    if (req.query.q) {
      filter.$or = ['title', 'organizationName', 'fullName', 'email', 'country'].map((field) => ({ [field]: { $regex: escapedRegex(req.query.q), $options: 'i' } }));
    }
    const { skip, limit } = pageOptions(req.query);
    const records = await Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
    listResponse(res, records.map(toClientObject));
  }));

  adminApiRouter.get(`${path}/:id`, requireAdminOrStaffAuth, requirePortalRoles(...roles), asyncHandler(async (req, res) => {
    const record = await Model.findById(validId(req.params.id, resource));
    if (!record) throw notFound(resource);
    itemResponse(res, toClientObject(record));
  }));

  adminApiRouter.post(path, requireAdminOrStaffAuth, requirePortalRoles(...roles), asyncHandler(async (req, res) => {
    const record = new Model({ ...prepare(req.body), createdBy: req.auth.sub });
    await record.save();
    const sync = await syncManagedRecord(resource, record);
    await logActivity(req.auth.sub, 'created', resource, record);
    res.status(201).json({ data: { ...toClientObject(record), sync } });
  }));

  adminApiRouter.patch(`${path}/:id`, requireAdminOrStaffAuth, requirePortalRoles(...roles), asyncHandler(async (req, res) => {
    const record = await Model.findById(validId(req.params.id, resource));
    if (!record) throw notFound(resource);
    Object.assign(record, prepare(req.body));
    await record.save();
    const sync = await syncManagedRecord(resource, record);
    await logActivity(req.auth.sub, 'updated', resource, record);
    itemResponse(res, { ...toClientObject(record), sync });
  }));

  adminApiRouter.post(`${path}/:id/retry-wordpress-sync`, requireAdminOrStaffAuth, requirePortalRoles(...roles), asyncHandler(async (req, res) => {
    const record = await Model.findById(validId(req.params.id, resource));
    if (!record) throw notFound(resource);
    itemResponse(res, { ...toClientObject(record), sync: await syncManagedRecord(resource, record) });
  }));

  adminApiRouter.delete(`${path}/:id`, requireAdminOrStaffAuth, requirePortalRoles(...roles), asyncHandler(async (req, res) => {
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

addManagedRoutes({ path: '/programs', Model: Program, resource: 'programs', roles: PROGRAM_ROLES, filters: ['status', 'country', 'programType'] });
addManagedRoutes({ path: '/partners', Model: Partner, resource: 'partners', roles: PARTNER_ROLES, prepare: preparePartner, filters: ['stage', 'country', 'partnerType', 'closed'] });
addManagedRoutes({ path: '/ambassadors', Model: Ambassador, resource: 'ambassadors', roles: AMBASSADOR_ROLES, filters: ['status', 'tier', 'country'] });
addManagedRoutes({ path: '/social-posts', Model: SocialPost, resource: 'social-posts', roles: SOCIAL_ROLES, filters: ['platform'] });

adminApiRouter.post('/ambassadors/:id/amplifications', requireAdminOrStaffAuth, requirePortalRoles(...AMBASSADOR_ROLES), asyncHandler(async (req, res) => {
  const ambassador = await Ambassador.findById(validId(req.params.id, 'Ambassador'));
  if (!ambassador) throw notFound('Ambassador');
  const channel = String(req.body.channel || '').trim();
  if (!channel) throw new ApiError(400, 'channel is required');
  const amplification = await AmbassadorAmplification.create({ ambassadorId: ambassador._id, channel, note: req.body.note, loggedBy: req.auth.sub });
  await logActivity(req.auth.sub, 'logged amplification', 'ambassadors', ambassador);
  res.status(201).json({ data: toClientObject(amplification) });
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

  const ambassador = await Ambassador.findOneAndUpdate(
    { linkedUserId: user._id },
    {
      $set: { fullName: user.name, email: user.email, phone: request.phone, country: request.country, city: request.city, memberType: request.role, status: 'onboarding', linkedUserId: user._id },
      $setOnInsert: { createdBy: req.auth.sub },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

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
  await Ambassador.updateMany({ linkedUserId: request.userId }, { $set: { status: 'dormant' } });

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

adminApiRouter.get('/targets', requireAdminOrStaffAuth, requirePortalRoles(...ALL_PORTAL_ROLES), asyncHandler(async (req, res) => {
  const { month } = monthBounds(req.query.month);
  const targets = await MonthlyTarget.find({ month }).sort({ metric: 1 });
  listResponse(res, targets.map(toClientObject));
}));

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
  itemResponse(res, toClientObject(record));
}));

const metricStatus = (value, target, thresholds = {}) => {
  if (!target) return 'green';
  const ratio = value / target;
  const green = Number.isFinite(thresholds.greenThreshold) ? thresholds.greenThreshold : 1;
  const amber = Number.isFinite(thresholds.amberThreshold) ? thresholds.amberThreshold : 0.7;
  return ratio >= green ? 'green' : ratio >= amber ? 'amber' : 'red';
};

const dashboardMetrics = async (month) => {
  const { start, end } = monthBounds(month);
  const [opportunitiesPublished, programsActive, programsDelivered, partnersClosed, ambassadorsActive, beneficiariesVerified, beneficiariesAdded, social, applications] = await Promise.all([
    Opportunity.countDocuments({ vetted: true, moderationStatus: { $in: ['published', 'approved'] }, createdAt: { $gte: start, $lt: end } }),
    Program.countDocuments({ status: { $in: ['planned', 'running'] } }),
    Program.countDocuments({ status: 'delivered', endAt: { $gte: start, $lt: end } }),
    Partner.countDocuments({ closed: true, updatedAt: { $gte: start, $lt: end } }),
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

const partnerPipelineHealth = async (month) => {
  const [total, closed, open, target] = await Promise.all([
    Partner.countDocuments(),
    Partner.countDocuments({ closed: true }),
    Partner.countDocuments({ closed: false }),
    MonthlyTarget.findOne({ month, metric: 'partnersClosed' }),
  ]);
  const closeRate = total ? closed / total : 0;
  const requiredOpenDeals = target?.target && closeRate ? Math.ceil(target.target / closeRate) : 0;
  return { openDeals: open, historicalCloseRate: closeRate, requiredOpenDeals, status: requiredOpenDeals ? metricStatus(open, requiredOpenDeals, target) : 'green' };
};

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
    metrics.push({ metric: 'programsDelivered', value: await Program.countDocuments({ createdBy: userId, status: 'delivered', endAt: { $gte: start, $lt: end } }) });
  }
  if (roles.includes('partnerships officer')) {
    metrics.push({ metric: 'partnersClosed', value: await Partner.countDocuments({ assignedOwnerId: userId, closed: true, updatedAt: { $gte: start, $lt: end } }) });
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

adminApiRouter.get('/settings/pipeline-stages', requireAdminOrStaffAuth, requirePortalRoles(...ALL_PORTAL_ROLES), (req, res) => {
  itemResponse(res, ['prospect', 'outreach', 'proposal', 'MOU', 'onboard', 'renew']);
});

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