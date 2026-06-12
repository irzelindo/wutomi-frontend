export type Role = "hospital" | "doctor" | "patient" | "admin";

export type PaginatedResponse<T> = {
  items?: T[];
  results?: T[];
  total?: number;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type CurrentUser = {
  id: string;
  email: string;
  full_name: string;
  national_id?: string | null;
  phone?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  document_type?: string | null;
  document_number?: string | null;
  photo_url?: string | null;
  address?: string | null;
  locale?: string | null;
  timezone?: string | null;
  role: string;
  is_active?: boolean;
  is_admin?: boolean;
  is_verified?: boolean;
};

export type OAuthProvider = {
  provider: string;
  display_name: string;
  configured: boolean;
};

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  hospital_id?: string | null;
  patient_full_name?: string | null;
  doctor_full_name?: string | null;
  doctor_specialty?: string | null;
  hospital_name?: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  type: string;
  location?: string | null;
  reason?: string | null;
};

export type Patient = {
  id: string;
  user_id?: string | null;
  user_full_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  blood_type?: string | null;
};

export type Doctor = {
  id: string;
  user_id?: string;
  user_full_name?: string | null;
  user_email?: string | null;
  license_number?: string;
  specialty?: string | null;
  specialty_id?: string | null;
  specialty_description?: string | null;
  status?: string | null;
  consultation_fee?: string | number | null;
  currency?: string | null;
  telemedicine_enabled?: boolean;
  in_person_enabled?: boolean;
  years_of_experience?: number | null;
};

export type Hospital = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  is_active?: boolean;
};

export type Specialty = {
  id: string;
  name: string;
  description?: string | null;
  details?: string | null;
  locale?: string | null;
  classification?: string | null;
  grouping?: string | null;
  coding_code?: string | null;
};

export type Wallet = {
  id?: number;
  balance: string | number;
  currency: string;
};

export type WalletTransaction = {
  id: number;
  amount: string | number;
  direction: "credit" | "debit";
  transaction_type?: string;
  description?: string | null;
  provider?: string | null;
  created_at: string;
};

export type NotificationPreference = {
  id: string;
  channel: string;
  enabled: boolean;
};

export type NotificationItem = {
  id: string;
  channel: string;
  subject?: string | null;
  body: string;
  status: string;
  created_at: string;
  read_at?: string | null;
};

export type MedicalRecord = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string | null;
  patient_full_name?: string | null;
  doctor_full_name?: string | null;
  chief_complaint?: string | null;
  assessment?: string | null;
  created_at: string;
};

export type AdminSummary = {
  total_users: number;
  active_users: number;
  admin_users?: number;
  total_doctors: number;
  active_doctors: number;
  total_patients: number;
  total_appointments: number;
  pending_appointments: number;
  completed_appointments: number;
  total_payments: number;
  completed_payments: number;
  total_revenue: string | number;
};
