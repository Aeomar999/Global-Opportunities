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
  audience: { type: String, required: true, index: true }, // e.g. seekers, hirers, all
  sentAt: String,
}, { timestamps: true });

// SEC-031: Compound index for user notifications (userId + createdAt)
notificationSchema.index({ createdAt: -1 });

export const Article = mongoose.model('Article', articleSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
