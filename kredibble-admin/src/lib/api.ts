export type AuthRole = "admin" | "seeker" | "hirer";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole | string;
};

export type SeekerProfile = {
  id: string;
  userId: string;
  fullName: string;
  name?: string;
  email: string;
  phone?: string;
  profession?: string;
  country?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string; avatarUrl?: string; verified: boolean; emailVerified: boolean; createdAt: string };
  applicationsCount?: number;
  savedCount?: number;
};

export type HirerAccount = {
  id: string;
  userId: string;
  companyName: string;
  companyEmail: string;
  industry?: string;
  website?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string; avatarUrl?: string; verified: boolean; emailVerified: boolean; createdAt: string };
  postingsCount?: number;
  location?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  overallStatus?: string;
  linkedVerificationId?: string;
};

export type EventRecord = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  organizer?: string;
  type?: string;
  status?: string;
  country?: string;
  startAt: string;
  endAt?: string;
  capacity?: number;
  attendeesCount?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  createdByUser?: { id: string; name: string; email: string };
  attendees?: { userId: { id: string; name: string; email: string } }[];
};

export type GrantRecord = {
  id: string;
  title: string;
  description?: string;
  sector?: string;
  grantType?: string;
  status?: string;
  fundingPool?: number;
  allocated?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  createdByUser?: { id: string; name: string; email: string };
};

export type ArticleRecord = {
  id: string;
  title: string;
  content?: string;
  category?: string;
  authorName?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
};

export type StaffMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ChannelRecord = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  createdByUser?: { id: string; name: string; email: string };
  members?: { userId: { id: string; name: string; email: string } }[];
};

export type ChannelPost = {
  id: string;
  channelId: string;
  content: string;
  authorId?: string;
  authorName?: string;
  createdAt: string;
  author?: { id: string; name: string; email: string; avatarUrl?: string };
};

export type CompanyVerification = {
  id: string;
  name: string;
  email?: string;
  industry?: string;
  overallStatus?: string;
  hirerId?: string;
  createdAt: string;
  updatedAt: string;
  hirer?: { id: string; companyName: string; companyEmail: string };
  documents?: VerificationDoc[];
};

export type VerificationDoc = {
  id: string;
  companyId: string;
  documentType?: string;
  fileUrl?: string;
  status?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
};

export type AuthResponse = {
  user: AuthUser;
};

export type Paginated<T> = { data: T[]; meta: { page: number; limit: number; total: number; pages: number } };

const getApiUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl) return "http://localhost:4000/api/v1";

  // Same-origin path (the API_PROXY_TARGET rewrite in next.config.ts): requests
  // go to the dashboard's own origin, so they inherit its HTTPS.
  if (envUrl.startsWith("/")) return envUrl.replace(/\/$/, "");

  // SEC-016: In production, reject non-HTTPS URLs
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !envUrl.startsWith('https://')) {
    throw new Error('SEC-016: NEXT_PUBLIC_API_URL must use https:// in production');
  }

  if (envUrl.includes(".") && !envUrl.startsWith("http")) {
    return `https://${envUrl.replace(/\/$/, "")}`;
  }

  return envUrl.replace(/\/$/, "");
};

export const API_BASE_URL = getApiUrl();

const USER_KEY = "kredibble_admin_user";

const getStoredUser = () =>
  typeof window === "undefined" ? null : window.localStorage.getItem(USER_KEY);

export const hasAdminSession = () => Boolean(getStoredUser());

export const saveAdminUser = (user: AuthUser) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAdminSession = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_KEY);
};

const defaultFetchOpts: RequestInit = {
  credentials: "include", // send/receive httpOnly cookies
  headers: { "Content-Type": "application/json" },
};

let isRefreshing = false;
let refreshPromise: Promise<AuthResponse> | null = null;

async function refreshAdminSession(): Promise<AuthResponse> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/admin/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      clearAdminSession();
      throw new Error(payload?.error?.message || "Session expired");
    }
    saveAdminUser(payload.data.user);
    return payload.data as AuthResponse;
  })();
  try {
    return await refreshPromise;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

async function requestPayload<P>(path: string, init: RequestInit = {}, retried = false): Promise<P> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...defaultFetchOpts,
    ...init,
    headers: {
      ...defaultFetchOpts.headers,
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = payload?.error?.message || `Request failed with status ${response.status}`;
    // On 401, try to refresh once and retry
    if (response.status === 401 && !retried) {
      try {
        await refreshAdminSession();
        // Retry the original request
        return requestPayload<P>(path, init, true);
      } catch {
        clearAdminSession();
        throw new Error("Session expired, please log in again");
      }
    }
    throw new Error(errorMsg);
  }

  return payload as P;
}

/** One record or action result: the response's `data`. Bodyless responses (204) give `undefined`. */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const payload = await requestPayload<{ data: T } | null>(path, init);
  return payload?.data as T;
}

/** A paginated list: keeps `meta` (page counts), which `request` drops. */
export async function requestPage<T>(path: string): Promise<Paginated<T>> {
  const payload = await requestPayload<Paginated<T>>(path);
  return { data: payload.data, meta: payload.meta };
}

export const checkAdminSession = async (): Promise<AuthUser | null> => {
  try {
    const data = await request<AuthUser>("/auth/admin/me");
    saveAdminUser(data);
    return data;
  } catch {
    clearAdminSession();
    return null;
  }
};

export const getDashboardSummary = async <T = Record<string, unknown>>() => {
  return request<T>("/admin/dashboard");
};

export const getVerifications = async <T = Record<string, unknown>>(status?: string) => {
  const query = status ? `?status=${status}` : "";
  return request<T[]>(`/admin/verification/companies${query}`);
};

export const updateVerificationStatus = async (companyId: string, status: string) => {
  return request<Record<string, unknown>>(`/admin/verification/companies/${companyId}`, {
    method: "PATCH",
    body: JSON.stringify({ overallStatus: status }),
  });
};

export const getOpportunities = async <T = Record<string, unknown>>(status?: string) => {
  const query = status ? `?status=${status}` : "";
  return request<T[]>(`/admin/opportunities${query}`);
};

export const loginAdmin = async (email: string, password: string) => {
  const session = await request<AuthResponse>("/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (session.user.role !== "admin" && !session.user.role.toLowerCase().includes("admin")) {
    throw new Error("This account does not have admin access");
  }

  saveAdminUser(session.user);
  return session;
};

export const logoutAdmin = async () => {
  await request("/auth/admin/logout", { method: "POST" });
  clearAdminSession();
};

// Seekers
export const getSeekers = async (params?: { page?: number; limit?: number; q?: string; verified?: boolean }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.q) query.set("q", params.q);
  if (params?.verified !== undefined) query.set("verified", String(params.verified));
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<SeekerProfile>(`/admin/seekers${queryString}`);
};

export const getSeekerById = async <T = SeekerProfile>(id: string) => {
  return request<T>(`/admin/seekers/${id}`);
};

// Hirers
export const getHirers = async (params?: { page?: number; limit?: number; q?: string; verified?: boolean }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.q) query.set("q", params.q);
  if (params?.verified !== undefined) query.set("verified", String(params.verified));
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<HirerAccount>(`/admin/hirers${queryString}`);
};

export const getHirerById = async <T = HirerAccount>(id: string) => {
  return request<T>(`/admin/hirers/${id}`);
};

// Events
export const getEvents = async (params?: { page?: number; limit?: number; q?: string; type?: string; status?: string; country?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.q) query.set("q", params.q);
  if (params?.type) query.set("type", params.type);
  if (params?.status) query.set("status", params.status);
  if (params?.country) query.set("country", params.country);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<EventRecord>(`/admin/events${queryString}`);
};

export const getEventById = async <T = EventRecord>(id: string) => {
  return request<T>(`/admin/events/${id}`);
};

// Grants
export const getGrants = async (params?: { page?: number; limit?: number; q?: string; status?: string; sector?: string; grantType?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  if (params?.sector) query.set("sector", params.sector);
  if (params?.grantType) query.set("grantType", params.grantType);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<GrantRecord>(`/admin/grants${queryString}`);
};

export const getGrantById = async <T = GrantRecord>(id: string) => {
  return request<T>(`/admin/grants/${id}`);
};

// Articles
export const getArticles = async (params?: { page?: number; limit?: number; q?: string; status?: string; category?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  if (params?.category) query.set("category", params.category);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<ArticleRecord>(`/admin/articles${queryString}`);
};

export const getArticleById = async <T = ArticleRecord>(id: string) => {
  return request<T>(`/admin/articles/${id}`);
};

// Staff
export const getStaff = async (params?: { page?: number; limit?: number; q?: string; role?: string; status?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.q) query.set("q", params.q);
  if (params?.role) query.set("role", params.role);
  if (params?.status) query.set("status", params.status);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<StaffMember>(`/admin/staff${queryString}`);
};

export const getStaffById = async <T = StaffMember>(id: string) => {
  return request<T>(`/admin/staff/${id}`);
};

export const createStaff = async <T = StaffMember>(data: Partial<StaffMember>) => {
  return request<T>(`/admin/staff`, { method: "POST", body: JSON.stringify(data) });
};

export const updateStaff = async <T = StaffMember>(id: string, data: Partial<StaffMember>) => {
  return request<T>(`/admin/staff/${id}`, { method: "PATCH", body: JSON.stringify(data) });
};

export const deleteStaff = async (id: string) => {
  return request<{ data: { id: string } }>(`/admin/staff/${id}`, { method: "DELETE" });
};

// Community Channels
export const getCommunityChannels = async (params?: { page?: number; limit?: number; q?: string; status?: string; category?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  if (params?.category) query.set("category", params.category);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<ChannelRecord>(`/admin/community/channels${queryString}`);
};

export const getCommunityChannelById = async <T = ChannelRecord>(id: string) => {
  return request<T>(`/admin/community/channels/${id}`);
};

export const createCommunityChannel = async <T = ChannelRecord>(data: Partial<ChannelRecord>) => {
  return request<T>(`/admin/community/channels`, { method: "POST", body: JSON.stringify(data) });
};

export const updateCommunityChannel = async <T = ChannelRecord>(id: string, data: Partial<ChannelRecord>) => {
  return request<T>(`/admin/community/channels/${id}`, { method: "PATCH", body: JSON.stringify(data) });
};

export const deleteCommunityChannel = async (id: string) => {
  return request<{ data: { id: string } }>(`/admin/community/channels/${id}`, { method: "DELETE" });
};

// Community Posts
export const getCommunityChannelPosts = async (channelId: string, params?: { page?: number; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<ChannelPost>(`/admin/community/channels/${channelId}/posts${queryString}`);
};

// Verification Companies
export const getVerificationCompanies = async (params?: { page?: number; limit?: number; q?: string; overallStatus?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.q) query.set("q", params.q);
  if (params?.overallStatus) query.set("overallStatus", params.overallStatus);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<CompanyVerification>(`/admin/verification/companies${queryString}`);
};

export const getVerificationCompanyById = async <T = CompanyVerification>(id: string) => {
  return request<T>(`/admin/verification/companies/${id}`);
};

export const updateVerificationCompany = async <T = CompanyVerification>(id: string, data: Partial<CompanyVerification>) => {
  return request<T>(`/admin/verification/companies/${id}`, { method: "PATCH", body: JSON.stringify(data) });
};

// Verification Documents
export const getVerificationCompanyDocuments = async (companyId: string, params?: { page?: number; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<VerificationDoc>(`/admin/verification/companies/${companyId}/documents${queryString}`);
};

export const getVerificationDocuments = async (params?: { page?: number; limit?: number; status?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<VerificationDoc>(`/admin/verification/documents${queryString}`);
};

export const getVerificationDocumentById = async <T = VerificationDoc>(id: string) => {
  return request<T>(`/admin/verification/documents/${id}`);
};

export const updateVerificationDocument = async <T = VerificationDoc>(id: string, data: Partial<VerificationDoc>) => {
  return request<T>(`/admin/verification/documents/${id}`, { method: "PATCH", body: JSON.stringify(data) });
};


export const deleteVerificationDocument = async (id: string) => {
  return request<{ data: { id: string } }>(`/admin/verification/documents/${id}`, { method: "DELETE" });
};

// There is deliberately no admin self-service signup. Public registration
// cannot mint the 'admin' role, so admins are provisioned server-side with
// `npm run user:create-admin -- --email ... --name ...` in kredibble-backend.