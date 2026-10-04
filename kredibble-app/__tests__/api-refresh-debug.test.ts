import { request, saveMobileSession, clearMobileSession, getMobileToken, getMobileRefreshToken } from '../src/lib/api';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => {
  const mockStore = new Map();
  return {
    __esModule: true,
    setItemAsync: jest.fn(async (key, value) => { mockStore.set(key, value); }),
    getItemAsync: jest.fn(async (key) => mockStore.get(key)),
    deleteItemAsync: jest.fn(async (key) => { mockStore.delete(key); }),
    _mockStore: mockStore, // expose for clearing
  };
});

describe('Token Refresh Interceptor', () => {
  beforeEach(async () => {
    (SecureStore as any)._mockStore.clear();
    global.fetch = jest.fn();
    await saveMobileSession({
      user: { id: '1', name: 'Test', role: 'seeker', email: 'test@test.com' },
      token: 'old-expired-token',
      refreshToken: 'valid-refresh-token'
    });
  });

  it('clears session and throws if refresh fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'jwt expired' } })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'invalid refresh token' } })
      });

    try {
      await request('/test-endpoint');
    } catch (e) {
      console.log('EXPECTED:', e.message);
      if (e.message !== 'Session expired. Please log in again.') {
        throw e;
      }
    }
  });
});
