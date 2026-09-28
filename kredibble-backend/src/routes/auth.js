import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth, requireAdminAuth, signToken, signAdminToken, setAdminCookie, clearAdminCookie, generateRefreshToken, hashRefreshToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../schemas/auth.js';
import { ApiError, asyncHandler, itemResponse } from '../utils/http.js';
import { User, RevokedRefreshToken, hashRefreshToken as hashRefreshTokenUtil, EmailVerificationCode } from '../models/User.js';
import { SeekerProfile, HirerAccount } from '../models/Profiles.js';
import { createVerificationCode, hashVerificationCode, sendVerificationEmail } from '../lib/email.js';
import { env } from '../config/env.js';
import { auditLog, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES, auditReq } from '../lib/audit.js';
import { registrationLimiter, passwordResetLimiter } from '../lib/rate-limiters.js';

export const authRouter = Router();

const isTest = process.env.NODE_ENV === 'test';
if (!isTest) {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: { error: { message: 'Too many requests from this IP, please try again after 15 minutes' } },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  authRouter.use(authLimiter);
}

const publicUser = (user) => {
  if (!user) return null;
  const userObj = user.toJSON ? user.toJSON() : user;
  const { passwordHash, _id, __v, refreshTokenHash, tokenVersion, emailNormalized, ...safeUser } = userObj;
  return { id: _id, ...safeUser };
};

const PUBLIC_ROLES = ['seeker', 'hirer'];

/**
 * Normalize email: lowercase and trim
 * SEC-028: Email normalization to prevent case-variant duplicate accounts
 */
const normalizeEmail = (email) => String(email).trim().toLowerCase();

authRouter.post(
  '/register',
  registrationLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const role = PUBLIC_ROLES.includes(req.body.role) ? req.body.role : 'seeker';

    // SEC-028: Normalize email for case-insensitive uniqueness
    const normalizedEmail = normalizeEmail(email);

    const existing = await User.findOne({ emailNormalized: normalizedEmail });
    if (existing) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.REGISTER,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        outcome: 'failure',
        metadata: { reason: 'email_exists', email },
      });
      throw new ApiError(409, 'User already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = new User({
      name,
      email,
      emailNormalized: normalizedEmail,
      role,
      passwordHash,
    });

    await user.save();

    if (role === 'seeker') {
      const seeker = new SeekerProfile({
        userId: user._id,
        profession: req.body.profession || 'Opportunity Seeker',
        university: req.body.university,
        country: req.body.country,
        city: req.body.city,
        phone: req.body.phone,
        technicalSkills: Array.isArray(req.body.technicalSkills)
          ? JSON.stringify(req.body.technicalSkills)
          : '[]',
      });
      await seeker.save();
    } else if (role === 'hirer') {
      const hirer = new HirerAccount({
        userId: user._id,
        companyName: req.body.companyName || name,
        industry: req.body.industry || 'Not specified',
        location: req.body.location || 'Not specified',
        website: req.body.website,
        companySize: req.body.companySize,
        companyEmail: req.body.companyEmail || email,
        recruiterName: name,
        recruiterRole: req.body.recruiterRole,
        recruiterEmail: email,
        recruiterPhone: req.body.recruiterPhone,
        recruiterLinkedin: req.body.recruiterLinkedin,
      });
      await hirer.save();
    }

    const refreshToken = generateRefreshToken();
    user.refreshTokenHash = hashRefreshTokenUtil(refreshToken);
    await user.save();

    await auditReq(req, {
      action: AUDIT_ACTIONS.REGISTER,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
      metadata: { role },
    });

    res.status(201).json({
      data: { user: publicUser(user), token: signToken(user), refreshToken },
    });
  }),
);

authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // SEC-028: Normalize email for case-insensitive lookup
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ emailNormalized: normalizedEmail }).select('+refreshTokenHash');
    if (!user?.passwordHash) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        outcome: 'failure',
        metadata: { reason: 'user_not_found', email },
      });
      throw new ApiError(401, 'Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: user._id,
        outcome: 'failure',
        metadata: { reason: 'invalid_password', email },
      });
      throw new ApiError(401, 'Invalid email or password');
    }

    let profile = null;
    if (user.role === 'seeker') profile = await SeekerProfile.findOne({ userId: user._id });
    if (user.role === 'hirer') profile = await HirerAccount.findOne({ userId: user._id });

    const finalUser = user.toObject();
    finalUser[user.role] = profile;

    const refreshToken = generateRefreshToken();
    user.refreshTokenHash = hashRefreshTokenUtil(refreshToken);
    await user.save();

    await auditReq(req, {
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
      metadata: { role: user.role },
    });

    res.json({
      data: { user: publicUser(finalUser), token: signToken(user), refreshToken },
    });
  }),
);

// SEC-009: rotate refresh token
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new ApiError(400, 'Refresh token required');

    const tokenHash = hashRefreshTokenUtil(refreshToken);

    // Check if token is revoked
    const revoked = await RevokedRefreshToken.findOne({ tokenHash });
    if (revoked) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.REFRESH_TOKEN,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        outcome: 'failure',
        metadata: { reason: 'token_revoked' },
      });
      throw new ApiError(401, 'Refresh token revoked');
    }

    // Find user by refresh token hash
    const user = await User.findOne({ refreshTokenHash: tokenHash }).select('+refreshTokenHash');
    if (!user) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.REFRESH_TOKEN,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        outcome: 'failure',
        metadata: { reason: 'invalid_token' },
      });
      throw new ApiError(401, 'Invalid refresh token');
    }

    // Rotate: generate new refresh token, hash old one to denylist
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashRefreshTokenUtil(newRefreshToken);

    await RevokedRefreshToken.create({
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days TTL
    });

    user.refreshTokenHash = newTokenHash;
    await user.save();

    await auditReq(req, {
      action: AUDIT_ACTIONS.REFRESH_TOKEN,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
      metadata: { role: user.role },
    });

    res.json({ data: { token: signToken(user), refreshToken: newRefreshToken } });
  }),
);

// Logout — revoke current refresh token
authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth.sub).select('+refreshTokenHash');
    if (user?.refreshTokenHash) {
      await RevokedRefreshToken.create({
        tokenHash: user.refreshTokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      user.refreshTokenHash = undefined;
      await user.save();
    }

    await auditReq(req, {
      action: AUDIT_ACTIONS.LOGOUT,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: req.auth.sub,
      outcome: 'success',
    });

    res.json({ data: { message: 'Logged out' } });
  }),
);

// Admin login — sets httpOnly cookie, returns user only (no token in body)
authRouter.post(
  '/admin/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // SEC-028: Normalize email for case-insensitive lookup
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ emailNormalized: normalizedEmail });
    if (!user?.passwordHash || user.role !== 'admin') {
      await auditReq(req, {
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        outcome: 'failure',
        metadata: { reason: 'not_admin_or_not_found', email },
      });
      throw new ApiError(401, 'Invalid admin credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: user._id,
        outcome: 'failure',
        metadata: { reason: 'invalid_password', email },
      });
      throw new ApiError(401, 'Invalid admin credentials');
    }

    const adminToken = signAdminToken(user);
    setAdminCookie(res, adminToken);

    // Also issue refresh token for admin (stored on user)
    const refreshToken = generateRefreshToken();
    user.refreshTokenHash = hashRefreshTokenUtil(refreshToken);
    await user.save();

    await auditReq(req, {
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
      metadata: { role: 'admin', isAdminLogin: true },
    });

    res.json({ data: { user: publicUser(user), refreshToken } });
  }),
);

// Admin logout — clears cookie, revokes refresh token
authRouter.post(
  '/admin/logout',
  asyncHandler(async (req, res) => {
    clearAdminCookie(res);
    // If refresh token sent in body, revoke it
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = hashRefreshTokenUtil(refreshToken);
      await RevokedRefreshToken.create({
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    await auditReq(req, {
      action: AUDIT_ACTIONS.LOGOUT,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      outcome: 'success',
      metadata: { isAdminLogout: true },
    });

    res.json({ data: { message: 'Logged out' } });
  }),
);

// Email verification — send code
authRouter.post(
  '/verification-code/send',
  passwordResetLimiter,
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, 'A valid email is required');

    // SEC-028: Use normalized email for consistency
    const normalizedEmail = normalizeEmail(email);

    const code = createVerificationCode();
    await EmailVerificationCode.deleteMany({ email: normalizedEmail });
    await EmailVerificationCode.create({
      email: normalizedEmail,
      codeHash: hashVerificationCode(code),
      expiresAt: new Date(Date.now() + env.emailVerificationCodeTtlMinutes * 60 * 1000),
    });
    await sendVerificationEmail(normalizedEmail, code);

    await auditReq(req, {
      action: AUDIT_ACTIONS.EMAIL_VERIFY,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      outcome: 'success',
      metadata: { step: 'send_code', email: normalizedEmail },
    });

    res.status(202).json({ data: { email, expiresInMinutes: env.emailVerificationCodeTtlMinutes } });
  }),
);

// Email verification — verify code
authRouter.post(
  '/verification-code/verify',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '');
    const normalizedEmail = normalizeEmail(email);
    const record = await EmailVerificationCode.findOne({ email: normalizedEmail, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
    if (!record || record.codeHash !== hashVerificationCode(code)) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.EMAIL_VERIFY,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        outcome: 'failure',
        metadata: { step: 'verify_code', reason: 'invalid_or_expired', email: normalizedEmail },
      });
      throw new ApiError(400, 'Invalid or expired verification code');
    }
    await User.updateOne({ emailNormalized: normalizedEmail }, { emailVerified: true });
    await EmailVerificationCode.deleteMany({ email: normalizedEmail });

    await auditReq(req, {
      action: AUDIT_ACTIONS.EMAIL_VERIFY,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      outcome: 'success',
      metadata: { step: 'verify_code', email: normalizedEmail },
    });

    itemResponse(res, { email: normalizedEmail, verified: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth.sub);
    if (!user) throw new ApiError(404, 'User not found');

    let profile = null;
    if (user.role === 'seeker') profile = await SeekerProfile.findOne({ userId: user._id });
    if (user.role === 'hirer') profile = await HirerAccount.findOne({ userId: user._id });

    const finalUser = user.toObject();
    finalUser[user.role] = profile;

    itemResponse(res, publicUser(finalUser));
  }),
);