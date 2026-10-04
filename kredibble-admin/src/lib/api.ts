export type AuthRole = "admin" | "seeker" | "hirer";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole | string;
};

type AuthResponse = {
  user: AuthUser;
  // token is no longer returned in body — it's set as httpOnly cookie
};

const getApiUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl) return "http://localhost:4000/api";

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

// Frontend-only read of the user saved at login (used by the top bar).
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
 * Error thrown for any non-2xx API response. Keeps the server message as
 * `message` (unchanged behaviour) and adds the HTTP status and, for 429
 * responses, the Retry-After value in seconds so the UI can react.
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

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError(errorMsg, response.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined);
  }

  return payload.data as T;
}

export const getDashboardSummary = async () => {
  return request<Record<string, unknown>>("/dashboard/summary");
};

export const getVerifications = async (status?: string) => {
  const query = status ? `?status=${status}` : "";
  return request<unknown[]>(`/verification/companies${query}`);
};

export const updateVerificationStatus = async (companyId: string, status: string) => {
  return request<Record<string, unknown>>(`/verification/companies/${companyId}`, {
    method: "PATCH",
    body: JSON.stringify({ overallStatus: status }),
  });
};

export const getOpportunities = async (status?: string) => {
  const query = status ? `?status=${status}` : "";
  return request<unknown[]>(`/opportunities${query}`);
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

// There is deliberately no admin self-service signup. Public registration
// cannot mint the 'admin' role, so admins are provisioned server-side with
// `npm run user:create-admin -- --email ... --name ...` in kredibble-backend.