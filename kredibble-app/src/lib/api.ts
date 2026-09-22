import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type AuthRole = 'seeker' | 'hirer' | 'admin';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole | string;
  seeker?: unknown;
  hirer?: unknown;
  staff?: unknown;
};

type AuthResponse = {
  user: AuthUser;
  token: string;
};

const fallbackApiUrl = Platform.select({
  android: 'http://10.0.2.2:4000/api',
  default: 'http://localhost:4000/api',
});

const getApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!envUrl) return fallbackApiUrl || 'http://localhost:4000/api';

  if (envUrl.includes('.') && !envUrl.startsWith('http')) {
    return `https://${envUrl.replace(/\/$/, '')}`;
  }

  return envUrl.replace(/\/$/, '');
};

export const API_BASE_URL = getApiUrl();

const TOKEN_KEY = 'kredibble_app_token';
const USER_KEY = 'kredibble_app_user';

const saveMobileSession = async ({ token, user }: AuthResponse) => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } catch {
    // Silently fail if secure store unavailable
  }
};

export const getMobileToken = async () => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const getMobileUser = async () => {
  try {
    const userJson = await SecureStore.getItemAsync(USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  } catch {
    return null;
  }
};

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getMobileToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = payload?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return payload.data as T;
}

export const getOpportunities = async () => {
  return request<any[]>('/opportunities');
};

export const getDashboardSummary = async () => {
  return request<any>('/dashboard/summary');
};

export const getMe = async () => {
  return request<AuthUser>('/auth/me');
};

export const loginMobile = async (email: string, password: string) => {
  const session = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await saveMobileSession(session);
  return session;
};

export const signupMobile = async (values: {
  name: string;
  email: string;
  password: string;
  role: 'seeker' | 'hirer';
  profession?: string;
  university?: string;
  country?: string;
  city?: string;
  companyName?: string;
  industry?: string;
  location?: string;
  website?: string;
  companySize?: string;
  companyEmail?: string;
  phone?: string;
  technicalSkills?: string[];
  recruiterRole?: string;
  recruiterPhone?: string;
  recruiterLinkedin?: string;
}) => {
  const session = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(values),
  });
  await saveMobileSession(session);
  return session;
};

export const clearMobileSession = async () => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    // Ignore errors
  }
};
