import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const DUMMY_HASH = '$2a$12$bRWsa/PC32qEk5cFCdQ/n.DrtmNZZeIr7Fc15SfH6SoezqktcAbCO';
import { Router } from 'express';
import { requireAuth, requireAdminAuth, signToken, signAdminToken, setAdminCookie, clearAdminCookie, setAdminRefreshCookie, clearAdminRefreshCookie, generateRefreshToken, hashRefreshToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema, deleteAccountSchema } from '../schemas/auth.js';
import { ApiError, asyncHandler, itemResponse } from '../utils/http.js';
import { User, RefreshToken, hashRefreshToken as hashRefreshTokenUtil, EmailVerificationCode, PasswordResetCode } from '../models/User.js';
import { SeekerProfile, HirerAccount } from '../models/Profiles.js';
import { Applicant, EventAttendee, CompanyVerification, VerificationDoc, Opportunity, GrantApplication } from '../models/Platform.js';
import { Channel, ChannelPost, CommunityMembership } from '../models/Community.js';
import { Testimonial } from '../models/AdminPortal.js';
import { SavedItem } from '../models/User.js';
import { createVerificationCode, hashVerificationCode, sendVerificationEmail, sendPasswordResetEmail } from '../lib/email.js';
import { env } from '../config/env.js';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES, auditReq } from '../lib/audit.js';
import { registrationLimiter, passwordResetLimiter, authLimiter, emailVerificationLimiter, forgotPasswordLimiter, forgotPasswordEmailLimiter, passwordResetAttemptLimiter, reauthLimiter } from '../lib/rate-limiters.js';
import logger from '../lib/logger.js';
import { deleteAccount, userDataFilters } from '../lib/account-deletion.js';
import { disconnectUserSockets } from '../socket.js';

export const authRouter = Router();

const isTest = process.env.NODE_ENV === 'test';
if (!isTest) {
  // SEC-024: routed through the shared factory so the brute-force counter is
  // shared across replicas in production, not per-process.
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

/** Mint a refresh token for this device and the access token to go with it. Saves `user`. */
const issueSession = async (user, req) => {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshTokenUtil(refreshToken);
  user.refreshTokenHash = tokenHash;
  await user.save();
  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    deviceLabel: req.headers['user-agent'] || 'Unknown Device',
  });
  return { token: signToken(user), refreshToken };
};

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
    const tokenHash = hashRefreshTokenUtil(refreshToken);
    user.refreshTokenHash = tokenHash;
    await user.save();
    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      deviceLabel: req.headers['user-agent'] || 'Unknown Device'
    });

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
      
      // SEC-051: Always run bcrypt to prevent timing attacks for unknown emails
      const hashToCompare = user?.passwordHash || DUMMY_HASH;
      const valid = await bcrypt.compare(password, hashToCompare);

      // SEC-065: an erased account (role 'deleted') is treated as unknown, even if
      // a failed purge left its password hash behind.
      if (!user?.passwordHash || user.role === 'deleted') {
        await auditReq(req, {
          action: AUDIT_ACTIONS.LOGIN_FAILURE,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          outcome: 'failure',
          metadata: { reason: 'user_not_found', email },
        });
        throw new ApiError(401, 'Invalid email or password');
      }

      if (!valid) {
        // SEC-025: Increment failed login attempts with progressive backoff
        const maxAttempts = 5;
        const baseLockoutMinutes = 15;
        
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        user.lastFailedLogin = new Date();
        
        if (user.failedLoginAttempts >= maxAttempts) {
          const lockoutMinutes = baseLockoutMinutes * Math.pow(2, user.failedLoginAttempts - maxAttempts);
          user.lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
          
          await user.save();
  
          await auditReq(req, {
            action: AUDIT_ACTIONS.LOGIN_FAILURE,
            resourceType: AUDIT_RESOURCE_TYPES.USER,
            resourceId: user._id,
            outcome: 'failure',
            metadata: { 
              reason: 'account_locked', 
              failedAttempts: user.failedLoginAttempts,
              lockoutMinutes,
            },
          });
        } else {
          await user.save();
          
          await auditReq(req, {
            action: AUDIT_ACTIONS.LOGIN_FAILURE,
            resourceType: AUDIT_RESOURCE_TYPES.USER,
            resourceId: user._id,
            outcome: 'failure',
            metadata: { 
              reason: 'invalid_password', 
              email, 
              failedAttempts: user.failedLoginAttempts,
              remainingAttempts: maxAttempts - user.failedLoginAttempts,
            },
          });
        }
        
        // SEC-051: Generic error message, no attempt count leaked
        throw new ApiError(401, 'Invalid email or password');
      }

      // SEC-025: Check for account lockout due to failed attempts (only evaluated for valid password)
      if (user.lockUntil && user.lockUntil > new Date()) {
        const remainingMinutes = Math.ceil((user.lockUntil - new Date()) / 60000);
        await auditReq(req, {
          action: AUDIT_ACTIONS.LOGIN_FAILURE,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          resourceId: user._id,
          outcome: 'failure',
          metadata: { reason: 'account_locked', lockoutMinutes: remainingMinutes },
        });
        throw new ApiError(429, `Account temporarily locked. Try again in ${remainingMinutes} minute(s).`);
      }

    // SEC-025: Reset failed login attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastFailedLogin = null;

    let profile = null;
    if (user.role === 'seeker') profile = await SeekerProfile.findOne({ userId: user._id });
    if (user.role === 'hirer') profile = await HirerAccount.findOne({ userId: user._id });

    const finalUser = user.toObject();
    finalUser[user.role] = profile;

    const { token, refreshToken } = await issueSession(user, req);

    await auditReq(req, {
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
      metadata: { role: user.role },
    });

    res.json({
      data: { user: publicUser(finalUser), token, refreshToken },
    });
  }),
);

// SEC-009: rotate refresh token
authRouter.post(
    '/refresh',
    validate(refreshSchema),
    asyncHandler(async (req, res) => {
      const { refreshToken } = req.body;
      const tokenHash = hashRefreshTokenUtil(refreshToken);

      const tokenDoc = await RefreshToken.findOne({ tokenHash }).populate('userId');
      if (!tokenDoc) {
        await auditReq(req, {
          action: AUDIT_ACTIONS.REFRESH_TOKEN,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          outcome: 'failure',
          metadata: { reason: 'invalid_token' },
        });
        throw new ApiError(401, 'Invalid refresh token');
      }

      // SEC-065: a deleted or missing account can't be refreshed back into a session.
      if (!tokenDoc.userId || tokenDoc.userId.role === 'deleted') {
        await auditReq(req, {
          action: AUDIT_ACTIONS.REFRESH_TOKEN,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          resourceId: tokenDoc.userId?._id,
          outcome: 'failure',
          metadata: { reason: 'account_deleted_or_missing' },
        });
        throw new ApiError(401, 'Invalid refresh token');
      }

      // Reuse detection (token is already replaced/revoked)
      if (tokenDoc.revokedAt || tokenDoc.replacedBy) {
        // SEC-053: Revoke all tokens for this user family
        await RefreshToken.updateMany(
          { userId: tokenDoc.userId._id, revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
        
        await auditReq(req, {
          action: AUDIT_ACTIONS.REFRESH_TOKEN,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          resourceId: tokenDoc.userId._id,
          outcome: 'failure',
          metadata: { reason: 'token_reused_revoked_family' },
        });
        throw new ApiError(401, 'Refresh token revoked, please login again');
      }

      if (tokenDoc.expiresAt < new Date()) {
        throw new ApiError(401, 'Refresh token expired');
      }

      const user = tokenDoc.userId;

      // Rotate: generate new refresh token
      const newRefreshToken = generateRefreshToken();
      const newTokenHash = hashRefreshTokenUtil(newRefreshToken);
      
      tokenDoc.revokedAt = new Date();
      tokenDoc.replacedBy = newTokenHash;
      await tokenDoc.save();
      
      user.refreshTokenHash = newTokenHash;
      await user.save();
      
      await RefreshToken.create({
        userId: user._id,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days TTL
        deviceLabel: req.headers['user-agent'] || 'Unknown Device'
      });
  
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

  // Admin login — sets httpOnly cookie, returns user only (no token in body)
authRouter.post(
  '/admin/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // SEC-028: Normalize email for case-insensitive lookup
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ emailNormalized: normalizedEmail });
      
      // SEC-051: Always run bcrypt to prevent timing attacks for unknown emails
      const hashToCompare = user?.passwordHash || DUMMY_HASH;
      const valid = await bcrypt.compare(password, hashToCompare);

      if (!user?.passwordHash || user.role !== 'admin') {
        await auditReq(req, {
          action: AUDIT_ACTIONS.LOGIN_FAILURE,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          outcome: 'failure',
          metadata: { reason: 'not_admin_or_not_found', email },
        });
        throw new ApiError(401, 'Invalid admin credentials');
      }

      if (!valid) {
        // SEC-025: Increment failed login attempts with progressive backoff
        const maxAttempts = 5;
        const baseLockoutMinutes = 15;
        
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        user.lastFailedLogin = new Date();
        
        if (user.failedLoginAttempts >= maxAttempts) {
          const lockoutMinutes = baseLockoutMinutes * Math.pow(2, user.failedLoginAttempts - maxAttempts);
          user.lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
          
          await user.save();
  
          await auditReq(req, {
            action: AUDIT_ACTIONS.LOGIN_FAILURE,
            resourceType: AUDIT_RESOURCE_TYPES.USER,
            resourceId: user._id,
            outcome: 'failure',
            metadata: { 
              reason: 'account_locked', 
              failedAttempts: user.failedLoginAttempts,
              lockoutMinutes,
            },
          });
        } else {
          await user.save();
          
          await auditReq(req, {
            action: AUDIT_ACTIONS.LOGIN_FAILURE,
            resourceType: AUDIT_RESOURCE_TYPES.USER,
            resourceId: user._id,
            outcome: 'failure',
            metadata: { reason: 'invalid_password', email },
          });
        }
        
        throw new ApiError(401, 'Invalid admin credentials');
      }

      // SEC-025: Check for account lockout due to failed attempts (only evaluated for valid password)
      if (user.lockUntil && user.lockUntil > new Date()) {
        const remainingMinutes = Math.ceil((user.lockUntil - new Date()) / 60000);
        await auditReq(req, {
          action: AUDIT_ACTIONS.LOGIN_FAILURE,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          resourceId: user._id,
          outcome: 'failure',
          metadata: { reason: 'account_locked', lockoutMinutes: remainingMinutes },
        });
        throw new ApiError(429, `Account temporarily locked. Try again in ${remainingMinutes} minute(s).`);
      }

    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }

    const adminToken = signAdminToken(user);
    setAdminCookie(res, adminToken);

    // Issue refresh token for admin (stored in httpOnly cookie)
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    user.refreshTokenHash = tokenHash;
    await user.save();
    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      deviceLabel: req.headers['user-agent'] || 'Unknown Device'
    });

    // Set refresh token as httpOnly cookie (path-scoped to /auth/admin)
    setAdminRefreshCookie(res, refreshToken);

    await auditReq(req, {
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
      metadata: { role: 'admin', isAdminLogin: true },
    });

    res.json({ data: { user: publicUser(user) } });
  }),
);

// Admin logout — clears cookies, revokes refresh token
authRouter.post(
  '/admin/logout',
  asyncHandler(async (req, res) => {
    clearAdminCookie(res);
    clearAdminRefreshCookie(res);
    // Revoke refresh token from cookie
    const refreshToken = req.cookies?.kredibble_admin_refresh;
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      await RefreshToken.findOneAndUpdate(
        { tokenHash, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
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

// SEC-099: User logout — revokes the refresh token (idempotent, 204)
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body || {};
    if (typeof refreshToken === 'string' && refreshToken.trim()) {
      const tokenHash = hashRefreshTokenUtil(refreshToken.trim());
      await RefreshToken.findOneAndUpdate(
        { tokenHash, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    const header = req.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      try {
        const payload = jwt.verify(token, env.jwtSecret);
        await auditReq(req, {
          action: AUDIT_ACTIONS.LOGOUT,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          resourceId: payload.sub,
          outcome: 'success',
          metadata: { isUserLogout: true },
        });
      } catch {
        // Ignore token errors during logout
      }
    }

    res.status(204).end();
  }),
);

// Admin refresh — rotates refresh token from cookie, sets new cookies
authRouter.post(
  '/admin/refresh',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.kredibble_admin_refresh;
    if (!refreshToken) {
      return res.status(401).json({ error: { message: 'Refresh token required' } });
    }
    const tokenHash = hashRefreshToken(refreshToken);

    const tokenDoc = await RefreshToken.findOne({ tokenHash }).populate('userId');
    if (!tokenDoc) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.REFRESH_TOKEN,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        outcome: 'failure',
        metadata: { reason: 'invalid_token', isAdminRefresh: true },
      });
      clearAdminCookie(res);
      clearAdminRefreshCookie(res);
      return res.status(401).json({ error: { message: 'Invalid refresh token' } });
    }

    // Reuse detection
    if (tokenDoc.revokedAt || tokenDoc.replacedBy) {
      await RefreshToken.updateMany(
        { userId: tokenDoc.userId._id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
      
      await auditReq(req, {
        action: AUDIT_ACTIONS.REFRESH_TOKEN,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: tokenDoc.userId._id,
        outcome: 'failure',
        metadata: { reason: 'token_reused_revoked_family', isAdminRefresh: true },
      });
      clearAdminCookie(res);
      clearAdminRefreshCookie(res);
      return res.status(401).json({ error: { message: 'Refresh token revoked, please login again' } });
    }

    if (tokenDoc.expiresAt < new Date()) {
      clearAdminCookie(res);
      clearAdminRefreshCookie(res);
      return res.status(401).json({ error: { message: 'Refresh token expired' } });
    }

    const user = tokenDoc.userId;
    if (!user || user.role !== 'admin' || user.role === 'deleted') {
      clearAdminCookie(res);
      clearAdminRefreshCookie(res);
      return res.status(401).json({ error: { message: 'Invalid admin session' } });
    }

    // Rotate: generate new tokens
    const adminToken = signAdminToken(user);
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashRefreshToken(newRefreshToken);
    
    tokenDoc.revokedAt = new Date();
    tokenDoc.replacedBy = newTokenHash;
    await tokenDoc.save();
    
    user.refreshTokenHash = newTokenHash;
    await user.save();
    
    await RefreshToken.create({
      userId: user._id,
      tokenHash: newTokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      deviceLabel: req.headers['user-agent'] || 'Unknown Device'
    });

    // Set new cookies
    setAdminCookie(res, adminToken);
    setAdminRefreshCookie(res, newRefreshToken);

    await auditReq(req, {
      action: AUDIT_ACTIONS.REFRESH_TOKEN,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
      metadata: { role: 'admin', isAdminRefresh: true },
    });

    res.json({ data: { user: publicUser(user) } });
  }),
);

// Admin session check — validates admin cookie and returns user
authRouter.get(
  '/admin/me',
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth.sub).select('-passwordHash -refreshTokenHash -tokenVersion').lean();
    if (!user || user.role !== 'admin' || user.role === 'deleted') {
      return res.status(401).json({ error: { message: 'Invalid admin session' } });
    }
    res.json({ data: publicUser(user) });
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
  emailVerificationLimiter,
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '');
    const normalizedEmail = normalizeEmail(email);
    
    const record = await EmailVerificationCode.findOneAndUpdate(
      { email: normalizedEmail, expiresAt: { $gt: new Date() } },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after', sort: { createdAt: -1 } }
    );
    
    if (!record) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.EMAIL_VERIFY,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        outcome: 'failure',
        metadata: { step: 'verify_code', reason: 'not_found_or_expired', email: normalizedEmail },
      });
      throw new ApiError(400, 'Invalid or expired verification code');
    }
    
    if (record.attempts > 5) {
      await EmailVerificationCode.deleteOne({ _id: record._id });
      throw new ApiError(400, 'Too many failed attempts. Please request a new code.');
    }
    
    if (record.codeHash !== hashVerificationCode(code)) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.EMAIL_VERIFY,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        outcome: 'failure',
        metadata: { step: 'verify_code', reason: 'invalid_code', email: normalizedEmail, attempts: record.attempts },
      });
      throw new ApiError(400, 'Invalid verification code');
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

const PASSWORD_RESET_TTL_MINUTES = 10;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;

/**
 * Sign out every device: access tokens fail the tokenVersion check and refresh
 * tokens are gone. The caller saves `user`.
 */
const revokeAllSessions = async (user) => {
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.refreshTokenHash = null;
  await RefreshToken.deleteMany({ userId: user._id });
  disconnectUserSockets(user._id);
};

/** Constant-time comparison of two hex digests. */
const hashesMatch = (a, b) => {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

// SEC-083: request a reset code. Always 202 with the same body, so the response
// never reveals whether the email is registered. Admin accounts are recovered
// with scripts/create-admin.js, not by email.
authRouter.post(
  '/password/forgot',
  forgotPasswordLimiter,
  forgotPasswordEmailLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({
      emailNormalized: normalizeEmail(req.body.email),
      role: { $in: PUBLIC_ROLES },
    });

    if (user) {
      const code = createVerificationCode();
      await PasswordResetCode.deleteMany({ userId: user._id });
      await PasswordResetCode.create({
        userId: user._id,
        codeHash: hashVerificationCode(code),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
      });
      // Not awaited: a slower response for registered emails would reveal which ones exist.
      sendPasswordResetEmail(user.email, code, PASSWORD_RESET_TTL_MINUTES).catch((error) => {
        logger.error({ err: error.message, userId: String(user._id) }, 'Password reset email failed');
      });
    }

    await auditReq(req, {
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user?._id,
      outcome: user ? 'success' : 'failure',
      metadata: user ? {} : { reason: 'unknown_email' },
    });

    res.status(202).json({
      data: {
        message: 'If that email is registered, a reset code is on its way.',
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      },
    });
  }),
);

// SEC-083: set a new password with the emailed code. Every failure gives the
// same message, including the attempt cap, so it can't be used to find accounts.
authRouter.post(
  '/password/reset',
  passwordResetAttemptLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { code, newPassword } = req.body;
    const invalidCode = () => new ApiError(400, 'Invalid or expired reset code');

    const user = await User.findOne({
      emailNormalized: normalizeEmail(req.body.email),
      role: { $in: PUBLIC_ROLES },
    });
    if (!user) throw invalidCode();

    const record = await PasswordResetCode.findOneAndUpdate(
      { userId: user._id, expiresAt: { $gt: new Date() } },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after', sort: { createdAt: -1 } },
    );
    if (!record) throw invalidCode();

    if (record.attempts > PASSWORD_RESET_MAX_ATTEMPTS) {
      await PasswordResetCode.deleteMany({ userId: user._id });
      await auditReq(req, {
        action: AUDIT_ACTIONS.PASSWORD_RESET,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: user._id,
        outcome: 'failure',
        metadata: { reason: 'attempt_cap' },
      });
      throw invalidCode();
    }

    if (!hashesMatch(record.codeHash, hashVerificationCode(code))) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.PASSWORD_RESET,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: user._id,
        outcome: 'failure',
        metadata: { reason: 'invalid_code', attempts: record.attempts },
      });
      throw invalidCode();
    }

    // Consume the code before changing anything: of two requests racing with the
    // same code, only the one that deletes it goes on.
    const { deletedCount } = await PasswordResetCode.deleteOne({ _id: record._id });
    if (deletedCount !== 1) throw invalidCode();

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastFailedLogin = null;
    await revokeAllSessions(user);
    await user.save();

    await auditReq(req, {
      action: AUDIT_ACTIONS.PASSWORD_RESET,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
    });

    itemResponse(res, { message: 'Password updated. Sign in with your new password.' });
  }),
);

// SEC-084: change the password while signed in. Signs out every other device and
// hands this one a fresh session. A wrong current password is 400, not 401: the
// mobile client reads 401 as an expired session and signs the user out.
authRouter.post(
  '/password',
  requireAuth,
  reauthLimiter,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.auth.sub);
    if (!user?.passwordHash) throw new ApiError(404, 'User not found');

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.PASSWORD_CHANGE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: user._id,
        outcome: 'failure',
        metadata: { reason: 'invalid_current_password' },
      });
      throw new ApiError(400, 'Current password is incorrect');
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new ApiError(400, 'New password must be different from the current one');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await revokeAllSessions(user);
    const session = await issueSession(user, req);

    await auditReq(req, {
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
    });

    itemResponse(res, session);
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

// SEC-029: GDPR/CCPA Data Export
// Returns a JSON archive of the user's data. Grant applications and reports
// store no user id, so they aren't included yet (SEC-060).
authRouter.get(
  '/me/export',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.sub;
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    const where = await userDataFilters(user);
    const [
      seekerProfile, hirerAccount, applications, grantApplications, eventBookings, companyVerifications, verificationDocs,
      savedItems, channelMemberships, communityPosts, channels, opportunities, testimonials, sessions,
    ] = await Promise.all([
      SeekerProfile.findOne(where.seekerProfile).lean(),
      HirerAccount.findOne(where.hirerAccount).lean(),
      Applicant.find(where.applications).lean(),
      GrantApplication.find(where.grantApplications).lean(),
      EventAttendee.find(where.eventBookings).lean(),
      CompanyVerification.find(where.companyVerifications).lean(),
      VerificationDoc.find(where.verificationDocs).lean(),
      SavedItem.find(where.savedItems).lean(),
      CommunityMembership.find(where.channelMemberships).lean(),
      ChannelPost.find(where.communityPosts).lean(),
      Channel.find(where.channels).lean(),
      Opportunity.find(where.opportunities).lean(),
      Testimonial.find(where.testimonials).lean(),
      // Device and dates only: token hashes stay on the server.
      RefreshToken.find(where.sessions).select('deviceLabel createdAt expiresAt revokedAt').lean(),
    ]);

    const exportData = {
      user: publicUser(user),
      seekerProfile,
      hirerAccount,
      applications,
      grantApplications,
      eventBookings,
      companyVerifications,
      verificationDocs,
      savedItems,
      channelMemberships,
      communityPosts,
      channels,
      opportunities,
      testimonials,
      sessions,
      exportedAt: new Date().toISOString(),
    };

    await auditReq(req, {
      action: AUDIT_ACTIONS.DATA_EXPORT,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: userId,
      outcome: 'success',
      metadata: { exportType: 'full' },
    });

    res.set('Content-Type', 'application/json');
    res.set('Content-Disposition', `attachment; filename="kredibble-export-${userId}-${Date.now()}.json"`);
    res.send(JSON.stringify(exportData, null, 2));
  }),
);

// SEC-065: erase the account. Needs the password and a typed confirmation.
// A wrong password is 400, not 401: the mobile client reads 401 as an expired
// session and would sign the user out.
authRouter.delete(
  '/me',
  requireAuth,
  reauthLimiter,
  validate(deleteAccountSchema),
  asyncHandler(async (req, res) => {
    const { password } = req.body;

    const userId = req.auth.sub;
    const user = await User.findById(userId).select('+passwordHash');
    if (!user?.passwordHash) throw new ApiError(404, 'User not found');

    // Admin accounts are removed by another admin, not erased from the app.
    if (user.role === 'admin' || req.auth.role === 'admin') {
      throw new ApiError(403, 'Admin accounts cannot be deleted from the app');
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.ACCOUNT_DELETE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: userId,
        outcome: 'failure',
        metadata: { reason: 'invalid_password' },
      });
      throw new ApiError(400, 'Incorrect password');
    }

    let deletedAt;
    try {
      ({ deletedAt } = await deleteAccount(user));
      disconnectUserSockets(userId);
    } catch (error) {
      disconnectUserSockets(userId);
      // Before access is cut nothing is promised: let it surface as a 500.
      if (!error.accountClosed) throw error;
      logger.error({ err: error.message, userId }, 'Account deletion did not finish');
    }
    const status = deletedAt ? 'completed' : 'pending';

    await auditReq(req, {
      action: AUDIT_ACTIONS.ACCOUNT_DELETE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: userId,
      outcome: 'success',
      metadata: { reason: 'user_request', status },
    });

    if (status === 'pending') {
      // The hourly completePendingDeletions run finishes the rest.
      return res.status(202).json({
        data: {
          status,
          message: 'Your account is closed. Removing the rest of your data is taking longer than usual and will finish automatically.',
        },
      });
    }
    res.json({ data: { message: 'Your account and personal data have been deleted.', deletedAt, status } });
  }),
);