import type { AdminSummary, Appointment, Doctor, Hospital, Patient, Specialty, Wallet, WalletTransaction } from "./types";

const now = Date.now();

export const demoAppointments: Appointment[] = [
  {
    id: "APT-2026-00001-ABC",
    patient_id: "PT-2026-00001-AAA",
    doctor_id: "DC-2026-00001-BBB",
    hospital_id: "HSP-2026-00001-AAA",
    patient_full_name: "Joao Manuel dos Santos",
    doctor_full_name: "Dra. Maria Silva",
    doctor_specialty: "Cardiologia",
    hospital_name: "Hospital Central de Maputo",
    scheduled_start: new Date(now + 20 * 60 * 1000).toISOString(),
    scheduled_end: new Date(now + 50 * 60 * 1000).toISOString(),
    status: "confirmed",
    type: "in_person",
    location: "Recepcao A, sala 203",
    reason: "Acompanhamento de hipertensao",
  },
  {
    id: "APT-2026-00002-DEF",
    patient_id: "PT-2026-00002-BBB",
    doctor_id: "DC-2026-00002-CCC",
    hospital_id: "HSP-2026-00002-BBB",
    patient_full_name: "Ana Chissano",
    doctor_full_name: "Dr. Ernesto Mussa",
    doctor_specialty: "Pediatria",
    hospital_name: "Clinica Polana",
    scheduled_start: new Date(now + 95 * 60 * 1000).toISOString(),
    scheduled_end: new Date(now + 125 * 60 * 1000).toISOString(),
    status: "pending",
    type: "in_person",
    location: "Bloco B",
    reason: "Febre recorrente",
  },
  {
    id: "APT-2026-00003-GHI",
    patient_id: "PT-2026-00003-CCC",
    doctor_id: "DC-2026-00003-DDD",
    hospital_id: "HSP-2026-00001-AAA",
    patient_full_name: "Celeste Macuacua",
    doctor_full_name: "Dra. Helena Nhampossa",
    doctor_specialty: "Ginecologia",
    hospital_name: "Hospital Central de Maputo",
    scheduled_start: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    scheduled_end: new Date(now - 90 * 60 * 1000).toISOString(),
    status: "completed",
    type: "in_person",
    location: "Consulta externa",
    reason: "Consulta de rotina",
  },
];

export const demoPatients: Patient[] = [
  { id: "PT-2026-00001-AAA", user_full_name: "Joao Manuel dos Santos", phone: "+258840000001", blood_type: "O+" },
  { id: "PT-2026-00002-BBB", user_full_name: "Ana Chissano", phone: "+258840000002", blood_type: "A+" },
  { id: "PT-2026-00003-CCC", user_full_name: "Celeste Macuacua", phone: "+258840000003", blood_type: "desconhecido" },
];

export const demoDoctors: Doctor[] = [
  {
    id: "DC-2026-00001-BBB",
    user_full_name: "Dra. Maria Silva",
    user_email: "maria.silva@example.com",
    specialty: "Cardiologia",
    status: "active",
    consultation_fee: "1500.00",
    currency: "MZN",
    in_person_enabled: true,
    telemedicine_enabled: true,
  },
  {
    id: "DC-2026-00002-CCC",
    user_full_name: "Dr. Ernesto Mussa",
    user_email: "ernesto.mussa@example.com",
    specialty: "Pediatria",
    status: "active",
    consultation_fee: "900.00",
    currency: "MZN",
    in_person_enabled: true,
  },
  {
    id: "DC-2026-00003-DDD",
    user_full_name: "Dra. Helena Nhampossa",
    user_email: "helena.nhampossa@example.com",
    specialty: "Ginecologia",
    status: "pending",
    consultation_fee: "1200.00",
    currency: "MZN",
    in_person_enabled: true,
  },
];

export const demoHospitals: Hospital[] = [
  { id: "HSP-2026-00001-AAA", name: "Hospital Central de Maputo", city: "Maputo", province: "Maputo" },
  { id: "HSP-2026-00002-BBB", name: "Clinica Polana", city: "Maputo", province: "Maputo" },
];

export const demoSpecialties: Specialty[] = [
  { id: "SPC-2026-00001-AAA", name: "Cardiologia", classification: "Internal Medicine" },
  { id: "SPC-2026-00002-BBB", name: "Pediatria", classification: "Pediatrics" },
  { id: "SPC-2026-00003-CCC", name: "Ginecologia", classification: "Obstetrics & Gynecology" },
];

export const demoWallet: Wallet = {
  balance: "2500.00",
  currency: "MZN",
};

export const demoTransactions: WalletTransaction[] = [
  {
    id: 1,
    amount: "500.00",
    direction: "credit",
    transaction_type: "top_up",
    description: "Carregamento via M-Pesa",
    provider: "mpesa",
    created_at: new Date(now - 40 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    amount: "100.00",
    direction: "debit",
    transaction_type: "booking_fee",
    description: "Taxa de confirmacao de consulta",
    created_at: new Date(now - 30 * 60 * 1000).toISOString(),
  },
];

export const demoAdminSummary: AdminSummary = {
  total_users: 42,
  active_users: 38,
  admin_users: 2,
  total_doctors: 11,
  active_doctors: 9,
  total_patients: 27,
  total_appointments: 64,
  pending_appointments: 8,
  completed_appointments: 46,
  total_payments: 31,
  completed_payments: 29,
  total_revenue: "45800.00",
};

export const demoMedicalRecords = [
  {
    id: "MR-2026-00001-AAA",
    patient_id: "PT-2026-00001-AAA",
    doctor_id: "DC-2026-00001-BBB",
    appointment_id: "APT-2026-00001-ABC",
    patient_full_name: "Joao Manuel dos Santos",
    doctor_full_name: "Dra. Maria Silva",
    chief_complaint: "Dor no peito e cansaco",
    assessment: "Pressao arterial elevada, sem sinais de urgencia",
    created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "MR-2026-00002-BBB",
    patient_id: "PT-2026-00002-BBB",
    doctor_id: "DC-2026-00002-CCC",
    appointment_id: "APT-2026-00002-DEF",
    patient_full_name: "Ana Chissano",
    doctor_full_name: "Dr. Ernesto Mussa",
    chief_complaint: "Febre recorrente",
    assessment: "Quadro viral provavel, hidratar e observar 48h",
    created_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const demoNotifications = [
  {
    id: "NTF-2026-00001-AAA",
    channel: "in_app",
    subject: "Consulta confirmada",
    body: "A consulta com Dra. Maria Silva foi confirmada.",
    status: "sent",
    created_at: new Date(now - 25 * 60 * 1000).toISOString(),
  },
  {
    id: "NTF-2026-00002-BBB",
    channel: "sms",
    subject: "Lembrete",
    body: "Chegue 15 minutos antes da consulta.",
    status: "pending",
    created_at: new Date(now - 10 * 60 * 1000).toISOString(),
  },
];

export const demoPreferences = [
  { id: "PRF-1", channel: "in_app", enabled: true },
  { id: "PRF-2", channel: "email", enabled: true },
  { id: "PRF-3", channel: "sms", enabled: false },
  { id: "PRF-4", channel: "push", enabled: false },
];
