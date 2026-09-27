import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../schemas/auth.js';
import { ApiError, asyncHandler, itemResponse } from '../utils/http.js';
import { User } from '../models/User.js';
import { SeekerProfile, HirerAccount } from '../models/Profiles.js';

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

// Second gate behind registerSchema. Even if validation were ever relaxed or
// bypassed, an anonymous request can never persist the 'admin' role.
const PUBLIC_ROLES = ['seeker', 'hirer'];

authRouter.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const role = PUBLIC_ROLES.includes(req.body.role) ? req.body.role : 'seeker';

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
