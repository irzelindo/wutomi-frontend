import type {
  AdminSummary,
  Appointment,
  CurrentUser,
  Doctor,
  Hospital,
  MedicalRecord,
  NotificationItem,
  NotificationPreference,
  OAuthProvider,
  PaginatedResponse,
  Patient,
  Specialty,
  TokenResponse,
  Wallet,
  WalletTransaction,
} from "./types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "https://api.wutomi.com";

let accessToken = localStorage.getItem("wutomi.accessToken") || "";
let refreshToken = localStorage.getItem("wutomi.refreshToken") || "";

export function setSession(session?: TokenResponse | null) {
  accessToken = session?.access_token || "";
  refreshToken = session?.refresh_token || "";
  if (session) {
    localStorage.setItem("wutomi.accessToken", session.access_token);
    localStorage.setItem("wutomi.refreshToken", session.refresh_token);
  } else {
    localStorage.removeItem("wutomi.accessToken");
    localStorage.removeItem("wutomi.refreshToken");
  }
}

export function setAccessToken(token: string) {
  accessToken = token;
  if (token) localStorage.setItem("wutomi.accessToken", token);
  else localStorage.removeItem("wutomi.accessToken");
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function pageItems<T>(payload: PaginatedResponse<T> | T[]): T[] {
  if (Array.isArray(payload)) return payload;
  return payload.items || payload.results || [];
}

export const api = {
  health: () => request<{ status: string; database: string }>("/health"),
  register: (payload: { email: string; full_name: string; password: string }) =>
    request<CurrentUser>("/api/v1/users/", { method: "POST", body: JSON.stringify(payload) }),
  login: (email: string, password: string) =>
    request<TokenResponse>("/api/v1/auth/login/json", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<void>("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }),
  forgotPassword: (email: string) =>
    request<{ message: string; reset_token?: string | null }>("/api/v1/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  changePassword: (payload: { current_password: string; new_password: string }) =>
    request<CurrentUser>("/api/v1/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),
  sendVerification: () => request<{ message: string; verification_token?: string | null }>("/api/v1/auth/send-verification", { method: "POST" }),
  oauthProviders: () => request<OAuthProvider[]>("/api/v1/auth/oauth/providers"),
  oauthAuthorize: (provider: string) => request<{ provider: string; authorization_url: string }>(`/api/v1/auth/oauth/${provider}/authorize`),
  me: () => request<CurrentUser>("/api/v1/auth/me"),
  updateUser: (userId: string, payload: unknown) =>
    request<CurrentUser>(`/api/v1/users/${userId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  appointments: () => request<PaginatedResponse<Appointment>>("/api/v1/appointments/"),
  confirmAppointment: (id: string) => request<Appointment>(`/api/v1/appointments/${id}/confirm`, { method: "POST" }),
  checkInAppointment: (id: string) => request<Appointment>(`/api/v1/appointments/${id}/check-in`, { method: "POST" }),
  completeAppointment: (id: string) => request<Appointment>(`/api/v1/appointments/${id}/complete`, { method: "POST" }),
  cancelAppointment: (id: string, reason: string) =>
    request<Appointment>(`/api/v1/appointments/${id}/cancel`, { method: "POST", body: JSON.stringify({ cancellation_reason: reason }) }),
  patients: () => request<PaginatedResponse<Patient>>("/api/v1/patients/"),
  createPatient: (payload: unknown) => request<Patient>("/api/v1/patients/", { method: "POST", body: JSON.stringify(payload) }),
  doctors: () => request<PaginatedResponse<Doctor>>("/api/v1/doctors/"),
  createDoctor: (payload: unknown) => request<Doctor>("/api/v1/doctors/", { method: "POST", body: JSON.stringify(payload) }),
  hospitals: () => request<PaginatedResponse<Hospital>>("/api/v1/hospitals/"),
  createHospital: (payload: unknown) => request<Hospital>("/api/v1/hospitals/", { method: "POST", body: JSON.stringify(payload) }),
  specialties: () => request<PaginatedResponse<Specialty>>("/api/v1/specialties/translations?locale=pt-MZ"),
  createHospitalAppointment: (hospitalId: string, payload: unknown) =>
    request<Appointment>(`/api/v1/hospitals/${hospitalId}/appointments`, { method: "POST", body: JSON.stringify(payload) }),
  wallet: () => request<Wallet>("/api/v1/wallet/me"),
  walletTransactions: () => request<PaginatedResponse<WalletTransaction>>("/api/v1/wallet/me/transactions"),
  topUpWallet: (payload: unknown) => request("/api/v1/wallet/me/top-up", { method: "POST", body: JSON.stringify(payload) }),
  medicalRecords: () => request<PaginatedResponse<MedicalRecord>>("/api/v1/medical-records/"),
  createMedicalRecord: (payload: unknown) => request<MedicalRecord>("/api/v1/medical-records/", { method: "POST", body: JSON.stringify(payload) }),
  icdCodes: (q: string) => request<{ code: string; title: string; version: string }[]>(`/api/v1/medical-records/icd-codes?q=${encodeURIComponent(q)}`),
  notifications: () => request<PaginatedResponse<NotificationItem>>("/api/v1/notifications"),
  markNotificationRead: (id: string) => request<NotificationItem>(`/api/v1/notifications/${id}/read`, { method: "PATCH" }),
  preferences: () => request<NotificationPreference[]>("/api/v1/notification-preferences"),
  updatePreference: (payload: { channel: string; enabled: boolean }) =>
    request<NotificationPreference>("/api/v1/notification-preferences", { method: "PATCH", body: JSON.stringify(payload) }),
  adminSummary: () => request<AdminSummary>("/api/v1/admin/summary"),
};
