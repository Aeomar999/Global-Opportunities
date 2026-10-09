import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema({
  category: { type: String, required: true, index: true },
  title: { type: String, required: true, index: true },
  duration: String,
  summary: { type: String, required: true },
  content: { type: String, required: true },
  status: { type: String, default: 'draft', index: true },
  bannerImage: String,
}, { timestamps: true });

// SEC-031: Text index for search on title, category
articleSchema.index({ title: 'text', category: 'text' });

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  message: { type: String, required: true, index: true },
  audience: { type: String, required: true, index: true }, // e.g. seekers, hirers, all, both
  type: { type: String, default: 'general' },
  priority: { type: String, default: 'normal' },
  isActive: { type: Boolean, default: true, index: true },
  sentAt: String,
  // Per-user notifications (for example an ambassador decision). Broadcasts leave this empty.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  readAt: Date,
}, { timestamps: true });

// SEC-031: Compound index for notifications
notificationSchema.index({ createdAt: -1 });

export const Article = mongoose.model('Article', articleSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
