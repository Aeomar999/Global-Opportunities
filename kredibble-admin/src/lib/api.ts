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
    throw new Error(errorMsg);
  }

  return payload.data as T;
}

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

// There is deliberately no admin self-service signup. Public registration
// cannot mint the 'admin' role, so admins are provisioned server-side with
// `npm run user:create-admin -- --email ... --name ...` in kredibble-backend.