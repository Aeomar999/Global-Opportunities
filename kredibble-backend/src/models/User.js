import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  role: { type: String, required: true, enum: ['seeker', 'hirer', 'admin'] },
  passwordHash: { type: String },
  avatarUrl: { type: String },
  emailVerified: { type: Boolean, default: false },
}, { timestamps: true });

// Virtuals to mimic the previous Prisma/Native structure for the frontend
userSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

userSchema.set('toJSON', { virtuals: true });

const staffMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, required: true }, // e.g. SUPER_ADMIN, MODERATOR
  status: { type: String, default: 'active' },
  joinedDate: String,
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const StaffMember = mongoose.model('StaffMember', staffMemberSchema);

const emailVerificationCodeSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const EmailVerificationCode = mongoose.model('EmailVerificationCode', emailVerificationCodeSchema);

const savedItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemType: { type: String, enum: ['opportunities', 'events', 'grants', 'internships'], required: true }
}, { timestamps: true });

export const SavedItem = mongoose.model('SavedItem', savedItemSchema);

