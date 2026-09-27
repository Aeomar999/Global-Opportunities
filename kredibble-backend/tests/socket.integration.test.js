import { io as ClientIO } from 'socket.io-client';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { initSocket } from '../src/socket.js';
import { signToken } from '../src/middleware/auth.js';
import { User } from '../src/models/User.js';

const makeUser = async ({ role = 'seeker', email = 'user@example.com' } = {}) => {
  const user = await User.create({ name: 'Test User', email, role, passwordHash: 'x' });
  return { user, token: signToken(user) };
};

describe('SEC-004: Socket.io transport authentication and room isolation', () => {
  let server;
  let serverUrl;
  let io;

  beforeAll(async () => {
    server = http.createServer(app);
    io = initSocket(server);
    await new Promise((resolve) => server.listen(0, resolve));
    const addr = server.address();
    serverUrl = `http://localhost:${addr.port}`;
  }, 15000);

  afterAll(async () => {
    io.close();
    await new Promise((resolve) => server.close(resolve));
    server.unref();
  }, 10000);

  const connectSocket = (token) => {
    return new Promise((resolve, reject) => {
      const socket = ClientIO(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        forceNew: true,
        timeout: 10000,
      });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
      setTimeout(() => reject(new Error('Connection timeout')), 12000);
    });
  };

  describe('handshake authentication', () => {
    it('rejects connection without a token', async () => {
      await expect(connectSocket(null)).rejects.toThrow('UNAUTHORIZED: authentication token is required');
    });

    it('rejects connection with an invalid token', async () => {
      await expect(connectSocket('not.a.valid.token')).rejects.toThrow('UNAUTHORIZED: authentication token is invalid or expired');
    });

    it('rejects connection with an expired token', async () => {
      const expired = jwt.sign({ sub: 'dead', role: 'seeker' }, 'wrong-secret', { expiresIn: '-1h' });
      await expect(connectSocket(expired)).rejects.toThrow('UNAUTHORIZED');
    });

    it('accepts connection with a valid token and populates socket.data.auth', async () => {
      const { user, token } = await makeUser({ role: 'hirer', email: 'hirer@socket.test' });
      const socket = await connectSocket(token);
      expect(socket.connected).toBe(true);
      socket.disconnect();
      await new Promise(r => setTimeout(r, 50));
    });
  });

  describe('join_user room pinning', () => {
    it('allows joining own user room (ack=true)', async () => {
      const { user, token } = await makeUser({ email: 'join-own@socket.test' });
      const socket = await connectSocket(token);
      const ack = await new Promise((resolve) => socket.emit('join_user', user.id, resolve));
      expect(ack).toBe(true);
      socket.disconnect();
      await new Promise(r => setTimeout(r, 50));
    }, 10000);

    it('denies joining another user room (ack=false)', async () => {
      const { user: userA } = await makeUser({ email: 'user-a@socket.test' });
      const { user: userB, token } = await makeUser({ email: 'user-b@socket.test' });
      const socket = await connectSocket(token);
      const ack = await new Promise((resolve) => socket.emit('join_user', userA.id, resolve));
      expect(ack).toBe(false);
      socket.disconnect();
      await new Promise(r => setTimeout(r, 50));
    }, 10000);
  });

  describe('join_channel and send_message', () => {
    it('allows joining any channel (ack=true)', async () => {
      const { token } = await makeUser({ email: 'channel-join@socket.test' });
      const socket = await connectSocket(token);
      const ack = await new Promise((resolve) => socket.emit('join_channel', 'channel-123', resolve));
      expect(ack).toBe(true);
      socket.disconnect();
      await new Promise(r => setTimeout(r, 50));
    }, 10000);

    it('denies send_message to a channel not joined (ack=false)', async () => {
      const { token } = await makeUser({ email: 'send-denied@socket.test' });
      const socket = await connectSocket(token);
      const ack = await new Promise((resolve) => socket.emit('send_message', { channelId: 'channel-999', message: 'hi' }, resolve));
      expect(ack).toBe(false);
      socket.disconnect();
      await new Promise(r => setTimeout(r, 50));
    }, 10000);

    it('broadcasts send_message to joined channel members', async () => {
      const { token: tokenA } = await makeUser({ email: 'sender@socket.test' });
      const { token: tokenB } = await makeUser({ email: 'receiver@socket.test' });
      const socketA = await connectSocket(tokenA);
      const socketB = await connectSocket(tokenB);

      await new Promise((resolve) => socketA.emit('join_channel', 'channel-shared', resolve));
      await new Promise((resolve) => socketB.emit('join_channel', 'channel-shared', resolve));

      const received = [];
      socketB.on('receive_message', (msg) => received.push(msg));

      const ack = await new Promise((resolve) => socketA.emit('send_message', { channelId: 'channel-shared', message: 'hello room' }, resolve));
      expect(ack).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(received).toContain('hello room');

      socketA.disconnect();
      socketB.disconnect();
      await new Promise(r => setTimeout(r, 50));
    }, 15000);
  });
});