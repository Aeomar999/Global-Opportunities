import { getApiUrl, saveMobileSession, getMobileToken, getMobileUser, clearMobileSession } from '../src/lib/api';
import * as SecureStore from 'expo-secure-store';

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    select: jest.fn(() => 'http://localhost:4000/api'),
  },
}));

describe('API Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('uses EXPO_PUBLIC_API_URL when set', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
    const { getApiUrl: getApiUrlFresh } = await import('../src/lib/api');
    expect(getApiUrlFresh()).toBe('https://api.example.com');
  });

  test('uses fallback URL when EXPO_PUBLIC_API_URL not set', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const { getApiUrl: getApiUrlFresh } = await import('../src/lib/api');
    expect(getApiUrlFresh()).toBe('http://localhost:4000/api');
  });

  test('adds https:// when URL has no protocol', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'api.example.com';
    const { getApiUrl: getApiUrlFresh } = await import('../src/lib/api');
    expect(getApiUrlFresh()).toBe('https://api.example.com');
  });

  test('preserves https:// protocol', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
    const { getApiUrl: getApiUrlFresh } = await import('../src/lib/api');
    expect(getApiUrlFresh()).toBe('https://api.example.com');
  });

  test('throws in production for non-HTTPS URL', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.example.com';
    process.env.NODE_ENV = 'production';
    
    // Dynamic import to get fresh module with new env
    await expect(import('../src/lib/api')).rejects.toThrow('SEC-016: EXPO_PUBLIC_API_URL must use https:// in production');
  });

  test('allows HTTP in development', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4000/api';
    process.env.NODE_ENV = 'development';
    const { getApiUrl: getApiUrlFresh } = await import('../src/lib/api');
    expect(getApiUrlFresh()).toBe('http://localhost:4000/api');
  });

  test('removes trailing slash', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/';
    const { getApiUrl: getApiUrlFresh } = await import('../src/lib/api');
    expect(getApiUrlFresh()).toBe('https://api.example.com');
  });
});

describe('Auth Token Storage', () => {
  const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('saveMobileSession stores token and user', async () => {
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);
    
    await saveMobileSession({ token: 'test-token', user: { id: '1', name: 'Test', email: 'test@test.com', role: 'seeker' } });
    
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('kredibble_app_token', 'test-token');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('kredibble_app_user', JSON.stringify({ id: '1', name: 'Test', email: 'test@test.com', role: 'seeker' }));
  });

  test('getMobileToken retrieves token', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('stored-token');
    
    const token = await getMobileToken();
    
    expect(token).toBe('stored-token');
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('kredibble_app_token');
  });

  test('getMobileUser retrieves and parses user', async () => {
    const mockUser = { id: '1', name: 'Test', email: 'test@test.com', role: 'seeker' };
    mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mockUser));
    
    const user = await getMobileUser();
    
    expect(user).toEqual(mockUser);
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('kredibble_app_user');
  });

  test('clearMobileSession removes both token and user', async () => {
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
    
    await clearMobileSession();
    
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('kredibble_app_token');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('kredibble_app_user');
  });

  test('handles SecureStore errors gracefully', async () => {
    mockSecureStore.setItemAsync.mockRejectedValue(new Error('SecureStore unavailable'));
    mockSecureStore.getItemAsync.mockRejectedValue(new Error('SecureStore unavailable'));
    mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('SecureStore unavailable'));
    
    // Should not throw
    await expect(saveMobileSession({ token: 't', user: {} })).resolves.toBeUndefined();
    await expect(getMobileToken()).resolves.toBeNull();
    await expect(getMobileUser()).resolves.toBeNull();
    await expect(clearMobileSession()).resolves.toBeUndefined();
  });
});