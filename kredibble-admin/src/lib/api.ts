export type AuthRole = "admin" | "seeker" | "hirer";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole | string;
};

type AuthResponse = {
  user: AuthUser;
  token: string;
};

const getApiUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl) return "http://localhost:4000/api";

  // Ensure the URL starts with https:// if it's a vercel/render domain
  if (envUrl.includes(".") && !envUrl.startsWith("http")) {
    return `https://${envUrl.replace(/\/$/, "")}`;
  }

  return envUrl.replace(/\/$/, "");
};

export const API_BASE_URL = getApiUrl();

const TOKEN_KEY = "kredibble_admin_token";
const USER_KEY = "kredibble_admin_user";

const getStoredToken = () =>
  typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);

export const hasAdminSession = () => Boolean(getStoredToken());

export const saveAdminSession = ({ token, user }: AuthResponse) => {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAdminSession = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
};

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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

export const getDashboardSummary = async () => {
  return request<Record<string, unknown>>("/dashboard/summary");
};

export const getVerifications = async (status?: string) => {
  const query = status ? `?status=${status}` : "";
  return request<Record<string, unknown>[]>(`/verification/companies${query}`);
};

export const updateVerificationStatus = async (companyId: string, status: string) => {
  return request<Record<string, unknown>>(`/verification/companies/${companyId}`, {
    method: "PATCH",
    body: JSON.stringify({ overallStatus: status }),
  });
};

export const getOpportunities = async (status?: string) => {
  const query = status ? `?status=${status}` : "";
  return request<Record<string, unknown>[]>(`/opportunities${query}`);
};

export const loginAdmin = async (email: string, password: string) => {
  const session = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (session.user.role !== "admin" && !session.user.role.toLowerCase().includes("admin")) {
    throw new Error("This account does not have admin access");
  }

  saveAdminSession(session);
  return session;
};

export const signupAdmin = async (values: { name: string; email: string; password: string }) => {
  const session = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...values, role: "admin" }),
  });
  saveAdminSession(session);
  return session;
};
