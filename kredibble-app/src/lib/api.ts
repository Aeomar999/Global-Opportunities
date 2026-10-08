import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type AuthRole = 'seeker' | 'hirer' | 'admin';

export type Opportunity = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  type?: string;
  requirements?: string | string[];
  salary?: string;
  applicantsCount?: number;
  vetted?: boolean;
  moderationStatus?: string;
  logoColor?: string;
  initial?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type EventItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  location: string;
  venueName?: string;
  venueAddress?: string;
  theme?: string;
  duration?: string;
  capacity?: number;
  attendeesCount?: number;
  image?: string;
  organizer?: string;
  type?: string;
  price?: string | number;
  priceNum?: number;
  category?: string;
  region?: string;
  ticketType?: string;
  eventType?: string;
  logoColor?: string;
  virtualUrl?: string;
};

export type Grant = {
  id: string;
  title: string;
  org?: string;
  funder?: string;
  fundingAgency?: string;
  description: string;
  fundingPool?: number;
  allocated?: number;
  budget?: string;
  openStatus?: string;
  deadline?: string;
  location?: string;
  requirements?: string;
  status?: string;
  logoColor?: string;
  initial?: string;
  awardCeiling?: string;
  awardFloor?: string;
  sector?: string;
  languages?: string;
  eligibleApplicants?: string;
  datePosted?: string;
};

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
  refreshToken?: string;
};

const fallbackApiUrl = Platform.select({
  android: 'http://10.0.2.2:4000/api/v1',
  default: 'http://localhost:4000/api/v1',
});

export const getApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!envUrl) return fallbackApiUrl || 'http://localhost:4000/api/v1';

  // SEC-016: In production, reject non-HTTPS URLs
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !envUrl.startsWith('https://')) {
    throw new Error('SEC-016: EXPO_PUBLIC_API_URL must use https:// in production');
  }

  if (envUrl.includes('.') && !envUrl.startsWith('http')) {
    return `https://${envUrl.replace(/\/$/, '')}`;
  }

  return envUrl.replace(/\/$/, '');
};

export const API_BASE_URL = getApiUrl();

const TOKEN_KEY = 'kredibble_app_token';
const REFRESH_TOKEN_KEY = 'kredibble_app_refresh_token';
const USER_KEY = 'kredibble_app_user';

export const saveMobileSession = async ({ token, user, refreshToken }: AuthResponse) => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    }
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

export const getMobileRefreshToken = async () => {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
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

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getMobileToken();
  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  let payload = await response.json().catch(() => null);

  // SEC-080: Handle expired token by refreshing on any 401 for authenticated non-auth requests
  const isAuthRoute = path.includes('/auth/login') || path.includes('/auth/refresh') || path.includes('/auth/logout');
  if (response.status === 401 && token && !isAuthRoute) {
    const refreshToken = await getMobileRefreshToken();
    
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          
          const refreshPayload = await refreshResponse.json().catch(() => null);
          
          if (refreshResponse.ok && refreshPayload?.data?.token) {
            const newToken = refreshPayload.data.token;
            const newRefreshToken = refreshPayload.data.refreshToken;
            
            await SecureStore.setItemAsync(TOKEN_KEY, newToken);
            if (newRefreshToken) {
              await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefreshToken);
            }
            
            isRefreshing = false;
            onRefreshed(newToken);
          } else {
            isRefreshing = false;
            await clearMobileSession();
            onRefreshed('');
            throw new Error('Session expired. Please log in again.');
          }
        } catch (e) {
          isRefreshing = false;
          await clearMobileSession();
          onRefreshed('');
          throw e;
        }
      }
      
      // Wait for the token to be refreshed
      const newToken = await new Promise<string>((resolve) => {
        if (!isRefreshing) {
          resolve('');
        } else {
          refreshSubscribers.push(resolve);
        }
      });
      
      const retryToken = newToken || await getMobileToken();
      if (!retryToken) {
         throw new Error('Session expired. Please log in again.');
      }

      // Retry original request with new token
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${retryToken}`,
          ...init.headers,
        },
      });
      
      payload = await response.json().catch(() => null);
    }
  }

  if (!response.ok) {
    const errorMsg = payload?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return payload.data as T;
}

export const getOpportunities = async (params?: Record<string, any>) => {
  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, String(v));
    });
    const qs = query.toString();
    return request<any[]>(`/opportunities${qs ? `?${qs}` : ''}`);
  }
  return request<any[]>('/opportunities');
};

export const createOpportunity = async (data: any) => {
  return request<any>('/opportunities', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateOpportunity = async (id: string, data: any) => {
  return request<any>(`/opportunities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const deleteOpportunity = async (id: string) => {
  return request<any>(`/opportunities/${id}`, {
    method: 'DELETE',
  });
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
    const refreshToken = await getMobileRefreshToken();
    const token = await getMobileToken();
    if (refreshToken) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => null);
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    // Ignore errors
  }
};

// --- Applicant Management ---

export const getMyApplications = async () => {
  return request<any[]>('/users/me/applications');
};

export const getApplicants = async (opportunityId: string) => {
  return request<any[]>(`/opportunities/${opportunityId}/applicants`);
};

export const getApplicant = async (id: string) => {
  return request<any>(`/applicants/${id}`);
};

export const updateApplicantStatus = async (id: string, status: string) => {
  return request<any>(`/applicants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
};

// --- Advanced Search & Filtering ---

export const searchCandidates = async (params: { skills?: string, university?: string, country?: string, q?: string }) => {
  const query = new URLSearchParams();
  if (params.skills) query.append('skills', params.skills);
  if (params.university) query.append('university', params.university);
  if (params.country) query.append('country', params.country);
  if (params.q) query.append('q', params.q);
  
  return request<any[]>(`/candidates/search?${query.toString()}`);
};

export const searchSeekers = async (params: { skills?: string, university?: string, country?: string, q?: string }) => {
  const query = new URLSearchParams();
  if (params.skills) query.append('skills', params.skills);
  if (params.university) query.append('university', params.university);
  if (params.country) query.append('country', params.country);
  if (params.q) query.append('q', params.q);
  
  return request<any[]>(`/seekers/search?${query.toString()}`);
};

// --- Community Channels & Posts ---

export const getChannels = async () => {
  return request<any[]>('/community/channels');
};

export const getChannel = async (id: string) => {
  return request<any>(`/community/channels/${id}`);
};

export const createChannel = async (data: any) => {
  return request<any>('/community/channels', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};
export const getChannelPosts = async (channelId: string) => {
  return request<any[]>(`/community/channels/${channelId}/posts`);
};

export const createChannelPost = async (channelId: string, data: any) => {
  return request<any>(`/community/channels/${channelId}/posts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateChannelPost = async (id: string, data: any) => {
  return request<any>(`/community/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const deleteChannelPost = async (id: string) => {
  return request<any>(`/community/posts/${id}`, {
    method: 'DELETE',
  });
};

// --- Applications ---

export const applyForOpportunity = async (opportunityId: string, data: any) => {
  return request<any>(`/opportunities/${opportunityId}/applicants`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const applyForGrant = async (grantId: string, data: any) => {
  return request<any>(`/grants/${grantId}/applications`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const bookEvent = async (eventId: string, data: any) => {
  return request<any>(`/events/${eventId}/attendees`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const uploadVerificationDoc = async (companyId: string, data: any) => {
  return request<any>(`/verification/companies/${companyId}/documents`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const getEvents = async (params?: Record<string, any>) => {
  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.append(key, String(value));
    });
    return request<any[]>(`/events?${query.toString()}`);
  }
  return request<any[]>('/events');
};

export const getGrants = async (params?: Record<string, any>) => {
  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.append(key, String(value));
    });
    return request<any[]>(`/grants?${query.toString()}`);
  }
  return request<any[]>('/grants');
};

export const updateSeekerProfile = async (id: string, data: any) => {
  return request<any>(`/seekers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const updateHirerProfile = async (id: string, data: any) => {
  return request<any>(`/hirers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};


export const toggleSavedItem = async (data: { itemId: string, itemType: string }) => {
  return request<any>(`/users/me/saved`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const getSavedItems = async () => {
  return request<any[]>(`/users/me/saved`);
};


export const getArticles = async (params: any = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<any[]>(`/articles?${qs}`);
};

export const getNotifications = async () => {
  return request<any[]>(`/notifications`);
};

export const createReport = async (data: any) => {
  return request<any>('/reports', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const getOpportunityById = async (id: string) => {
  return request<Opportunity>(`/opportunities/${id}`);
};

export const getEventById = async (id: string) => {
  return request<EventItem>(`/events/${id}`);
};

export const getGrantById = async (id: string) => {
  return request<Grant>(`/grants/${id}`);
};

export const requestForgotPassword = async (email: string) => {
  return request<void>('/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const resetPassword = async (data: { email: string; code: string; newPassword: string }) => {
  return request<{ message: string }>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
  return request<AuthResponse>('/auth/password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const deleteMyAccount = async (password: string) => {
  await request('/auth/me', {
    method: 'DELETE',
    body: JSON.stringify({ password, confirmation: 'DELETE MY ACCOUNT' }),
  });
  await clearMobileSession();
};

export const getMyGrantApplications = async () => {
  return request<any[]>('/users/me/grant-applications');
};

export interface UploadResponse {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
  folder?: string;
  originalName?: string;
  mimeType?: string;
}

export const uploadFile = async (
  file: { uri: string; name: string; mimeType?: string },
  purpose: 'cvs' | 'avatars' | 'company-logos' | 'verification-docs' = 'cvs'
): Promise<UploadResponse> => {
  const token = await getMobileToken();
  const formData = new FormData();

  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as any);

  const response = await fetch(`${API_BASE_URL}/upload?purpose=${encodeURIComponent(purpose)}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMsg = payload?.error?.message || `Upload failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return payload.data;
};



