export type AuthRole = "admin" | "seeker" | "hirer";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole | string;
  roles?: string[];
  screens?: Partial<Record<string, "view" | "edit">>;
  staff?: {
    id: string;
    name: string;
    email: string;
    roles: string[];
    status: string;
  } | null;
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

// Record types mirror the backend models in kredibble-backend/src/models/.
// Keep them in step: a field that isn't on the model never arrives.

export type EventRecord = {
  id: string;
  title: string;
  hirer: string;
  location: string;
  dateTime: string;
  capacity: number;
  attendeesCount: number;
  status: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GrantRecord = {
  id: string;
  title: string;
  hirer: string;
  sector: string;
  fundingPool: number;
  allocated: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type GrantApplicationRecord = {
  id: string;
  grantId: string;
  applicantName: string;
  requestedAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ArticleRecord = {
  id: string;
  title: string;
  category: string;
  duration?: string;
  summary: string;
  content: string;
  status: string;
  bannerImage?: string;
  createdAt: string;
  updatedAt: string;
};

export type ArticleInput = Pick<ArticleRecord, "title" | "category" | "summary" | "content" | "status"> &
  Partial<Pick<ArticleRecord, "duration" | "bannerImage">>;

/**
 * Staff-portal roles: the values `requirePortalRoles` checks in
 * kredibble-backend/src/routes/admin-api.js. A role outside this list grants nothing.
 */
export const STAFF_ROLES = [
  "Desk Lead",
  "Admin Support",
  "Writer",
  "Opportunities Officer",
  "Partnerships Officer",
  "Training and Capacity Development Officer",
  "Database Officer",
  "Communications Officer",
  "Social Media Manager",
  "Country Lead",
] as const;

export type StaffMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChannelRecord = {
  id: string;
  name: string;
  category: string;
  owner?: string;
  bio?: string;
  avatar?: string;
  visibility: "public" | "private";
  status: string;
  followers?: string;
  postsCount: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChannelPost = {
  id: string;
  channelId: string;
  authorName: string;
  authorId?: { id: string; name: string; email: string; avatarUrl?: string } | string | null;
  title?: string;
  body: string;
  date?: string;
  flagged: boolean;
  createdAt: string;
};

export type ReportRecord = {
  id: string;
  targetType: string;
  targetLabel?: string;
  reporterName?: string;
  reason: string;
  details?: string;
  date?: string;
  status: string;
  linkedChannelId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CompanyVerification = {
  id: string;
  hirerId?: string;
  name: string;
  industry?: string;
  companySize?: string;
  location?: string;
  website?: string;
  companyEmail?: string;
  recruiterName?: string;
  recruiterRole?: string;
  recruiterEmail?: string;
  submittedDate?: string;
  overallStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type VerificationDoc = {
  id: string;
  companyId: string;
  verificationCaseId?: string;
  key: string;
  label?: string;
  fileName?: string;
  status: string;
};

export type OpportunityRecord = {
  id: string;
  title: string;
  type: string;
  company: string;
  offeringOrganization?: string;
  organizationLogo?: string;
  location: string;
  description: string;
  workType?: string;
  salary?: string;
  date?: string;
  eventDateTime?: string;
  eventRegion?: string;
  eventCategory?: string;
  grantBudgetRange?: string;
  grantSector?: string;
  deadline?: string;
  eligibility?: string;
  benefits?: string;
  applicationUrl?: string;
  applicationLink?: string;
  applicantsCount: number;
  moderationStatus: string;
  vetted: boolean;
  vettedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AnalyticsSummary = {
  seekers: { total: number; active: number };
  hirers: { total: number; verified: number };
  applications: { total: number };
  reports: { total: number; open: number };
  opportunitiesByType: { type: string; count: number }[];
};

export type UploadResult = { url: string; publicId: string; folder: string };

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

// Frontend-only read of the user saved at login (used by the top bar and the role context).
// Returns null when there is no session or the stored value is unreadable.
export const getAdminUser = (): AuthUser | null => {
  const raw = getStoredUser();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

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

/**
 * Error thrown for any non-2xx API response. Keeps the server message as `message` (unchanged behaviour)
 * and adds the HTTP status and, for 429 responses, the Retry-After value in seconds so the UI can react.
 */
export class ApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

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
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...defaultFetchOpts,
    ...init,
    // A FormData body sets its own multipart Content-Type, boundary included.
    headers: isForm ? { ...init.headers } : { ...defaultFetchOpts.headers, ...init.headers },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = payload?.error?.message || `Request failed with status ${response.status}`;
    // On 401, try to refresh once and retry
    // A 401 from the LOGIN call means wrong credentials, not an expired session: show the server's message.
    if (response.status === 401 && !retried && !path.startsWith("/auth/admin/login")) {
      try {
        await refreshAdminSession();
        // Retry the original request
        return requestPayload<P>(path, init, true);
      } catch {
        clearAdminSession();
        throw new Error("Session expired, please log in again");
      }
    }
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError(errorMsg, response.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined);
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

/** The platform counts the Overview and the sidebar pills read (GET /dashboard/summary). */
export const getDashboardSummary = async <T = Record<string, unknown>>() => {
  return request<T>("/dashboard/summary");
};

/** The desk dashboard: month KPIs against targets, priorities, trend and pipeline (GET /admin/dashboard). */
export const getAdminDashboard = async <T = Record<string, unknown>>() => {
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

// Reports
export const getReports = async (params?: { page?: number; limit?: number; q?: string; status?: string; targetType?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  if (params?.targetType) query.set("targetType", params.targetType);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<ReportRecord>(`/admin/reports${queryString}`);
};

export const getReportById = async (id: string) => {
  return request<ReportRecord>(`/admin/reports/${id}`);
};

export const updateReport = async (id: string, data: { status: string }) => {
  return request<ReportRecord>(`/admin/reports/${id}`, { method: "PATCH", body: JSON.stringify(data) });
};

// Event and grant edits
export const updateEvent = async (id: string, data: Partial<Pick<EventRecord, "title" | "location" | "dateTime" | "capacity" | "status">>) => {
  return request<EventRecord>(`/admin/events/${id}`, { method: "PATCH", body: JSON.stringify(data) });
};

export const updateGrant = async (id: string, data: Partial<Pick<GrantRecord, "title" | "sector" | "fundingPool" | "status">>) => {
  return request<GrantRecord>(`/admin/grants/${id}`, { method: "PATCH", body: JSON.stringify(data) });
};

// Grant applications
export const getGrantApplications = async (grantId: string, params?: { page?: number; limit?: number; status?: string }) => {
  const query = new URLSearchParams({ grantId });
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);
  const queryString = `?${query.toString()}`;
  return requestPage<GrantApplicationRecord>(`/admin/grant-applications${queryString}`);
};

export const updateGrantApplication = async (id: string, data: { status: string }) => {
  return request<GrantApplicationRecord>(`/admin/grant-applications/${id}`, { method: "PATCH", body: JSON.stringify(data) });
};

// Articles
export const createArticle = async (data: ArticleInput) => {
  return request<ArticleRecord>(`/admin/articles`, { method: "POST", body: JSON.stringify(data) });
};

export const updateArticle = async (id: string, data: Partial<ArticleInput>) => {
  return request<ArticleRecord>(`/admin/articles/${id}`, { method: "PATCH", body: JSON.stringify(data) });
};

/** Upload a banner image; store the returned `url` on the article. */
export const uploadArticleBanner = async (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return request<UploadResult>(`/admin/upload?purpose=article-banner`, { method: "POST", body });
};

// Community moderation
export const deleteCommunityPost = async (id: string) => {
  return request<undefined>(`/admin/community/posts/${id}`, { method: "DELETE" });
};

// Staff
export const inviteStaff = async (data: { email: string; role: string }) => {
  return request<StaffMember>(`/admin/staff/invite`, { method: "POST", body: JSON.stringify(data) });
};

// Analytics
export const getAnalytics = async () => {
  return request<AnalyticsSummary>(`/admin/analytics`);
};

// Opportunity moderation
/** One page of postings, newest first; `meta` carries the real totals, so a caller can read every page. */
export const getOpportunityPage = async (params: { page: number; limit: number }) => {
  const queryString = `?${new URLSearchParams({ page: String(params.page), limit: String(params.limit) }).toString()}`;
  return requestPage<OpportunityRecord>(`/admin/opportunities${queryString}`);
};

export const getOpportunityById = async (id: string) => {
  return request<OpportunityRecord>(`/admin/opportunities/${id}`);
};

/** Approving vets and publishes a posting; rejecting only sets the status (2026-10-04 decision). */
export const moderateOpportunity = async (id: string, decision: "approve" | "reject") => {
  const body = decision === "approve" ? { vetted: true, moderationStatus: "published" } : { moderationStatus: "rejected" };
  return request<OpportunityRecord>(`/admin/opportunities/${id}`, { method: "PATCH", body: JSON.stringify(body) });
};

export interface RolesPermissionsPayload {
  roleIds: string[];
  screens: string[];
  toggles: Record<string, Record<string, boolean>>;
  matrix: Record<string, Record<string, "view" | "edit">>;
}

export const getRolesPermissions = async () => {
  return request<RolesPermissionsPayload>("/admin/roles-permissions");
};

export const updateRolesPermissions = async (toggles: Record<string, Record<string, boolean>>) => {
  return request<{ toggles: Record<string, Record<string, boolean>> }>("/admin/roles-permissions", {
    method: "PUT",
    body: JSON.stringify({ toggles }),
  });
};

// BE-002: Targets API
export interface TargetApiItem {
  kpi: string;
  value: number;
  effectiveFrom: string;
  seq: number;
  metric: string;
  target: number;
}

export interface TargetHistoryApiItem {
  id: string;
  kpi: string;
  value: number;
  effectiveFrom: string;
  previous: number | null;
  changedBy?: string;
  changedByName?: string;
  changedAt: string;
  seq: number;
  replaced: boolean;
}

export const getTargets = async (month?: string) => {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<TargetApiItem[]>(`/admin/targets${query}`);
};

export const getTargetHistory = async () => {
  return request<TargetHistoryApiItem[]>("/admin/targets/history");
};

export const saveTargetsApi = async (effectiveFrom: string, targets: { kpi: string; value: number }[]) => {
  return request<{ saved: number; effectiveFrom: string; targets: TargetApiItem[] }>("/admin/targets", {
    method: "POST",
    body: JSON.stringify({ effectiveFrom, targets }),
  });
};

// There is deliberately no admin self-service signup. Public registration
// cannot mint the 'admin' role, so admins are provisioned server-side with
// `npm run user:create-admin -- --email ... --name ...` in kredibble-backend.