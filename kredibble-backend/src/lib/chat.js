import { ChannelMessage } from '../models/Community.js';
import { emitToRoom } from '../socket.js';

/**
 * Channel messages work like WhatsApp Channels:
 *  - a TOP-LEVEL message (no parentId) is an announcement, and only channel admins can post one;
 *  - the poster decides per message whether members may reply (`allowReplies`);
 *  - a REPLY (has parentId) is allowed for members only while its parent has `allowReplies` switched on.
 */
export const toChatMessage = (message, replyCount = 0) => ({
  id: String(message._id),
  channelId: String(message.channelId),
  parentId: message.parentId ? String(message.parentId) : null,
  senderId: String(message.senderId),
  senderName: message.senderName,
  senderRole: message.senderRole,
  body: message.body,
  allowReplies: Boolean(message.allowReplies),
  replyCount,
  createdAt: message.createdAt,
});

/** Persist one message and broadcast the saved record to everyone in the channel room. */
export const postChannelMessage = async ({ channel, sender, body, parentId = null, allowReplies = false }) => {
  const message = await ChannelMessage.create({
    channelId: channel._id,
    senderId: sender._id,
    senderName: sender.name || 'Member',
    senderRole: sender.role === 'admin' || sender.role === 'hirer' ? sender.role : 'seeker',
    body,
    parentId: parentId || undefined,
    // Only an announcement can accept replies; a reply never opens a new thread.
    allowReplies: parentId ? false : Boolean(allowReplies),
  });
  const payload = toChatMessage(message);
  emitToRoom(`channel_${channel._id}`, 'chat_message', payload);
  return payload;
};

const countReplies = async (ids) => {
  if (ids.length === 0) return new Map();
  const rows = await ChannelMessage.aggregate([
    { $match: { parentId: { $in: ids } } },
    { $group: { _id: '$parentId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
};

/** Newest page of announcements (top-level messages), returned oldest-first, each with its reply count. */
export const listChannelMessages = async (channelId, { before, limit = 50 } = {}) => {
  const filter = { channelId, parentId: null };
  if (before) {
    const date = new Date(before);
    if (!Number.isNaN(date.getTime())) filter.createdAt = { $lt: date };
  }
  const rows = await ChannelMessage.find(filter).sort({ createdAt: -1 }).limit(Math.min(Math.max(Number(limit) || 50, 1), 100)).lean();
  const counts = await countReplies(rows.map((row) => row._id));
  return rows.reverse().map((row) => toChatMessage(row, counts.get(String(row._id)) || 0));
};

/** One announcement and the replies under it (oldest first). Null when the message is not a top-level post of this channel. */
export const getThread = async (channelId, messageId) => {
  const post = await ChannelMessage.findOne({ _id: messageId, channelId, parentId: null }).lean();
  if (!post) return null;
  const replies = await ChannelMessage.find({ channelId, parentId: post._id }).sort({ createdAt: 1 }).limit(500).lean();
  return { post: toChatMessage(post, replies.length), replies: replies.map((row) => toChatMessage(row)) };
};

/** Finds a top-level message of a channel (the parent of a reply, or the target of a setting change). */
export const findPost = (channelId, messageId) => ChannelMessage.findOne({ _id: messageId, channelId, parentId: null });

/** Switches replies on or off for one announcement and tells everyone in the channel. */
export const setAllowReplies = async (channelId, messageId, allowReplies) => {
  const post = await findPost(channelId, messageId);
  if (!post) return null;
  post.allowReplies = Boolean(allowReplies);
  await post.save();
  const replyCount = await ChannelMessage.countDocuments({ parentId: post._id });
  const payload = toChatMessage(post, replyCount);
  emitToRoom(`channel_${channelId}`, 'chat_message_updated', payload);
  return payload;
};
