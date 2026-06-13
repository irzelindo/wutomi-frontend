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
  user?: CurrentUser | null;
  user_full_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  photo_url?: string | null;
  blood_type?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  allergies_summary?: string | null;
  chronic_conditions_summary?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
  consent_telemedicine?: boolean;
  consent_data_processing?: boolean;
  allergies?: PatientAllergy[];
  conditions?: PatientCondition[];
  medications?: PatientMedication[];
  insurance_details?: PatientInsurance[];
  emergency_contacts?: PatientContact[];
};

export type PatientAllergy = {
  id: number;
  allergen: string;
  severity: string;
  reaction_description?: string | null;
  notes?: string | null;
  created_at: string;
};

export type PatientCondition = {
  id: number;
  condition_name: string;
  icd10_code?: string | null;
  diagnosed_date?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
};

export type PatientMedication = {
  id: number;
  medication_name: string;
  dosage?: string | null;
  frequency?: string | null;
  prescribed_by?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
};

export type PatientInsurance = {
  id: number;
  provider_name: string;
  policy_number: string;
  plan_type?: string | null;
  coverage_details?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_primary: boolean;
  created_at: string;
};

export type PatientContact = {
  id: number;
  contact_name: string;
  relation_type?: string | null;
  phone: string;
  email?: string | null;
  is_primary: boolean;
  created_at: string;
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
  specialty_details?: string | null;
  subspecialty?: string | null;
  status?: string | null;
  consultation_fee?: string | number | null;
  currency?: string | null;
  telemedicine_enabled?: boolean;
  in_person_enabled?: boolean;
  years_of_experience?: number | null;
  biography?: string | null;
  average_rating?: string | number | null;
  experience?: string | null;
  availability_summary?: string | null;
  specialties?: DoctorSpecialty[];
  availability?: DoctorAvailability[];
};

export type DoctorSpecialty = {
  id: number;
  name: string;
  specialty_id?: string | null;
  specialty_code_system?: string | null;
  specialty_code?: string | null;
  specialty_code_display?: string | null;
  is_primary: boolean;
  created_at: string;
};

export type DoctorAvailability = {
  id: number;
  weekday: number;
  weekday_name: string;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
  location?: string | null;
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
