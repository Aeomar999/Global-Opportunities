import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './config/env.js';
import { socketCorsOptions } from './lib/cors.js';
import { Channel, CommunityMembership } from './models/Community.js';
import { User } from './models/User.js';
import logger from './lib/logger.js';

let io;

export const disconnectUserSockets = (userId) => {
  if (!io || !userId) return;
  io.in(`user_${userId}`).disconnectSockets(true);
};

/**
 * Resolve the caller's identity from the handshake. Socket.io browsers cannot set
 * an Authorization header on the polling transport, so the token is read from
 * `auth.token` (set via `io(url, { auth: { token } })`) and the header is accepted
 * as a fallback for non-browser clients.
 */
const extractToken = (socket) => {
  const fromAuth = socket.handshake?.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth) return fromAuth.replace(/^Bearer\s+/i, '');
  const header = socket.handshake?.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
  return null;
};

const canAccessChannel = async (channel, user) => {
  if (channel.visibility === 'public' || user.role === 'admin' || String(channel.createdBy) === String(user.sub)) return true;
  const membership = await CommunityMembership.findOne({ channelId: channel._id, userId: user.sub, status: 'active' });
  return Boolean(membership || channel.memberIds.some((id) => String(id) === String(user.sub)));
};

export const initSocket = (server) => {
  io = new Server(server, socketCorsOptions());

  // SEC-004: the transport was previously unauthenticated with `cors: "*"`, so any
  // origin could open a socket and join any room. Authenticate the handshake
  // before a connection is accepted, and reuse the HTTP signing key so there is
  // one notion of "a valid session" across REST and realtime.
  // SEC-098: also verify that the account is active and tokenVersion has not been bumped.
  io.use(async (socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      next(new Error('UNAUTHORIZED: authentication token is required'));
      return;
    }
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.sub).select('tokenVersion role').lean();
      if (!user || user.role === 'deleted') {
        return next(new Error('UNAUTHORIZED: Account no longer active'));
      }
      if (payload.tv !== undefined && payload.tv !== user.tokenVersion) {
        return next(new Error('UNAUTHORIZED: Token revoked due to security event'));
      }

      socket.data.auth = { sub: String(payload.sub), role: payload.role };
      next();
    } catch (err) {
      if (err.message && err.message.startsWith('UNAUTHORIZED:')) {
        return next(err);
      }
      next(new Error('UNAUTHORIZED: authentication token is invalid or expired'));
    }
  });

  io.on('connection', (socket) => {
    const auth = socket.data.auth;
    // SEC-098: Auto-join personal room for immediate eviction & delivery
    socket.join(`user_${auth.sub}`);
    logger.info({ socketId: socket.id, role: auth.role, userId: auth.sub }, 'Socket connected');

    // Personal room. Joining is pinned to the authenticated identity: a caller
    // must not be able to subscribe to someone else's direct messages by
    // supplying their user id.
    socket.on('join_user', (userId, ack) => {
      if (String(userId) !== auth.sub) {
        logger.warn({ socketId: socket.id, requestedUserId: userId, authSub: auth.sub }, 'Socket denied join_user');
        if (typeof ack === 'function') ack(false);
        return;
      }
      socket.join(`user_${auth.sub}`);
      logger.info({ socketId: socket.id, userId: auth.sub }, 'Socket joined user room');
      if (typeof ack === 'function') ack(true);
    });

    // Chat channels. Membership is verified against the database.
    socket.on('join_channel', async (channelId, ack) => {
      try {
        const channel = await Channel.findById(channelId);
        if (!channel || !await canAccessChannel(channel, auth)) {
          logger.warn({ socketId: socket.id, channelId, userId: auth.sub }, 'Socket denied join_channel');
          if (typeof ack === 'function') ack({ ok: false, error: 'Channel access denied' });
          return;
        }
        socket.join(`channel_${channel._id}`);
        logger.info({ socketId: socket.id, channelId }, 'Socket joined channel');
        if (typeof ack === 'function') ack({ ok: true });
      } catch {
        logger.warn({ socketId: socket.id, channelId }, 'Socket join_channel error');
        if (typeof ack === 'function') ack({ ok: false, error: 'Channel access denied' });
      }
    });

    socket.on('send_message', (data, ack) => {
      const { channelId, message } = data || {};
      const room = `channel_${channelId}`;
      // Only broadcast into a room this socket actually joined. Without this a
      // client could emit into any channel id without ever subscribing to it.
      if (!socket.rooms.has(room)) {
        logger.warn({ socketId: socket.id, room }, 'Socket denied send_message');
        if (typeof ack === 'function') ack(false);
        return;
      }
      io.to(room).emit('receive_message', message);
      if (typeof ack === 'function') ack(true);
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Socket disconnected');
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
};