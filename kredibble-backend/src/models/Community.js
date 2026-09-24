import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  hirerId: { type: mongoose.Schema.Types.ObjectId, ref: 'HirerAccount' },
  name: { type: String, required: true },
  owner: { type: String, default: 'Public' },
  category: { type: String, required: true },
  followers: String,
  postsCount: { type: Number, default: 0 },
  status: { type: String, default: 'active', index: true },
  avatar: { type: String },
  bio: { type: String },
}, { timestamps: true });

const channelPostSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
  authorName: { type: String, required: true },
  body: { type: String, required: true },
  title: { type: String },
  bannerImage: { type: String },
  link: { type: String },
  linkText: { type: String },
  hasRespondButton: { type: Boolean, default: false },
  reactions: { type: mongoose.Schema.Types.Mixed, default: [] },
  date: String,
  flagged: { type: Boolean, default: false },
}, { timestamps: true });

const reportSchema = new mongoose.Schema({
  targetType: { type: String, required: true }, // e.g. post, profile
  targetLabel: String,
  reporterName: String,
  reason: { type: String, required: true },
  details: String,
  date: String,
  status: { type: String, default: 'open', index: true },
  linkedChannelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' },
}, { timestamps: true });

export const Channel = mongoose.model('Channel', channelSchema);
export const ChannelPost = mongoose.model('ChannelPost', channelPostSchema);
export const Report = mongoose.model('Report', reportSchema);
