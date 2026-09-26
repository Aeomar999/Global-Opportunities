import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../schemas/auth.js';
import { ApiError, asyncHandler, itemResponse } from '../utils/http.js';
import { User } from '../models/User.js';
import { EmailVerificationCode } from '../models/User.js';
import { SeekerProfile, HirerAccount } from '../models/Profiles.js';
import { createVerificationCode, hashVerificationCode, sendVerificationEmail } from '../lib/email.js';
import { env } from '../config/env.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: { message: 'Too many requests from this IP, please try again after 15 minutes' } },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

authRouter.use(authLimiter);

const publicUser = (user) => {
  if (!user) return null;
  const userObj = user.toJSON ? user.toJSON() : user;
  const { passwordHash, _id, __v, ...safeUser } = userObj;
  return { id: _id, ...safeUser };
};

authRouter.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) throw new ApiError(409, 'User already exists');

    const passwordHash = await bcrypt.hash(password, 12);

    const user = new User({
      name,
      email,
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

    res.status(201).json({ data: { user: publicUser(user), token: signToken(user) } });
  }),
);

authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user?.passwordHash) throw new ApiError(401, 'Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new ApiError(401, 'Invalid email or password');

    // Mongoose handles population easily if defined, but for now manual fetch for exact structure
    let profile = null;
    if (user.role === 'seeker') profile = await SeekerProfile.findOne({ userId: user._id });
    if (user.role === 'hirer') profile = await HirerAccount.findOne({ userId: user._id });

    const finalUser = user.toObject();
    finalUser[user.role] = profile;

    res.json({ data: { user: publicUser(finalUser), token: signToken(user) } });
  }),
);

authRouter.post('/verification-code/send', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, 'A valid email is required');

  const code = createVerificationCode();
  await EmailVerificationCode.deleteMany({ email });
  await EmailVerificationCode.create({
    email,
    codeHash: hashVerificationCode(code),
    expiresAt: new Date(Date.now() + env.emailVerificationCodeTtlMinutes * 60 * 1000),
  });
  await sendVerificationEmail(email, code);
  res.status(202).json({ data: { email, expiresInMinutes: env.emailVerificationCodeTtlMinutes } });
}));

authRouter.post('/verification-code/verify', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '');
  const record = await EmailVerificationCode.findOne({ email, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!record || record.codeHash !== hashVerificationCode(code)) throw new ApiError(400, 'Invalid or expired verification code');
  await User.updateOne({ email }, { emailVerified: true });
  await EmailVerificationCode.deleteMany({ email });
  itemResponse(res, { email, verified: true });
}));

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
