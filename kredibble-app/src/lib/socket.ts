import { io, Socket } from 'socket.io-client';
import { getMobileToken } from './api';

// The socket server is the same origin as the API, minus the /api path.
const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL
  ? process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:4000';

class SocketService {
  public socket: Socket | null = null;

  // SEC-004: the server rejects unauthenticated handshakes, so the session token
  // has to be supplied here. connect() is now async because reading it means
  // awaiting expo-secure-store.
  async connect() {
    if (this.socket) return;

    const token = await getMobileToken();
    if (!token) {
      console.warn('Socket connect skipped: no session token');
      return;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: (cb: (data: { token: string }) => void) => {
        getMobileToken().then((current) => cb({ token: current || '' }));
      },
    });

    this.socket.on('connect', () => {
      console.log('Connected to socket server:', this.socket?.id);
    });

    this.socket.on('connect_error', (error) => {
      console.warn('Socket connect failed:', error.message);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
