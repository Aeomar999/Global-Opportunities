import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { Channel, CommunityMembership } from './models/Community.js';

let io;

const localDevOriginPattern =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

const isAllowedOrigin = (origin) =>
  !origin || env.corsOrigins.includes(origin) || (env.isDevelopment && localDevOriginPattern.test(origin));

const canAccessChannel = async (channel, user) => {
  if (channel.visibility === 'public' || user.role === 'admin' || String(channel.createdBy) === String(user.sub)) return true;
  const membership = await CommunityMembership.findOne({ channelId: channel._id, userId: user.sub, status: 'active' });
  return Boolean(membership || channel.memberIds.some((id) => String(id) === String(user.sub)));
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        const allowed = isAllowedOrigin(origin);
        callback(allowed ? null : new Error('Origin is not allowed by CORS'), allowed);
      },
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const bearer = socket.handshake.headers.authorization;
    const token = socket.handshake.auth?.token || (bearer?.startsWith('Bearer ') ? bearer.slice(7) : null);
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.data.auth = jwt.verify(token, env.jwtSecret);
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.auth;
    socket.join(`user_${user.sub}`);

    socket.on('join_channel', async (channelId, acknowledge = () => {}) => {
      try {
        const channel = await Channel.findById(channelId);
        if (!channel || !await canAccessChannel(channel, user)) {
          return acknowledge({ ok: false, error: 'Channel access denied' });
        }
        socket.join(`channel_${channel._id}`);
        acknowledge({ ok: true });
      } catch {
        acknowledge({ ok: false, error: 'Channel access denied' });
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket.io is not initialized');
  return io;
};
