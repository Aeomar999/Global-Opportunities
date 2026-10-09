import { Router } from 'express';
import { asyncHandler, itemResponse, ApiError } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createAmbassadorRequestSchema } from '../schemas/ambassador.js';
import { User } from '../models/User.js';
import { SeekerProfile, HirerAccount } from '../models/Profiles.js';
import { Ambassador, AmbassadorRequest } from '../models/AdminPortal.js';
import { auditReq, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../lib/audit.js';

export const ambassadorRouter = Router();

// After a rejection the user may apply again, but not straight away.
const REAPPLY_AFTER_DAYS = 7;

export const toRequestResponse = (doc) => doc && ({
  id: String(doc._id),
  userId: String(doc.userId?._id || doc.userId),
  role: doc.role,
  name: doc.name,
  email: doc.email,
  phone: doc.phone,
  country: doc.country,
  city: doc.city,
  profession: doc.profession,
  organisation: doc.organisation,
  motivation: doc.motivation,
  status: doc.status,
  reviewNote: doc.reviewNote,
  reviewedAt: doc.reviewedAt,
  channelId: doc.channelId ? String(doc.channelId) : undefined,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

/** Build the snapshot the admin reviews from the user's own records (never from the request body). */
const buildSnapshot = async (user) => {
  if (user.role === 'hirer') {
    const hirer = await HirerAccount.findOne({ userId: user._id }).lean();
    return {
      organisation: hirer?.companyName,
      country: undefined,
      city: hirer?.location,
      phone: hirer?.recruiterPhone,
      profession: hirer?.recruiterRole || 'Recruiter',
    };
  }
  const seeker = await SeekerProfile.findOne({ userId: user._id }).lean();
  return {
    organisation: seeker?.university,
    country: seeker?.country,
    city: seeker?.city,
    phone: seeker?.phone,
    profession: seeker?.profession,
  };
};

const ownAmbassador = (userId) => Ambassador.findOne({ linkedUserId: userId, status: { $in: ['onboarding', 'active'] } }).lean();

ambassadorRouter.post('/', requireAuth, validate(createAmbassadorRequestSchema), asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.sub);
  if (!user || !['seeker', 'hirer'].includes(user.role)) throw new ApiError(403, 'Only seekers and hirers can apply to become an ambassador');

  if (await ownAmbassador(user._id)) throw new ApiError(409, 'You are already a Kredibble ambassador');
  if (await AmbassadorRequest.exists({ userId: user._id, status: 'pending' })) {
    throw new ApiError(409, 'You already have a pending ambassador request');
  }
  const lastRejected = await AmbassadorRequest.findOne({ userId: user._id, status: 'rejected' }).sort({ reviewedAt: -1 }).lean();
  if (lastRejected?.reviewedAt && Date.now() - new Date(lastRejected.reviewedAt).getTime() < REAPPLY_AFTER_DAYS * 86400000) {
    throw new ApiError(429, `You can apply again ${REAPPLY_AFTER_DAYS} days after a decision`);
  }

  const snapshot = await buildSnapshot(user);
  let request;
  try {
    request = await AmbassadorRequest.create({
      userId: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      motivation: req.body.motivation || undefined,
      ...snapshot,
    });
  } catch (err) {
    // The partial unique index closes the race between two simultaneous taps.
    if (err?.code === 11000) throw new ApiError(409, 'You already have a pending ambassador request');
    throw err;
  }

  await auditReq(req, {
    action: AUDIT_ACTIONS.AMBASSADOR_REQUEST,
    resourceType: AUDIT_RESOURCE_TYPES.AMBASSADOR_REQUEST,
    resourceId: request._id,
    outcome: 'success',
    metadata: { role: user.role },
  });
  res.status(201).json({ data: toRequestResponse(request) });
}));

ambassadorRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const [latest, ambassador] = await Promise.all([
    AmbassadorRequest.findOne({ userId: req.auth.sub }).sort({ createdAt: -1 }).lean(),
    ownAmbassador(req.auth.sub),
  ]);
  itemResponse(res, {
    isAmbassador: Boolean(ambassador),
    request: latest ? toRequestResponse(latest) : null,
  });
}));
