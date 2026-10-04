import { io as ClientIO } from 'socket.io-client';
import http from 'http';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { initSocket } from '../src/socket.js';
import { signToken } from '../src/middleware/auth.js';
import { User } from '../src/models/User.js';
import { Channel, CommunityMembership } from '../src/models/Community.js';

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

  // A rejected handshake must close its client. socket.io-client reconnects
  // forever by default, and those retry timers kept the process alive after the
  // suite finished whenever Jest ran in-band (as it does on 2-core CI runners).
  const connectSocket = (token) => {
    return new Promise((resolve, reject) => {
      const socket = ClientIO(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: false,
        timeout: 10000,
      });
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('Connection timeout'));
      }, 12000);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        socket.close();
        reject(err);
      });
    });
  };

  const emitWithAck = (socket, event, payload) =>
    new Promise((resolve) => socket.emit(event, payload, resolve));

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
      const { token } = await makeUser({ role: 'hirer', email: 'hirer@socket.test' });
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
      const { token } = await makeUser({ email: 'user-b@socket.test' });
      const socket = await connectSocket(token);
      const ack = await new Promise((resolve) => socket.emit('join_user', userA.id, resolve));
      expect(ack).toBe(false);
      socket.disconnect();
      await new Promise(r => setTimeout(r, 50));
    }, 10000);
  });

  describe('join_channel and send_message', () => {
    // Channel membership is verified against the database, so joins name a real
    // channel and the ack is `{ ok }` rather than a bare boolean.
    it('allows joining a public channel', async () => {
      const { token } = await makeUser({ email: 'channel-join@socket.test' });
      const channel = await Channel.create({ name: 'Open room', category: 'General', visibility: 'public' });
      const socket = await connectSocket(token);
      const ack = await emitWithAck(socket, 'join_channel', channel.id);
      expect(ack).toEqual({ ok: true });
      socket.disconnect();
      await new Promise(r => setTimeout(r, 50));
    }, 10000);

    it('denies joining a private channel without membership', async () => {
      const { token } = await makeUser({ email: 'private-outsider@socket.test' });
      const channel = await Channel.create({ name: 'Private room', category: 'General', visibility: 'private' });
      const socket = await connectSocket(token);
      const ack = await emitWithAck(socket, 'join_channel', channel.id);
      expect(ack).toEqual({ ok: false, error: 'Channel access denied' });
      socket.disconnect();
      await new Promise(r => setTimeout(r, 50));
    }, 10000);

    it('allows an active member to join a private channel', async () => {
      const { user, token } = await makeUser({ email: 'private-member@socket.test' });
      const channel = await Channel.create({ name: 'Members room', category: 'General', visibility: 'private' });
      await CommunityMembership.create({ channelId: channel._id, userId: user._id, status: 'active' });
      const socket = await connectSocket(token);
      const ack = await emitWithAck(socket, 'join_channel', channel.id);
      expect(ack).toEqual({ ok: true });
      socket.disconnect();
      await new Promise(r => setTimeout(r, 50));
    }, 10000);

    it('denies joining a channel that does not exist', async () => {
      const { token } = await makeUser({ email: 'channel-missing@socket.test' });
      const socket = await connectSocket(token);
      const ack = await emitWithAck(socket, 'join_channel', 'channel-123');
      expect(ack).toEqual({ ok: false, error: 'Channel access denied' });
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
      const channel = await Channel.create({ name: 'Shared room', category: 'General', visibility: 'public' });
      const socketA = await connectSocket(tokenA);
      const socketB = await connectSocket(tokenB);

      expect(await emitWithAck(socketA, 'join_channel', channel.id)).toEqual({ ok: true });
      expect(await emitWithAck(socketB, 'join_channel', channel.id)).toEqual({ ok: true });

      const received = [];
      socketB.on('receive_message', (msg) => received.push(msg));

      const ack = await emitWithAck(socketA, 'send_message', { channelId: channel.id, message: 'hello room' });
      expect(ack).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(received).toContain('hello room');

      socketA.disconnect();
      socketB.disconnect();
      await new Promise(r => setTimeout(r, 50));
    }, 15000);
  });
});