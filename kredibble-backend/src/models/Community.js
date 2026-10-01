import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  hirerId: { type: mongoose.Schema.Types.ObjectId, ref: 'HirerAccount', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, required: true, index: true },
  owner: { type: String, default: 'Public' },
  category: { type: String, required: true, index: true },
  followers: String,
  postsCount: { type: Number, default: 0 },
  status: { type: String, default: 'active', index: true },
  avatar: { type: String },
  bio: { type: String },
  visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
  requiresApproval: { type: Boolean, default: false },
  memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Legacy member records
  pinnedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChannelPost', default: null },
}, { timestamps: true });

// SEC-031: Text index for search on name, category
channelSchema.index({ name: 'text', category: 'text' });

const communityMembershipSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['member', 'admin'], default: 'member' },
  status: { type: String, enum: ['pending', 'active', 'removed', 'banned'], default: 'pending', index: true },
  application: {
    message: String,
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  bannedReason: String,
}, { timestamps: true });

communityMembershipSchema.index({ channelId: 1, userId: 1 }, { unique: true });

const channelPostSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
  authorName: { type: String, required: true, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  body: { type: String, required: true },
  title: { type: String, index: true },
  bannerImage: { type: String },
  link: { type: String },
  linkText: { type: String },
  hasRespondButton: { type: Boolean, default: false },
  reactions: { type: mongoose.Schema.Types.Mixed, default: [] },
  date: String,
  flagged: { type: Boolean, default: false },
  pinnedAt: { type: Date, default: null },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// SEC-031: Text index for search on title, body
channelPostSchema.index({ title: 'text', body: 'text' });

const reportSchema = new mongoose.Schema({
  targetType: { type: String, required: true, index: true }, // e.g. post, profile
  targetLabel: { type: String, index: true },
  reporterName: { type: String, index: true },
  reason: { type: String, required: true, index: true },
  details: { type: String, index: true },
  date: String,
  status: { type: String, default: 'open', index: true },
  linkedChannelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', index: true },
}, { timestamps: true });

// SEC-031: Text index for search on reason, details
reportSchema.index({ reason: 'text', details: 'text' });

export const Channel = mongoose.model('Channel', channelSchema);
export const ChannelPost = mongoose.model('ChannelPost', channelPostSchema);
export const CommunityMembership = mongoose.model('CommunityMembership', communityMembershipSchema);
export const Report = mongoose.model('Report', reportSchema);