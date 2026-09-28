import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './config/env.js';
import { socketCorsOptions } from './lib/cors.js';

let io;

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

export const initSocket = (server) => {
  io = new Server(server, socketCorsOptions());

  // SEC-004: the transport was previously unauthenticated with `cors: "*"`, so any
  // origin could open a socket and join any room. Authenticate the handshake
  // before a connection is accepted, and reuse the HTTP signing key so there is
  // one notion of "a valid session" across REST and realtime.
  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      next(new Error('UNAUTHORIZED: authentication token is required'));
      return;
    }
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      socket.data.auth = { sub: String(payload.sub), role: payload.role };
      next();
    } catch {
      next(new Error('UNAUTHORIZED: authentication token is invalid or expired'));
    }
  });

  io.on('connection', (socket) => {
    const auth = socket.data.auth;
    console.log('Socket connected:', socket.id, auth.role);

    // Personal room. Joining is pinned to the authenticated identity: a caller
    // must not be able to subscribe to someone else's direct messages by
    // supplying their user id.
    socket.on('join_user', (userId, ack) => {
      if (String(userId) !== auth.sub) {
        console.warn(`Socket ${socket.id} denied join_user for ${userId}`);
        if (typeof ack === 'function') ack(false);
        return;
      }
      socket.join(`user_${auth.sub}`);
      console.log(`Socket ${socket.id} joined room user_${auth.sub}`);
      if (typeof ack === 'function') ack(true);
    });

    // Chat channels. Membership is not modelled in the database yet, so any
    // authenticated user may join, matching the authenticated read policy on
    // GET /api/community/channels/:channelId/posts.
    socket.on('join_channel', (channelId, ack) => {
      socket.join(`channel_${channelId}`);
      console.log(`Socket ${socket.id} joined channel_${channelId}`);
      if (typeof ack === 'function') ack(true);
    });

    socket.on('send_message', (data, ack) => {
      const { channelId, message } = data || {};
      const room = `channel_${channelId}`;
      // Only broadcast into a room this socket actually joined. Without this a
      // client could emit into any channel id without ever subscribing to it.
      if (!socket.rooms.has(room)) {
        console.warn(`Socket ${socket.id} denied send_message to ${room}`);
        if (typeof ack === 'function') ack(false);
        return;
      }
      io.to(room).emit('receive_message', message);
      if (typeof ack === 'function') ack(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
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
