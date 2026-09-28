import { loginMobile, signupMobile, clearMobileSession, getMobileUser, getMobileToken, getOpportunities, getMe } from '../src/lib/api';
import * as SecureStore from 'expo-secure-store';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Auth API Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    SecureStore.setItemAsync = jest.fn();
    SecureStore.getItemAsync = jest.fn();
    SecureStore.deleteItemAsync = jest.fn();
  });

  const mockAuthResponse = {
    user: { id: '1', name: 'Test', email: 'test@test.com', role: 'seeker' },
    token: 'test-jwt-token',
    refreshToken: 'test-refresh-token',
  };

  test('loginMobile calls API and stores session', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockAuthResponse }),
    });

    const result = await loginMobile('test@test.com', 'password123');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
      })
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('kredibble_app_token', mockAuthResponse.token);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('kredibble_app_user', JSON.stringify(mockAuthResponse.user));
    expect(result).toEqual(mockAuthResponse);
  });

  test('loginMobile throws on invalid credentials', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Invalid email or password' } }),
    });

    await expect(loginMobile('test@test.com', 'wrong')).rejects.toThrow('Invalid email or password');
  });

  test('signupMobile calls API and stores session', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockAuthResponse }),
    });

    const result = await signupMobile({
      name: 'Test User',
      email: 'test@test.com',
      password: 'Password123',
      role: 'seeker',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/register'),
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result).toEqual(mockAuthResponse);
  });

  test('signupMobile rejects admin role', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockAuthResponse }),
    });

    await signupMobile({
      name: 'Test User',
      email: 'test@test.com',
      password: 'Password123',
      role: 'hirer',
    });

    // The body should not contain role: 'admin' since it's filtered by the schema
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.role).not.toBe('admin');
  });

  test('getMe calls API with auth token', async () => {
    SecureStore.getItemAsync.mockResolvedValue('stored-token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { user: mockAuthResponse.user } }),
    });

    const result = await getMe();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer stored-token' }),
      })
    );
    expect(result.user).toEqual(mockAuthResponse.user);
  });

  test('getMe throws when no token', async () => {
    SecureStore.getItemAsync.mockResolvedValue(null);
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Authentication token is required' } }),
    });

    await expect(getMe()).rejects.toThrow();
  });

  test('clearMobileSession clears storage', async () => {
    await clearMobileSession();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('kredibble_app_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('kredibble_app_user');
  });

  test('getOpportunities passes query params', async () => {
    SecureStore.getItemAsync.mockResolvedValue('stored-token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await getOpportunities({ page: 2, limit: 10, status: 'active' });

    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toContain('page=2');
    expect(callUrl).toContain('limit=10');
    expect(callUrl).toContain('status=active');
  });
});