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

// BE-003: Thresholds & Change History API
export interface ThresholdApiItem {
  green: number;
  amber: number;
  greenRatio: number;
  amberRatio: number;
  effectiveFrom: string;
  seq: number;
}

export interface ThresholdHistoryApiItem {
  id: string;
  green: number;
  amber: number;
  effectiveFrom: string;
  previous: { green: number; amber: number } | null;
  changedBy?: string;
  changedByName?: string;
  changedAt: string;
  seq: number;
  replaced: boolean;
}

export type ChangeHistoryItem =
  | (TargetHistoryApiItem & { type: "target" })
  | (ThresholdHistoryApiItem & { type: "threshold" });

export const getThresholds = async (month?: string) => {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<ThresholdApiItem>(`/admin/thresholds${query}`);
};

export const getThresholdHistory = async () => {
  return request<ThresholdHistoryApiItem[]>("/admin/thresholds/history");
};

export const saveThresholdsApi = async (green: number, amber: number, effectiveFrom: string) => {
  return request<ThresholdApiItem>("/admin/thresholds", {
    method: "POST",
    body: JSON.stringify({ green, amber, effectiveFrom }),
  });
};

export const getCombinedChangeHistory = async () => {
  return request<ChangeHistoryItem[]>("/admin/change-history");
};

// BE-005: Programs API
export interface ProgramApiRecord {
  id: string;
  title: string;
  name: string;
  programType: string;
  type: string;
  status: "planned" | "running" | "delivered" | "cancelled";
  format?: string;
  country?: string;
  location?: string;
  participantCount: number;
  participants: number;
  participantTarget: number;
  target: number;
  facilitators?: string[];
  notes?: string;
  startAt?: string;
  endAt?: string;
  deliveredAt?: string;
  partnerId?: string;
  partnerName?: string;
  warning?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const getPrograms = async (params?: { page?: number; limit?: number; status?: string; programType?: string; country?: string; q?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);
  if (params?.programType) query.set("programType", params.programType);
  if (params?.country) query.set("country", params.country);
  if (params?.q) query.set("q", params.q);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<ProgramApiRecord>(`/admin/programs${queryString}`);
};

export const getUpcomingPrograms = async () => {
  return request<ProgramApiRecord[]>("/admin/programs/upcoming");
};

export const getProgramById = async (id: string) => {
  return request<ProgramApiRecord>(`/admin/programs/${id}`);
};

export const createProgramApi = async (data: Partial<ProgramApiRecord>) => {
  return request<ProgramApiRecord>("/admin/programs", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateProgramApi = async (id: string, data: Partial<ProgramApiRecord>) => {
  return request<ProgramApiRecord>(`/admin/programs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const deleteProgramApi = async (id: string) => {
  return request<{ id: string }>(`/admin/programs/${id}`, {
    method: "DELETE",
  });
};

// BE-006: Partners & Pipeline API
export interface PartnerStageEntryApi {
  stage: string;
  at: string;
  from?: string;
  by?: string;
  byName?: string;
}

export interface PartnerApiRecord {
  id: string;
  name: string;
  organizationName: string;
  type: string;
  partnerType: string;
  country?: string;
  sector?: string;
  ownerId?: string;
  assignedOwnerId?: string;
  ownerName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  provides?: string;
  sourcedVia?: string;
  sourcedBy?: string;
  notes?: string;
  stage: string;
  stageHistory: PartnerStageEntryApi[];
  closed: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MovePartnerApiResult {
  partner: PartnerApiRecord;
  from: string;
  to: string;
  closedChange: "closed" | "reopened" | null;
}

export interface PipelineHealthApiRecord {
  openDeals: number;
  needed: number | null;
  ratio: number | null;
  status: "healthy" | "thin" | "critical" | "unknown";
  closeRate: number | null;
  closedInWindow: number;
  reachedOutreachInWindow: number;
  target?: number;
  month?: string;
}

export interface PipelineStageLabelsApi {
  prospect: string;
  outreach: string;
  proposal: string;
  mou: string;
  onboard: string;
  renew: string;
}

export const getPartners = async (params?: { page?: number; limit?: number; stage?: string; country?: string; partnerType?: string; closed?: boolean; q?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.stage) query.set("stage", params.stage);
  if (params?.country) query.set("country", params.country);
  if (params?.partnerType) query.set("partnerType", params.partnerType);
  if (params?.closed !== undefined) query.set("closed", String(params.closed));
  if (params?.q) query.set("q", params.q);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<PartnerApiRecord>(`/admin/partners${queryString}`);
};

export const getPartnerById = async (id: string) => {
  return request<PartnerApiRecord>(`/admin/partners/${id}`);
};

export const createPartnerApi = async (data: Partial<PartnerApiRecord>) => {
  return request<PartnerApiRecord>("/admin/partners", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updatePartnerApi = async (id: string, data: Partial<PartnerApiRecord>) => {
  return request<PartnerApiRecord>(`/admin/partners/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const movePartnerApi = async (id: string, to: string) => {
  return request<MovePartnerApiResult>(`/admin/partners/${id}/move`, {
    method: "POST",
    body: JSON.stringify({ to }),
  });
};

export const deletePartnerApi = async (id: string) => {
  return request<{ id: string }>(`/admin/partners/${id}`, {
    method: "DELETE",
  });
};

export const getPipelineHealthApi = async (month?: string) => {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<PipelineHealthApiRecord>(`/admin/partners/pipeline-health${query}`);
};

export const getPipelineStagesApi = async () => {
  return request<PipelineStageLabelsApi>("/admin/settings/pipeline-stages");
};

export const updatePipelineStagesApi = async (stages?: Partial<PipelineStageLabelsApi>, reset?: boolean) => {
  const body = reset ? { reset: true } : { ...stages };
  return request<PipelineStageLabelsApi>("/admin/settings/pipeline-stages", {
    method: "PUT",
    body: JSON.stringify(body),
  });
};

export interface AmbassadorApiRecord {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  phone?: string;
  country: string;
  city: string;
  campus: string;
  memberType: "student" | "graduate" | "staff" | "volunteer";
  description?: string;
  roleTitle?: string;
  profilePhoto?: string;
  photoUrl?: string;
  tier: "ambassador" | "senior" | "lead";
  status: "applicant" | "onboarding" | "active" | "dormant";
  assignedLeadId?: string;
  leadName?: string;
  trained: boolean;
  linkedUserId?: string;
  linkedSeekerId?: string;
  referralCode: string;
  joinedAt: string;
  dormantSince?: string;
}

export interface AmplificationLogApiRecord {
  id: string;
  ambassadorId: string;
  channel: string;
  at: string;
  clicks: number;
  applications?: number;
  listingId?: string;
  note?: string;
}

export interface NetworkSummaryApiRecord {
  size: number;
  active: number;
  sharedActive: number;
  activityRate: number | null;
  month: string;
}

export interface LeaderboardRowApiRecord {
  rank: number;
  shares: number;
  clicks: number;
  signups: number;
  ambassador: AmbassadorApiRecord;
  sharesLogged?: number;
  distinctReferredClicks?: number;
  verifiedSignups?: number;
  name?: string;
  country?: string;
  campus?: string;
  tier?: string;
}

export const getAmbassadors = async (params?: {
  status?: string;
  tier?: string;
  country?: string;
  q?: string;
  page?: number;
  limit?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);
  if (params?.tier) query.set("tier", params.tier);
  if (params?.country) query.set("country", params.country);
  if (params?.q) query.set("q", params.q);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<AmbassadorApiRecord>(`/admin/ambassadors${queryString}`);
};

export const getAmbassadorById = async (id: string) => {
  return request<AmbassadorApiRecord>(`/admin/ambassadors/${id}`);
};

export const getAmbassadorDetailApi = async (id: string, month?: string) => {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<{
    ambassador: AmbassadorApiRecord;
    leadName?: string;
    logs: AmplificationLogApiRecord[];
    stats: { shares: number; clicks: number; signups: number };
  }>(`/admin/ambassadors/${id}/detail${query}`);
};

export const createAmbassadorApi = async (data: Partial<AmbassadorApiRecord>) => {
  return request<AmbassadorApiRecord>("/admin/ambassadors", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateAmbassadorApi = async (id: string, data: Partial<AmbassadorApiRecord>) => {
  return request<AmbassadorApiRecord>(`/admin/ambassadors/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const deleteAmbassadorApi = async (id: string) => {
  return request<{ id: string }>(`/admin/ambassadors/${id}`, {
    method: "DELETE",
  });
};

export const logAmplificationApi = async (
  ambassadorId: string,
  data: { channel: string; note?: string; clicks?: number; at?: string }
) => {
  return request<AmplificationLogApiRecord>(`/admin/ambassadors/${ambassadorId}/amplifications`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getAmbassadorAmplificationsApi = async (ambassadorId: string) => {
  return requestPage<AmplificationLogApiRecord>(`/admin/ambassadors/${ambassadorId}/amplifications`);
};

export const getNetworkSummaryApi = async (month?: string) => {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<NetworkSummaryApiRecord>(`/admin/network/summary${query}`);
};

export const getLeaderboardApi = async (month?: string) => {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<LeaderboardRowApiRecord[]>(`/admin/leaderboard${query}`);
};

export type BeneficiarySource = "organic" | "ambassador" | "event" | "partner" | "import";

export interface BeneficiaryApiRecord {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  phone?: string;
  country: string;
  institution: string;
  source: BeneficiarySource;
  sourceType?: string;
  verified: boolean;
  createdAt: string;
  addedById?: string;
  addedBy?: string;
  addedByName?: string;
  verifiedAt?: string;
  ambassadorId?: string;
  ambassadorName?: string;
  listingId?: string;
  opportunityId?: string;
  listingTitle?: string;
}

export interface BeneficiaryPaceApiRecord {
  month: string;
  verified: number;
  target: number;
  pace: number;
  paceRounded: number;
  status: "on_pace" | "behind" | "far_behind";
  text: string;
  hint: string;
  gauge: {
    max: number;
    zones: { key: "on_pace" | "behind" | "far_behind"; percent: number }[];
    markerAt: number;
    paceAt: number;
    capped: string | null;
  };
}

export interface BeneficiarySourceCountApiRecord {
  source: BeneficiarySource;
  label: string;
  count: number;
}

export const getBeneficiaries = async (params?: {
  page?: number;
  limit?: number;
  source?: string;
  verified?: boolean;
  month?: string;
  q?: string;
}) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.source) query.set("source", params.source);
  if (params?.verified !== undefined) query.set("verified", String(params.verified));
  if (params?.month) query.set("month", params.month);
  if (params?.q) query.set("q", params.q);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<BeneficiaryApiRecord>(`/admin/beneficiaries${queryString}`);
};

export const getBeneficiaryById = async (id: string) => {
  return request<BeneficiaryApiRecord>(`/admin/beneficiaries/${id}`);
};

export const createBeneficiaryApi = async (data: Partial<BeneficiaryApiRecord>) => {
  return request<BeneficiaryApiRecord>("/admin/beneficiaries", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateBeneficiaryApi = async (id: string, data: Partial<BeneficiaryApiRecord>) => {
  return request<BeneficiaryApiRecord>(`/admin/beneficiaries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const deleteBeneficiaryApi = async (id: string) => {
  return request<{ id: string }>(`/admin/beneficiaries/${id}`, {
    method: "DELETE",
  });
};

export const verifyBeneficiaryApi = async (id: string) => {
  return request<{ record: BeneficiaryApiRecord; undo: { id: string; verified: boolean; verifiedAt?: string } }>(
    `/admin/beneficiaries/${id}/verify`,
    { method: "POST" }
  );
};

export const undoVerifyBeneficiaryApi = async (id: string, data: { verified: boolean; verifiedAt?: string }) => {
  return request<{ record: BeneficiaryApiRecord }>(`/admin/beneficiaries/${id}/undo-verify`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getBeneficiariesPaceApi = async (month?: string) => {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<BeneficiaryPaceApiRecord>(`/admin/beneficiaries/pace${query}`);
};

export const getBeneficiariesSourcesApi = async (month?: string) => {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<BeneficiarySourceCountApiRecord[]>(`/admin/beneficiaries/sources${query}`);
};

export const getBeneficiariesPendingCountApi = async () => {
  return request<{ count: number }>("/admin/beneficiaries/pending-count");
};

// BE-009: Social Posts API
export interface PlatformRowApiRecord {
  platform: string;
  label: string;
  posts: number;
  reach: number;
  engagement: number;
}

export interface SocialMonthlyTotalsApiRecord {
  month: string;
  posts: number;
  reach: number;
  engagement: number;
  targets: {
    posts: number;
    reach: number;
    engagement: number;
  };
  platforms: PlatformRowApiRecord[];
  leading: string | null;
  team: {
    posts: number;
    reach: number;
    engagement: number;
  };
}

export interface SocialPostApiRecord {
  id: string;
  platform: string;
  title: string;
  text?: string;
  url: string;
  reach: number;
  engagement: number;
  status: "draft" | "scheduled" | "published";
  postedAt: string;
  postedAtIso?: string;
  listingId?: string;
  listingTitle?: string;
  authorId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SocialPostPayload {
  platform: string;
  title: string;
  text?: string;
  url: string;
  reach: number;
  engagement: number;
  status?: "draft" | "scheduled" | "published";
  postedAt: string;
  listingId?: string;
  opportunityId?: string;
}

export const getSocialPostsApi = async (params?: {
  month?: string;
  platform?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.month) query.set("month", params.month);
  if (params?.platform) query.set("platform", params.platform);
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<SocialPostApiRecord>(`/admin/social-posts${queryString}`);
};

export const getSocialPostByIdApi = async (id: string) => {
  return request<SocialPostApiRecord>(`/admin/social-posts/${id}`);
};

export const createSocialPostApi = async (data: SocialPostPayload) => {
  return request<SocialPostApiRecord>("/admin/social-posts", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateSocialPostApi = async (id: string, data: Partial<SocialPostPayload>) => {
  return request<SocialPostApiRecord>(`/admin/social-posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const deleteSocialPostApi = async (id: string) => {
  return request<{ id: string; deleted: boolean }>(`/admin/social-posts/${id}`, {
    method: "DELETE",
  });
};

export const getSocialMonthlyTotalsApi = async (month?: string) => {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<SocialMonthlyTotalsApiRecord>(`/admin/social-posts/monthly-totals${query}`);
};


// There is deliberately no admin self-service signup. Public registration
// cannot mint the 'admin' role, so admins are provisioned server-side with
// `npm run user:create-admin -- --email ... --name ...` in kredibble-backend.

// --- Ambassador applications ---------------------------------------------------------------------

export type AmbassadorRequestStatus = "pending" | "approved" | "rejected";

export type AmbassadorRequestRecord = {
  id: string;
  userId: string;
  role: "seeker" | "hirer";
  name: string;
  email: string;
  phone?: string;
  country?: string;
  city?: string;
  profession?: string;
  organisation?: string;
  motivation?: string;
  status: AmbassadorRequestStatus;
  reviewNote?: string;
  reviewedAt?: string;
  channelId?: string;
  createdAt: string;
  updatedAt: string;
  /** Only on the single-record read. */
  user?: { id: string; name: string; email: string; role: string; emailVerified: boolean; joinedAt: string; avatarUrl?: string };
  verified?: boolean;
  profile?: AmbassadorApplicantProfile | null;
};

/** The applicant's own profile details, as they appear on their Manage profile page in the app. */
export type AmbassadorApplicantProfile =
  | {
      kind: "seeker";
      profession?: string; university?: string; country?: string; city?: string; phone?: string;
      bio?: string; professionalSummary?: string; experienceLevel?: string;
      technicalSkills: string[]; softSkills: string[]; tools: string[]; certifications: string[];
      rating: number; verified: boolean; applicationsCount: number;
    }
  | {
      kind: "hirer";
      companyName?: string; tagline?: string; industry?: string; companySize?: string; location?: string; website?: string;
      companyEmail?: string; description?: string; recruiterName?: string; recruiterRole?: string; recruiterEmail?: string;
      recruiterPhone?: string; recruiterLinkedin?: string; verified: boolean; verification?: string; postingsCount: number;
    };

export const getAmbassadorRequests = async (params?: { status?: AmbassadorRequestStatus; role?: string; q?: string; page?: number; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.role) query.set("role", params.role);
  if (params?.q) query.set("q", params.q);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<AmbassadorRequestRecord>(`/admin/ambassador-requests${queryString}`);
};

export const getAmbassadorRequestById = async (id: string) => request<AmbassadorRequestRecord>(`/admin/ambassador-requests/${id}`);

export const approveAmbassadorRequest = async (id: string, data: { channelId?: string; note?: string }) =>
  request<AmbassadorRequestRecord>(`/admin/ambassador-requests/${id}/approve`, { method: "POST", body: JSON.stringify(data) });

export const revokeAmbassador = async (id: string, note?: string) =>
  request<AmbassadorRequestRecord & { removedFrom?: string[] }>(`/admin/ambassador-requests/${id}/revoke`, { method: "POST", body: JSON.stringify({ note }) });

export const rejectAmbassadorRequest = async (id: string, note?: string) =>
  request<AmbassadorRequestRecord>(`/admin/ambassador-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) });

// --- Admin-managed channels: create, members and group chat -------------------------------------------

export type ChannelMemberRecord = {
  id: string;
  userId: string;
  name?: string;
  email?: string;
  userRole?: string;
  role: "member" | "admin";
  status: string;
  joinedAt: string;
};

export type ChatMessageRecord = {
  id: string;
  channelId: string;
  /** null for an announcement; otherwise the announcement this message replies to. */
  parentId: string | null;
  allowReplies: boolean;
  replyCount: number;
  senderId: string;
  senderName: string;
  senderRole: "seeker" | "hirer" | "admin";
  body: string;
  createdAt: string;
};

export const createAdminChannel = async (data: { name: string; bio?: string; visibility: "public" | "private" }) =>
  request<ChannelRecord>(`/admin/channels`, { method: "POST", body: JSON.stringify(data) });

export const getChannelMembers = async (channelId: string) => request<ChannelMemberRecord[]>(`/admin/channels/${channelId}/members`);

export const addChannelMember = async (channelId: string, userId: string) =>
  request<unknown>(`/admin/channels/${channelId}/members`, { method: "POST", body: JSON.stringify({ userId }) });

export const removeChannelMember = async (channelId: string, userId: string) =>
  request<unknown>(`/admin/channels/${channelId}/members/${userId}`, { method: "DELETE" });

export const getChannelMessages = async (channelId: string, params?: { before?: string; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.before) query.set("before", params.before);
  if (params?.limit) query.set("limit", String(params.limit));
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return request<ChatMessageRecord[]>(`/admin/channels/${channelId}/messages${queryString}`);
};

export const sendChannelMessage = async (channelId: string, body: string, options: { allowReplies?: boolean; parentId?: string } = {}) =>
  request<ChatMessageRecord>(`/admin/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify({ body, ...options }) });

/** Turns replies on or off for a post that is already published. */
export const setPostAllowReplies = async (channelId: string, messageId: string, allowReplies: boolean) =>
  request<ChatMessageRecord>(`/admin/channels/${channelId}/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ allowReplies }) });

export const getChannelThread = async (channelId: string, messageId: string) =>
  request<{ post: ChatMessageRecord; replies: ChatMessageRecord[] }>(`/admin/channels/${channelId}/messages/${messageId}/replies`);
