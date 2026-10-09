import {
  requestEmailVerification,
  verifyEmail,
  isEmailVerificationError,
  setEmailVerificationHandler,
  request,
  ApiRequestError,
} from '../src/lib/api';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('Email Verification API & Error Gate', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('isEmailVerificationError', () => {
    test('identifies error with EMAIL_VERIFICATION_REQUIRED code', () => {
      const err = new ApiRequestError('Verification required', 403, 'EMAIL_VERIFICATION_REQUIRED');
      expect(isEmailVerificationError(err)).toBe(true);
    });

    test('identifies error with 403 and email verification in message', () => {
      const err = new ApiRequestError('Email verification is required to perform this action', 403);
      expect(isEmailVerificationError(err)).toBe(true);
    });

    test('returns false for generic errors', () => {
      const err = new ApiRequestError('Invalid credentials', 401);
      expect(isEmailVerificationError(err)).toBe(false);
    });
  });

  describe('requestEmailVerification', () => {
    test('calls /auth/verification-code/send with specified email', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { email: 'user@example.com', expiresInMinutes: 15 },
        }),
      });

      const res = await requestEmailVerification('user@example.com');
      expect(res.email).toBe('user@example.com');
      expect(res.expiresInMinutes).toBe(15);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/verification-code/send'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'user@example.com' }),
        })
      );
    });

    test('falls back to stored user email if none passed', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ id: 'u1', email: 'stored@example.com' })
      );
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { email: 'stored@example.com', expiresInMinutes: 15 },
        }),
      });

      const res = await requestEmailVerification();
      expect(res.email).toBe('stored@example.com');
    });

    test('throws if email is missing and no stored user found', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
      await expect(requestEmailVerification()).rejects.toThrow(
        'Email address is required to request verification code'
      );
    });
  });

  describe('verifyEmail', () => {
    test('calls /auth/verification-code/verify and updates stored user', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({ id: 'u1', email: 'user@example.com', emailVerified: false })
      );
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { email: 'user@example.com', verified: true },
        }),
      });

      const res = await verifyEmail('123456', 'user@example.com');
      expect(res.verified).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/verification-code/verify'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
        })
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"emailVerified":true')
      );
    });
  });

  describe('setEmailVerificationHandler', () => {
    test('invokes registered callback on 403 EMAIL_VERIFICATION_REQUIRED', async () => {
      const mockHandler = jest.fn();
      setEmailVerificationHandler(mockHandler);

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            message: 'Email verification is required to perform this action',
            code: 'EMAIL_VERIFICATION_REQUIRED',
          },
        }),
      });

      await expect(request('/opportunities/123/applicants', { method: 'POST' })).rejects.toThrow();
      expect(mockHandler).toHaveBeenCalledTimes(1);

      setEmailVerificationHandler(null);
    });
  });
});
