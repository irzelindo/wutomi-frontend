import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  Bell,
  Building2,
  CalendarDays,
  ClipboardPlus,
  CreditCard,
  FileText,
  HeartPulse,
  KeyRound,
  LogOut,
  Menu,
  MapPin,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  UserRound,
  WalletCards,
} from "lucide-react";
import { ApiError, SESSION_EXPIRED_EVENT, api, clearEmailVerificationTokenFromUrl, clearOauthHash, getAccessToken, pageItems, readEmailVerificationTokenFromUrl, readOauthSessionFromUrl, setSession } from "./api";
import {
  demoAdminSummary,
  demoAppointments,
  demoDoctors,
  demoHospitals,
  demoMedicalRecords,
  demoNotifications,
  demoPatients,
  demoPreferences,
  demoSpecialties,
  demoTransactions,
  demoWallet,
} from "./demoData";
import type { Appointment, CurrentUser, Doctor, Hospital as HospitalType, MedicalRecord, Patient, Role, Specialty } from "./types";

type View = "overview" | "auth" | "users" | "appointments" | "booking" | "patients" | "doctors" | "hospitals" | "specialties" | "records" | "notifications" | "wallet" | "profile" | "settings" | "admin";
type AuthMode = "login" | "register" | "forgot" | "oauth";
type Access = "public" | "patient" | "doctor" | "hospital" | "admin" | "clinical" | "authenticated";
type ProfilePayload = {
  action: "save_profile" | "add_allergy" | "add_condition" | "add_medication" | "add_insurance" | "add_contact";
  user: Record<string, string>;
  patient?: Record<string, string | boolean>;
  allergy?: Record<string, string>;
  condition?: Record<string, string>;
  medication?: Record<string, string | boolean>;
  insurance?: Record<string, string | boolean>;
  contact?: Record<string, string | boolean>;
};

type ModuleSpec = {
  view: View;
  label: string;
  icon: typeof Activity;
  access: Access[];
  summary: string;
};

const modules: ModuleSpec[] = [
  { view: "overview", label: "Visão geral", icon: Activity, access: ["public", "patient", "doctor", "hospital", "admin"], summary: "Resumo da atividade e próximos passos." },
  { view: "auth", label: "Acesso", icon: KeyRound, access: ["public"], summary: "Entrar, criar conta, recuperar acesso e usar Google ou GitHub." },
  { view: "booking", label: "Agendamento", icon: ClipboardPlus, access: ["patient", "hospital", "admin"], summary: "Escolha hospital, especialidade, médico e horário." },
  { view: "appointments", label: "Consultas", icon: CalendarDays, access: ["patient", "doctor", "hospital", "admin"], summary: "Acompanhe marcações, estados e histórico." },
  { view: "patients", label: "Perfil clínico", icon: UserRound, access: ["doctor", "hospital", "admin"], summary: "Dados clínicos, consentimentos, alergias, medicação e contactos." },
  { view: "doctors", label: "Médicos", icon: Stethoscope, access: ["doctor", "hospital", "admin", "patient"], summary: "Encontre médicos por especialidade, hospital e disponibilidade." },
  { view: "hospitals", label: "Hospitais", icon: Building2, access: ["hospital", "admin", "patient", "doctor"], summary: "Escolha uma unidade de atendimento próxima." },
  { view: "specialties", label: "Especialidades", icon: BadgeCheck, access: ["patient", "doctor", "hospital", "admin"], summary: "Conheça áreas clínicas e escolha a mais adequada." },
  { view: "records", label: "Prontuário", icon: FileText, access: ["doctor", "patient", "admin"], summary: "Notas clínicas, diagnósticos, prescrições e anexos." },
  { view: "notifications", label: "Notificações", icon: Bell, access: ["patient", "doctor", "hospital", "admin"], summary: "Lembretes, avisos e preferências de contacto." },
  { view: "wallet", label: "Carteira", icon: WalletCards, access: ["doctor", "hospital"], summary: "Saldo, carregamentos e movimentos." },
  { view: "profile", label: "Perfil", icon: UserRound, access: ["patient", "doctor", "hospital", "admin"], summary: "Dados pessoais, contacto e preferências regionais." },
  { view: "settings", label: "Configurações", icon: Settings, access: ["patient", "doctor", "hospital", "admin"], summary: "Preferências, notificações e modo de demonstração." },
  { view: "admin", label: "Admin", icon: ShieldCheck, access: ["admin"], summary: "Auditoria, validações, gestão operacional e segurança." },
];

const viewTitles = Object.fromEntries(modules.map((item) => [item.view, item.label])) as Record<View, string>;
const statusLabels: Record<string, string> = { pending: "Pendente", confirmed: "Confirmada", in_progress: "Em consulta", completed: "Concluída", cancelled: "Cancelada", no_show: "Faltou", rescheduled: "Reagendada", active: "Ativo", sent: "Enviada", read: "Lida" };
const PUBLIC_REGISTRATION_ENABLED = import.meta.env.VITE_ENABLE_PUBLIC_REGISTRATION !== "false";
const BOOKING_SLOT_MINUTES = 30;

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-MZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatMoney(value?: string | number | null, currency = "MZN") {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("pt-MZ", { maximumFractionDigits: 2 })} ${currency}`;
}

function roleFromUser(user?: CurrentUser, selected: Role = "patient"): Role {
  if (user?.is_admin || user?.role === "admin") return "admin";
  if (user?.role === "doctor" || user?.role === "hospital" || user?.role === "patient") return user.role;
  return selected;
}

function canAccess(module: ModuleSpec, role: Role, authenticated: boolean) {
  if (!authenticated) return module.access.includes("public");
  if (module.access.includes(role) || module.access.includes("authenticated")) return true;
  if (module.access.includes("clinical") && (role === "doctor" || role === "admin")) return true;
  return false;
}

function roleHasWallet(role: Role) {
  return role === "doctor" || role === "hospital";
}

function canLoadRecords(role: Role) {
  return role === "patient" || role === "doctor" || role === "admin";
}

function hasPatientPersonalData(user?: CurrentUser, patient?: Patient) {
  const patientUser = patient?.user;
  return Boolean(
    (user?.full_name || patientUser?.full_name || patient?.full_name || patient?.user_full_name) &&
    (user?.email || patientUser?.email) &&
    (user?.phone || patientUser?.phone || patient?.phone) &&
    (user?.gender || patientUser?.gender) &&
    (user?.date_of_birth || patientUser?.date_of_birth || patient?.date_of_birth) &&
    (user?.document_type || patientUser?.document_type) &&
    (user?.document_number || patientUser?.document_number) &&
    (user?.address || patientUser?.address)
  );
}

function errorText(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  try {
    const parsed = JSON.parse(raw);
    return parsed.message || parsed.detail || parsed.code || raw;
  } catch {
    return raw;
  }
}

function verificationError(error: unknown) {
  const message = errorText(error).toLowerCase();
  if (message.includes("email delivery failed") || message.includes("service_unavailable")) {
    return "Não foi possível enviar o email de verificação neste momento. Tente novamente mais tarde.";
  }
  return "Não foi possível enviar o email de verificação. Tente novamente.";
}

function findPatientId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value.match(/PT-\d{4}-[A-Z0-9-]+/i)?.[0];
  if (Array.isArray(value)) return value.map(findPatientId).find(Boolean);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const direct = record.patient_id || record.patientId || record.existing_patient_id || record.id;
    if (typeof direct === "string" && direct.startsWith("PT-")) return direct;
    return Object.values(record).map(findPatientId).find(Boolean);
  }
  return undefined;
}

function patientIdFromError(error: unknown) {
  if (!(error instanceof Error)) return undefined;
  try {
    return findPatientId(JSON.parse(error.message));
  } catch {
    return findPatientId(error.message);
  }
}

function friendlyError(error: unknown, context: "login" | "register" | "forgot" | "profile" | "patient-profile" | "appointment" | "appointment-action" | "record" | "wallet" | "preferences" | "modules") {
  if (context === "modules") return "Alguns dados não foram carregados. Atualize a página ou tente novamente.";
  const message = errorText(error).toLowerCase();
  if (context === "appointment" && (message.includes("outside doctor's availability") || message.includes("availability") || message.includes("requested time"))) {
    return "O horário selecionado não está disponível para este médico. Escolha outro horário dentro da agenda disponível.";
  }
  if (context === "appointment" && message.includes("missing_patient_personal_data")) {
    return "Complete os dados pessoais antes de marcar a consulta.";
  }
  if (context === "appointment" && message.includes("patient_profile_lookup_failed")) {
    return "Não conseguimos identificar o seu perfil de paciente para marcar a consulta. Atualize a página e tente novamente.";
  }
  if (message.includes("forbidden") || message.includes("permission")) {
    return "A sua conta não tem permissão para realizar esta ação.";
  }
  if (message.includes("unauthorized") || message.includes("401")) {
    return "A sua sessão expirou. Entre novamente para continuar.";
  }
  if (message.includes("bad_request") || message.includes("400")) {
    return "Revise os dados preenchidos e tente novamente.";
  }

  const fallback: Record<Exclude<typeof context, "modules">, string> = {
    login: "Não foi possível iniciar sessão. Verifique os dados e tente novamente.",
    register: "Não foi possível criar a conta. Revise os dados e tente novamente.",
    forgot: "Não foi possível enviar a recuperação de senha. Tente novamente em instantes.",
    profile: "Não foi possível guardar o perfil. Revise os dados e tente novamente.",
    "patient-profile": "Não foi possível preparar o perfil de paciente. Atualize a página ou tente novamente.",
    appointment: "Não foi possível solicitar a marcação. Revise os dados e tente novamente.",
    "appointment-action": "Não foi possível atualizar a consulta. Tente novamente.",
    record: "Não foi possível guardar o prontuário. Tente novamente.",
    wallet: "Não foi possível concluir a operação da carteira. Tente novamente.",
    preferences: "Não foi possível atualizar a preferência. Tente novamente.",
  };
  return fallback[context];
}

function isSessionExpired(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  const message = error.message.toLowerCase();
  return error.status === 401 || (error.status === 403 && (message.includes("token") || message.includes("session") || message.includes("authenticated")));
}

function usePrivateQuery<T>(key: string[], queryFn: () => Promise<T>, enabled = true) {
  return useQuery({ queryKey: key, queryFn, enabled: Boolean(getAccessToken()) && enabled, retry: 1 });
}

export function App() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("overview");
  const [selectedRole, setSelectedRole] = useState<Role>("patient");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const oauthSession = readOauthSessionFromUrl();
    if (!oauthSession) return;
    setSession(oauthSession);
    clearOauthHash();
    setDemoMode(false);
    setNotice("Sessão iniciada. Vamos começar pela escolha do hospital.");
    setView("booking");
    queryClient.invalidateQueries();
  }, [queryClient]);

  useEffect(() => {
    const token = readEmailVerificationTokenFromUrl();
    if (!token) return;
    api.verifyEmail(token).then((updatedUser) => {
      clearEmailVerificationTokenFromUrl();
      setNotice("Email verificado com sucesso.");
      queryClient.setQueryData(["me"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    }).catch((error) => {
      clearEmailVerificationTokenFromUrl();
      setNotice(errorText(error) ? "Não foi possível verificar o email. Solicite um novo link e tente novamente." : "Não foi possível verificar o email. Solicite um novo link.");
    });
  }, [queryClient]);

  const authenticated = Boolean(getAccessToken());
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, retry: 0 });
  const oauthProviders = useQuery({ queryKey: ["oauth-providers"], queryFn: api.oauthProviders, retry: 0 });
  const user = usePrivateQuery(["me"], api.me);
  const role = roleFromUser(user.data, selectedRole);
  const userReady = !authenticated || Boolean(user.data);
  const hasWallet = roleHasWallet(role);
  const appointmentsQuery = usePrivateQuery(["appointments"], api.appointments, userReady);
  const patientsQuery = usePrivateQuery(["patients", role], role === "patient" ? api.patientMe : api.patients, userReady);
  const doctorsQuery = usePrivateQuery(["doctors"], api.doctors, userReady);
  const hospitalsQuery = usePrivateQuery(["hospitals"], api.hospitals, userReady);
  const specialtiesQuery = usePrivateQuery(["specialties"], api.specialties, userReady);
  const walletQuery = usePrivateQuery(["wallet", role], api.wallet, userReady && hasWallet);
  const transactionsQuery = usePrivateQuery(["wallet-transactions", role], api.walletTransactions, userReady && hasWallet);
  const recordsQuery = usePrivateQuery(["medical-records", role], api.medicalRecords, userReady && canLoadRecords(role));
  const notificationsQuery = usePrivateQuery(["notifications"], api.notifications, userReady);
  const preferencesQuery = usePrivateQuery(["preferences"], api.preferences, userReady);
  const adminQuery = usePrivateQuery(["admin-summary"], api.adminSummary, userReady && role === "admin");

  const visibleModules = modules.filter((item) => canAccess(item, role, authenticated));

  const finishSession = useCallback((message: string) => {
    setSession(null);
    setDemoMode(false);
    queryClient.clear();
    setNotice(message);
    setAuthMode("login");
    setView("overview");
  }, [queryClient]);

  useEffect(() => {
    if (!visibleModules.some((item) => item.view === view)) setView(visibleModules[0]?.view || "overview");
  }, [role, authenticated, view, visibleModules]);

  useEffect(() => {
    if (!PUBLIC_REGISTRATION_ENABLED && authMode === "register") setAuthMode("login");
  }, [authMode]);

  useEffect(() => {
    const handleSessionExpired = () => finishSession("A sua sessão expirou. Entre novamente para continuar.");
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [finishSession]);

  useEffect(() => {
    if (!authenticated) return;
    const privateErrors = [
      user.error,
      appointmentsQuery.error,
      patientsQuery.error,
      doctorsQuery.error,
      hospitalsQuery.error,
      specialtiesQuery.error,
      recordsQuery.error,
      notificationsQuery.error,
      walletQuery.error,
      transactionsQuery.error,
      preferencesQuery.error,
      adminQuery.error,
    ];
    if (privateErrors.some(isSessionExpired)) {
      finishSession("A sua sessão expirou. Entre novamente para continuar.");
    }
  }, [
    authenticated,
    user.error,
    appointmentsQuery.error,
    patientsQuery.error,
    doctorsQuery.error,
    hospitalsQuery.error,
    specialtiesQuery.error,
    recordsQuery.error,
    notificationsQuery.error,
    walletQuery.error,
    transactionsQuery.error,
    preferencesQuery.error,
    adminQuery.error,
    finishSession,
  ]);

  const appointments = dataOrDemo(appointmentsQuery.data, demoAppointments, demoMode);
  const patients = dataOrDemo(patientsQuery.data, demoPatients, demoMode);
  const doctors = dataOrDemo(doctorsQuery.data, demoDoctors, demoMode);
  const doctorDetailQueries = useQueries({
    queries: doctors.map((doctor) => ({
      queryKey: ["doctor-detail", doctor.id],
      queryFn: () => api.doctor(doctor.id),
      enabled: Boolean(authenticated && !demoMode && view === "doctors" && doctor.id),
      retry: 1,
    })),
  });
  const doctorDetails = doctorDetailQueries.map((query) => query.data).filter(Boolean) as Doctor[];
  const doctorsWithDetails = doctors.map((doctor) => ({ ...doctor, ...doctorDetails.find((detail) => detail.id === doctor.id) }));
  const hospitals = dataOrDemo(hospitalsQuery.data, demoHospitals, demoMode);
  const specialties = dataOrDemo(specialtiesQuery.data, demoSpecialties, demoMode);
  const transactions = dataOrDemo(transactionsQuery.data, demoTransactions, demoMode);
  const records = dataOrDemo(recordsQuery.data, demoMedicalRecords, demoMode);
  const notifications = dataOrDemo(notificationsQuery.data, demoNotifications, demoMode);
  const preferences = preferencesQuery.data || (demoMode ? demoPreferences : []);
  const adminSummary = adminQuery.data || (demoMode ? demoAdminSummary : emptyAdminSummary);
  const wallet = walletQuery.data || (demoMode ? demoWallet : { balance: 0, currency: "MZN" });
  const currentPrivateErrors = currentViewErrors(view, {
    appointments: appointmentsQuery.error,
    booking: hospitalsQuery.error,
    patients: patientsQuery.error,
    doctors: doctorsQuery.error,
    hospitals: hospitalsQuery.error,
    specialties: specialtiesQuery.error,
    records: recordsQuery.error,
    notifications: notificationsQuery.error || preferencesQuery.error,
    wallet: walletQuery.error || transactionsQuery.error,
    profile: patientsQuery.error,
    settings: preferencesQuery.error,
    admin: adminQuery.error,
  }).filter((error): error is Error => error instanceof Error && !isSessionExpired(error));

  const login = useMutation({
    mutationFn: (payload: { email: string; password: string }) => api.login(payload.email, payload.password),
    onSuccess: (session) => { setSession(session); setDemoMode(false); setNotice("Sessão iniciada. Vamos começar pela escolha do hospital."); setView("booking"); queryClient.invalidateQueries(); },
    onError: (error) => setNotice(friendlyError(error, "login")),
  });

  const register = useMutation({
    mutationFn: (payload: { email: string; full_name: string; password: string; role: string }) => {
      if (!PUBLIC_REGISTRATION_ENABLED) throw new Error("PUBLIC_REGISTRATION_DISABLED");
      return api.register({ email: payload.email, full_name: payload.full_name, password: payload.password });
    },
    onSuccess: (_, payload) => { setNotice(`Conta criada para ${payload.full_name}. Entre e complete o perfil de ${roleLabel(payload.role)}.`); setSelectedRole(payload.role as Role); setAuthMode("login"); },
    onError: (error) => setNotice(error instanceof Error && error.message === "PUBLIC_REGISTRATION_DISABLED" ? "Cadastro público desativado. Solicite criação de conta à equipa administrativa." : friendlyError(error, "register")),
  });

  const forgot = useMutation({ mutationFn: api.forgotPassword, onSuccess: () => setNotice("Se o email estiver registado, enviaremos instruções para recuperar a senha."), onError: (error) => setNotice(friendlyError(error, "forgot")) });
  const sendVerification = useMutation({
    mutationFn: api.sendVerification,
    onSuccess: () => setNotice("Enviámos um link de verificação para o seu email."),
    onError: (error) => setNotice(verificationError(error)),
  });
  const updateProfile = useMutation({
    mutationFn: async (payload: ProfilePayload) => {
      const updatedUser = payload.action === "save_profile" ? await api.updateUser(user.data?.id || "", payload.user) : user.data;
      let patient: Patient | undefined;
      if (role === "patient") {
        let currentPatient;
        try {
          currentPatient = role === "patient" ? await api.patientMe() : await api.patients();
        } catch (error) {
          if (payload.action === "save_profile") return { updatedUser, patient, action: payload.action };
          throw error;
        }
        patient = pageItems(currentPatient)[0];
        const { consent_telemedicine, consent_data_processing, ...patientProfile } = payload.patient || {};
        if (!patient) {
          try {
            patient = await api.createPatient({
              user_id: updatedUser?.id,
              ...patientProfile,
            });
          } catch (error) {
            if (error instanceof ApiError && error.status === 409 && payload.action === "save_profile") return { updatedUser, patient, action: payload.action };
            throw error;
          }
          if (payload.action === "save_profile" && payload.patient) {
            patient = await api.updatePatientConsents(patient.id, { consent_telemedicine, consent_data_processing });
          }
        } else if (payload.action === "save_profile" && payload.patient) {
          patient = await api.updatePatient(patient.id, patientProfile);
          patient = await api.updatePatientConsents(patient.id, { consent_telemedicine, consent_data_processing });
        }
        if (patient) await savePatientSubresources(patient.id, payload);
      }
      return { updatedUser, patient, action: payload.action };
    },
    onSuccess: (data) => {
      setNotice(data.action === "save_profile" ? (data.patient ? "Perfil de paciente atualizado. Já pode marcar consulta." : "Perfil atualizado.") : "Registo adicionado ao perfil do paciente.");
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      if (data.patient) queryClient.setQueryData(["patients", "patient"], { items: [data.patient], total: 1 });
    },
    onError: (error) => setNotice(friendlyError(error, "profile")),
  });
  const appointmentAction = useMutation({ mutationFn: ({ id, action }: { id: string; action: "confirm" | "check-in" | "complete" }) => action === "confirm" ? api.confirmAppointment(id) : action === "check-in" ? api.checkInAppointment(id) : api.completeAppointment(id), onSuccess: () => { setNotice("Consulta atualizada."); queryClient.invalidateQueries({ queryKey: ["appointments"] }); }, onError: (error) => setNotice(friendlyError(error, "appointment-action")) });
  const createAppointment = useMutation({
    mutationFn: async (payload: unknown) => {
      const appointment = { ...(payload as Record<string, unknown>) };
      if (role === "patient" && !appointment.patient_id) {
        if (!hasPatientPersonalData(user.data, patients[0])) throw new Error("MISSING_PATIENT_PERSONAL_DATA");
        let patient: Patient | undefined = patients[0];
        if (!patient?.id) {
          try {
            patient = await api.createPatient({ user_id: user.data?.id });
          } catch (error) {
            if (!(error instanceof ApiError && error.status === 409)) throw error;
            const existingPatientId = patientIdFromError(error);
            if (existingPatientId) {
              patient = { id: existingPatientId } as Patient;
            } else {
              patient = pageItems(await api.patientMeOptional())[0];
            }
          }
        }
        if (!patient?.id) throw new Error("PATIENT_PROFILE_LOOKUP_FAILED");
        queryClient.setQueryData(["patients", "patient"], { items: [patient], total: 1 });
        appointment.patient_id = patient.id;
      }
      return api.createAppointment(appointment);
    },
    onSuccess: () => { setNotice("Pedido de consulta enviado. O médico deverá confirmar a marcação."); queryClient.invalidateQueries({ queryKey: ["appointments"] }); queryClient.invalidateQueries({ queryKey: ["patients"] }); setView("appointments"); },
    onError: (error) => setNotice(friendlyError(error, "appointment")),
  });
  const createRecord = useMutation({ mutationFn: api.createMedicalRecord, onSuccess: () => { setNotice("Prontuário criado."); queryClient.invalidateQueries({ queryKey: ["medical-records"] }); }, onError: (error) => setNotice(friendlyError(error, "record")) });
  const topUp = useMutation({ mutationFn: api.topUpWallet, onSuccess: () => { setNotice("Pedido de carregamento enviado."); queryClient.invalidateQueries({ queryKey: ["wallet"] }); queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] }); }, onError: (error) => setNotice(friendlyError(error, "wallet")) });
  const updatePreference = useMutation({ mutationFn: api.updatePreference, onSuccess: () => { setNotice("Preferência atualizada."); queryClient.invalidateQueries({ queryKey: ["preferences"] }); }, onError: (error) => setNotice(friendlyError(error, "preferences")) });

  const todayAppointments = useMemo(() => {
    const today = new Date().toDateString();
    return appointments.filter((item) => new Date(item.scheduled_start).toDateString() === today);
  }, [appointments]);

  async function logout() {
    try { if (authenticated) await api.logout(); } catch { /* logout local mesmo com token expirado */ }
    finishSession("Sessão terminada.");
  }

  function refreshAll() { queryClient.invalidateQueries(); health.refetch(); }
  function go(viewName: View) { setView(viewName); setMenuOpen(false); }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark">W</span><div><strong>Wutomi</strong><small>{roleLabel(role)}</small></div></div>
        <nav className="nav-list" aria-label="Navegacao principal">
          {visibleModules.map((item) => { const Icon = item.icon; return <button className={`nav-item ${view === item.view ? "active" : ""}`} key={item.view} onClick={() => go(item.view)}><Icon size={18} /><span>{item.label}</span></button>; })}
        </nav>
        <div className="api-card"><span>Estado</span><strong>{health.data ? "Serviço disponível" : health.isError ? "Serviço indisponível" : "A verificar"}</strong><small>{authenticated ? "Sessão autenticada" : demoMode ? "Modo demonstração" : "Aguardando sessão"}</small></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="title-block"><span>Wutomi</span><h1>{viewTitles[view]}</h1></div>
          <div className="topbar-actions">
            <select value={role} disabled={authenticated} onChange={(event) => setSelectedRole(event.target.value as Role)} aria-label="Tipo de utilizador">
              <option value="patient">Paciente</option><option value="doctor">Médico</option><option value="hospital">Hospital</option><option value="admin">Admin</option>
            </select>
            <button className="icon-button" onClick={refreshAll} title="Atualizar dados"><RefreshCw size={18} /></button>
          </div>
        </header>

        {!authenticated && <SessionPanel mode={authMode} setMode={setAuthMode} providers={oauthProviders.data || []} onLogin={login.mutate} onRegister={register.mutate} onForgot={forgot.mutate} onOauth={async (provider) => { const response = await api.oauthAuthorize(provider); window.location.href = response.authorization_url; }} loading={login.isPending || register.isPending || forgot.isPending} publicRegistrationEnabled={PUBLIC_REGISTRATION_ENABLED} />}
        {authenticated && <AuthenticatedBar user={user.data} role={role} onSendVerification={() => sendVerification.mutate()} verificationLoading={sendVerification.isPending} onLogout={logout} />}
        {notice && <section className="notice"><Bell size={17} /><span>{notice}</span><button onClick={() => setNotice("")}>Fechar</button></section>}
        {currentPrivateErrors.length > 0 && authenticated && <ApiErrorBanner errors={currentPrivateErrors} />}

        {view === "overview" && <Overview role={role} authenticated={authenticated} demoMode={demoMode} modules={visibleModules} appointments={appointments} todayAppointments={todayAppointments} pending={appointments.filter((item) => item.status === "pending").length} active={appointments.filter((item) => item.status === "in_progress").length} completed={appointments.filter((item) => item.status === "completed").length} patients={patients.length} doctors={doctors.length} hospitals={hospitals.length} revenue={adminSummary.total_revenue} />}
        {view === "auth" && <AuthModule providers={oauthProviders.data || []} />}
        {view === "appointments" && <RequireAuth authenticated={authenticated}><AppointmentsView role={role} appointments={appointments} onAction={(id, action) => appointmentAction.mutate({ id, action })} /></RequireAuth>}
        {view === "booking" && <RequireAuth authenticated={authenticated}><BookingView hospitals={hospitals} patients={patients} personalDataComplete={hasPatientPersonalData(user.data, patients[0])} disabled={!authenticated} demoMode={demoMode} onCompleteProfile={() => setView("profile")} onSubmit={(body) => createAppointment.mutate(body)} /></RequireAuth>}
        {view === "patients" && <RequireAuth authenticated={authenticated}><PeopleView title="Pacientes" search={search} onSearch={setSearch} items={patients.filter((item) => personName(item).toLowerCase().includes(search.toLowerCase()))} render={(patient) => <PatientCard patient={patient} />} /></RequireAuth>}
        {view === "doctors" && <RequireAuth authenticated={authenticated}><PeopleView title="Médicos" search={search} onSearch={setSearch} items={doctorsWithDetails.filter((item) => `${doctorName(item)} ${item.specialty || ""}`.toLowerCase().includes(search.toLowerCase()))} render={(doctor) => <DoctorCard doctor={doctor} />} /></RequireAuth>}
        {view === "hospitals" && <RequireAuth authenticated={authenticated}><HospitalsView hospitals={hospitals} search={search} onSearch={setSearch} /></RequireAuth>}
        {view === "specialties" && <RequireAuth authenticated={authenticated}><SpecialtiesView specialties={specialties} search={search} onSearch={setSearch} /></RequireAuth>}
        {view === "records" && <RequireAuth authenticated={authenticated}><RecordsView role={role} user={user.data} records={records} patients={patients} doctors={doctors} appointments={appointments} disabled={!authenticated} onCreate={(payload) => createRecord.mutate(payload)} /></RequireAuth>}
        {view === "notifications" && <RequireAuth authenticated={authenticated}><NotificationsView notifications={notifications} preferences={preferences} onPreference={(payload) => updatePreference.mutate(payload)} /></RequireAuth>}
        {view === "wallet" && <RequireAuth authenticated={authenticated}><WalletView wallet={wallet} transactions={transactions} disabled={!authenticated} onTopUp={(payload) => topUp.mutate(payload)} /></RequireAuth>}
        {view === "profile" && <RequireAuth authenticated={authenticated}><ProfileView user={user.data} patient={patients[0]} role={role} disabled={!authenticated} onSubmit={(payload) => updateProfile.mutate(payload)} /></RequireAuth>}
        {view === "settings" && <SettingsView demoMode={demoMode} setDemoMode={setDemoMode} preferences={preferences} onPreference={(payload) => updatePreference.mutate(payload)} />}
        {view === "admin" && <RequireRole role={role} required="admin"><AdminView summary={adminSummary} /></RequireRole>}
      </main>
    </div>
  );
}

const emptyAdminSummary = { total_users: 0, active_users: 0, admin_users: 0, total_doctors: 0, active_doctors: 0, total_patients: 0, total_appointments: 0, pending_appointments: 0, completed_appointments: 0, total_payments: 0, completed_payments: 0, total_revenue: 0 };
function dataOrDemo<T>(payload: { items?: T[]; results?: T[] } | T[] | undefined, demo: T[], demoMode: boolean): T[] { if (payload) return pageItems(payload); return demoMode ? demo : []; }
function roleLabel(role: string) { return role === "doctor" ? "Médico" : role === "hospital" ? "Hospital" : role === "admin" ? "Admin" : "Paciente"; }
function cleanPayload<T extends Record<string, string | boolean | undefined>>(payload: T) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined)) as T;
}
function dateToInputDate(value?: string | null) { return value ? value.split("T")[0] : ""; }
function dateToApiDateTime(value?: string) { return value ? `${value}T00:00:00` : ""; }
function currentViewErrors(view: View, errors: Partial<Record<View, unknown>>) {
  const error = errors[view];
  if (!error) return [];
  return Array.isArray(error) ? error : [error];
}
function padTime(value: number) { return String(value).padStart(2, "0"); }
function dateInputValue(date: Date) { return `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}`; }
function apiWeekday(date: Date) { const day = date.getDay(); return day === 0 ? 7 : day; }
function timeToMinutes(value?: string | null) {
  const [hours = "0", minutes = "0"] = String(value || "00:00").split(":");
  return Number(hours) * 60 + Number(minutes);
}
function minutesToTime(value: number) { return `${padTime(Math.floor(value / 60))}:${padTime(value % 60)}`; }
function addMinutesToDateTime(date: string, time: string, minutes: number) {
  const value = new Date(`${date}T${time}:00`);
  value.setMinutes(value.getMinutes() + minutes);
  return `${dateInputValue(value)}T${padTime(value.getHours())}:${padTime(value.getMinutes())}:00`;
}
function activeDoctorAvailability(doctor?: Doctor) {
  return (doctor?.availability || []).filter((slot) => slot.is_active);
}
function bookingDateOptions(doctor?: Doctor) {
  const availability = activeDoctorAvailability(doctor);
  if (!availability.length) return [];
  const today = new Date();
  return Array.from({ length: 21 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const hasAvailability = availability.some((slot) => slot.weekday === apiWeekday(date));
    return hasAvailability ? {
      value: dateInputValue(date),
      day: new Intl.DateTimeFormat("pt-MZ", { weekday: "short" }).format(date),
      date: new Intl.DateTimeFormat("pt-MZ", { day: "2-digit", month: "short" }).format(date),
    } : null;
  }).filter(Boolean) as { value: string; day: string; date: string }[];
}
function bookingTimeOptions(doctor: Doctor | undefined, date: string) {
  if (!date) return [];
  const availability = activeDoctorAvailability(doctor).filter((slot) => slot.weekday === apiWeekday(new Date(`${date}T00:00:00`)));
  const now = new Date();
  return availability.flatMap((slot) => {
    const start = timeToMinutes(slot.start_time);
    const end = timeToMinutes(slot.end_time);
    const options: { value: string; end: string; label: string; location?: string | null }[] = [];
    for (let minute = start; minute + BOOKING_SLOT_MINUTES <= end; minute += BOOKING_SLOT_MINUTES) {
      const value = minutesToTime(minute);
      const slotStart = new Date(`${date}T${value}:00`);
      if (slotStart.getTime() <= now.getTime()) continue;
      const slotEnd = addMinutesToDateTime(date, value, BOOKING_SLOT_MINUTES).split("T")[1].slice(0, 5);
      options.push({ value, end: slotEnd, label: `${value} - ${slotEnd}`, location: slot.location });
    }
    return options;
  });
}
async function savePatientSubresources(patientId: string, payload: ProfilePayload) {
  if (payload.action === "add_allergy" && payload.allergy?.allergen) await api.addPatientAllergy(patientId, cleanPayload(payload.allergy));
  if (payload.action === "add_condition" && payload.condition?.condition_name) await api.addPatientCondition(patientId, cleanPayload({ ...payload.condition, diagnosed_date: dateToApiDateTime(payload.condition.diagnosed_date) }));
  if (payload.action === "add_medication" && payload.medication?.medication_name) await api.addPatientMedication(patientId, cleanPayload({ ...payload.medication, start_date: dateToApiDateTime(String(payload.medication.start_date || "")), end_date: dateToApiDateTime(String(payload.medication.end_date || "")) }));
  if (payload.action === "add_insurance" && payload.insurance?.provider_name && payload.insurance.policy_number) await api.addPatientInsurance(patientId, cleanPayload({ ...payload.insurance, valid_from: dateToApiDateTime(String(payload.insurance.valid_from || "")), valid_until: dateToApiDateTime(String(payload.insurance.valid_until || "")) }));
  if (payload.action === "add_contact" && payload.contact?.contact_name && payload.contact.phone) await api.addPatientContact(patientId, cleanPayload(payload.contact));
}

function AuthenticatedBar({ user, role, verificationLoading, onSendVerification, onLogout }: { user?: CurrentUser; role: Role; verificationLoading: boolean; onSendVerification: () => void; onLogout: () => void }) {
  return <section className="session-panel compact-session">
    <div>
      <span className="section-kicker">Sessão</span>
      <h2>{user?.full_name || user?.email || "Utilizador autenticado"}</h2>
      <p>{roleLabel(role)} · {user?.is_verified ? "email verificado" : "email por verificar"}</p>
    </div>
    <div className="session-actions">
      {user && !user.is_verified && <button type="button" onClick={onSendVerification} disabled={verificationLoading} className="secondary-button">{verificationLoading ? "A enviar..." : "Enviar verificação"}</button>}
      <button onClick={onLogout} className="secondary-button"><LogOut size={17} /> Sair</button>
    </div>
  </section>;
}
function ApiErrorBanner({ errors }: { errors: Error[] }) { return <section className="notice"><Bell size={17} /><span>{friendlyError(errors[0], "modules")}</span></section>; }
function RequireAuth({ authenticated, children }: { authenticated: boolean; children: React.ReactNode }) { return authenticated ? <>{children}</> : <Panel title="Sessão necessária"><p className="empty-state">Entre para carregar os dados deste módulo.</p></Panel>; }
function RequireRole({ role, required, children }: { role: Role; required: Role; children: React.ReactNode }) { return role === required ? <>{children}</> : <Panel title="Acesso restrito"><p className="empty-state">Este módulo exige perfil {roleLabel(required)}.</p></Panel>; }

function SessionPanel(props: { mode: AuthMode; setMode: (mode: AuthMode) => void; providers: { provider: string; display_name: string; configured: boolean }[]; onLogin: (payload: { email: string; password: string }) => void; onRegister: (payload: { email: string; full_name: string; password: string; role: string }) => void; onForgot: (email: string) => void; onOauth: (provider: string) => void; loading: boolean; publicRegistrationEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  return <section className="session-panel auth-expanded">
    <div className="auth-copy">
      <span className="section-kicker">Acesso</span>
      <h2>{props.publicRegistrationEnabled ? "Entrar ou criar conta" : "Entrar na conta"}</h2>
      <p>{props.publicRegistrationEnabled ? "O cadastro público está disponível apenas para pacientes. Médicos e hospitais devem contactar a administração da app." : "O cadastro público está desativado. Novas contas devem ser criadas por convite ou pela equipa administrativa."}</p>
    </div>
    <div className="auth-box">
      <div className="segmented">
        <button className={props.mode === "login" ? "active" : ""} onClick={() => props.setMode("login")}>Login</button>
        {props.publicRegistrationEnabled && <button className={props.mode === "register" ? "active" : ""} onClick={() => props.setMode("register")}>Cadastro</button>}
        <button className={props.mode === "oauth" ? "active" : ""} onClick={() => props.setMode("oauth")}>OAuth</button>
        <button className={props.mode === "forgot" ? "active" : ""} onClick={() => props.setMode("forgot")}>Senha</button>
      </div>
      {props.mode === "login" && <form className="login-form" onSubmit={(event) => { event.preventDefault(); props.onLogin({ email, password }); }}>
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" />
        <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Palavra-passe" />
        <button disabled={props.loading}><KeyRound size={16} /> Entrar</button>
      </form>}
      {props.mode === "register" && props.publicRegistrationEnabled && <form className="login-form register-form" onSubmit={(event) => { event.preventDefault(); props.onRegister({ email, full_name: fullName, password, role: "patient" }); }}>
        <input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nome completo" />
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" />
        <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" />
        <p className="empty-state">Conta de paciente. Para médico ou hospital, contacte a administração da app.</p>
        <button disabled={props.loading}><UserPlus size={16} /> Criar conta de paciente</button>
      </form>}
      {props.mode === "oauth" && <div className="oauth-grid">{props.providers.length ? props.providers.map((provider) => <button key={provider.provider} disabled={!provider.configured} onClick={() => props.onOauth(provider.provider)}>{provider.display_name}{!provider.configured ? " indisponível" : ""}</button>) : <p className="empty-state">Nenhum provedor social disponível neste momento.</p>}</div>}
      {props.mode === "forgot" && <form className="login-form" onSubmit={(event) => { event.preventDefault(); props.onForgot(email); }}>
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" />
        <button disabled={props.loading}>Enviar recuperação</button>
      </form>}
    </div>
  </section>;
}

function Overview({ role, authenticated, demoMode, modules, appointments, todayAppointments, pending, active, completed, patients, doctors, hospitals, revenue }: { role: Role; authenticated: boolean; demoMode: boolean; modules: ModuleSpec[]; appointments: Appointment[]; todayAppointments: Appointment[]; pending: number; active: number; completed: number; patients: number; doctors: number; hospitals: number; revenue: string | number }) {
  const showOperationalMetrics = role !== "patient";
  const showRevenue = role === "hospital" || role === "admin";
  const nextAppointment = appointments
    .filter((item) => new Date(item.scheduled_start).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())[0];

  return <>
    <section className="metric-grid">
      <Metric label="Consultas hoje" value={todayAppointments.length} hint={authenticated ? "Atualizadas" : "Entre para ver"} icon={CalendarDays} />
      <Metric label="Pendentes" value={pending} hint="Aguardam confirmação" icon={BadgeCheck} />
      {showOperationalMetrics && <Metric label="Cadastros" value={patients + doctors + hospitals} hint={`${patients} pacientes · ${doctors} médicos · ${hospitals} hospitais`} icon={HeartPulse} />}
      {showRevenue && <Metric label="Receita" value={formatMoney(revenue)} hint="Pagamentos concluídos" icon={CreditCard} />}
    </section>
    {!authenticated && !demoMode && <Panel title="Dados reais protegidos"><p className="empty-state">Entre com uma conta real ou ative o modo demonstração em Configurações para explorar os módulos.</p></Panel>}
    <section className="content-grid">
      <Panel title={`Módulos para ${roleLabel(role)}`}>
        <div className="module-grid">{modules.map((module) => { const Icon = module.icon; return <article className="module-card" key={module.view}><Icon size={18} /><strong>{module.label}</strong><span>{module.summary}</span><small>{module.access.includes("patient") ? "Disponível no fluxo do paciente" : "Área operacional"}</small></article>; })}</div>
      </Panel>
      {role === "patient" ? <PatientOverviewPanel nextAppointment={nextAppointment} pending={pending} completed={completed} /> : <OperationalQueuePanel pending={pending} active={active} completed={completed} />}
    </section>
    {appointments.length > 0 && <Panel title="Agenda imediata"><Timeline items={todayAppointments.length ? todayAppointments : appointments.slice(0, 4)} render={(item) => <><strong>{formatDate(item.scheduled_start)} · {item.patient_full_name || item.patient_id}</strong><span>{item.doctor_full_name || item.doctor_id} · {item.doctor_specialty || "Especialidade"}</span><StatusPill value={item.status} /></>} /></Panel>}
  </>;
}

function PatientOverviewPanel({ nextAppointment, pending, completed }: { nextAppointment?: Appointment; pending: number; completed: number }) {
  return <Panel title="Acompanhamento">
    <div className="patient-status">
      <div className="patient-status-lead">
        <CalendarDays size={20} />
        <div>
          <strong>{nextAppointment ? formatDate(nextAppointment.scheduled_start) : "Sem consulta marcada"}</strong>
          <span>{nextAppointment ? nextAppointment.doctor_full_name || nextAppointment.doctor_specialty || "Consulta agendada" : "Marque uma consulta quando precisar de atendimento."}</span>
        </div>
      </div>
      <div className="patient-status-row"><span>Por confirmar</span><strong>{pending}</strong></div>
      <div className="patient-status-row"><span>Concluídas</span><strong>{completed}</strong></div>
    </div>
  </Panel>;
}

function OperationalQueuePanel({ pending, active, completed }: { pending: number; active: number; completed: number }) {
  return <Panel title="Fila clínica"><div className="queue-grid"><QueueItem value={pending} label="Por confirmar" /><QueueItem value={active} label="Em atendimento" /><QueueItem value={completed} label="Concluídas" /></div></Panel>;
}

function AuthModule({ providers }: { providers: { provider: string; display_name: string; configured: boolean }[] }) { return <Panel title="Formas de acesso"><div className="module-grid"><article className="module-card"><KeyRound size={18} /><strong>Email e palavra-passe</strong><span>Entrar com a conta Wutomi e manter a sessão segura.</span></article>{providers.map((provider) => <article className="module-card" key={provider.provider}><ShieldCheck size={18} /><strong>{provider.display_name}</strong><span>{provider.configured ? "Disponível" : "Indisponível"}</span></article>)}</div></Panel>; }
function AppointmentsView({ role, appointments, onAction }: { role: Role; appointments: Appointment[]; onAction: (id: string, action: "confirm" | "check-in" | "complete") => void }) {
  const [status, setStatus] = useState("");
  const filtered = appointments.filter((item) => !status || item.status === status);
  const showActions = role === "doctor" || role === "hospital" || role === "admin";
  const canConfirm = role === "doctor" || role === "admin";

  return <Panel title="Consultas" action={<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos estados</option><option value="pending">Pendente</option><option value="confirmed">Confirmada</option><option value="in_progress">Em consulta</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option></select>}>
    <div className="table-wrap">
      <table>
        <thead><tr><th>Hora</th><th>Paciente</th><th>Médico</th><th>Especialidade</th><th>Estado</th>{showActions && <th>Ações</th>}</tr></thead>
        <tbody>{filtered.map((item) => <tr key={item.id}><td>{formatDate(item.scheduled_start)}</td><td>{item.patient_full_name || item.patient_id}</td><td>{item.doctor_full_name || item.doctor_id}</td><td>{item.doctor_specialty || "-"}</td><td><StatusPill value={item.status} /></td>{showActions && <td><div className="row-actions">{canConfirm && <button onClick={() => onAction(item.id, "confirm")}>Confirmar</button>}<button onClick={() => onAction(item.id, "check-in")}>Check-in</button><button onClick={() => onAction(item.id, "complete")}>Concluir</button></div></td>}</tr>)}</tbody>
      </table>
      {!filtered.length && <p className="empty-state">Sem consultas para esta sessão.</p>}
    </div>
  </Panel>;
}
function BookingView({ hospitals, patients, personalDataComplete, disabled, demoMode, onCompleteProfile, onSubmit }: { hospitals: HospitalType[]; patients: Patient[]; personalDataComplete: boolean; disabled: boolean; demoMode: boolean; onCompleteProfile: () => void; onSubmit: (body: unknown) => void }) {
  const [hospitalId, setHospitalId] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const patient = patients[0];

  useEffect(() => {
    if (!hospitalId && hospitals.length) setHospitalId(hospitals[0].id);
  }, [hospitalId, hospitals]);

  const hospitalSpecialties = useQuery({
    queryKey: ["hospital-specialties", hospitalId],
    queryFn: () => api.hospitalSpecialties(hospitalId),
    enabled: Boolean(getAccessToken() && hospitalId && !demoMode),
    retry: 1,
  });
  const specialties = demoMode ? demoSpecialties : pageItems(hospitalSpecialties.data || []);

  useEffect(() => {
    setSpecialtyId("");
    setDoctorId("");
  }, [hospitalId]);

  useEffect(() => {
    if (!specialtyId && specialties.length) setSpecialtyId(specialties[0].id);
  }, [specialtyId, specialties]);

  const hospitalDoctors = useQuery({
    queryKey: ["hospital-doctors", hospitalId, specialtyId],
    queryFn: () => api.hospitalDoctorsBySpecialty(hospitalId, specialtyId),
    enabled: Boolean(getAccessToken() && hospitalId && specialtyId && !demoMode),
    retry: 1,
  });
  const doctors = demoMode ? demoDoctors.filter((doctor) => !specialtyId || doctor.specialty_id === specialtyId || specialties.find((item) => item.id === specialtyId)?.name === doctor.specialty) : pageItems(hospitalDoctors.data || []);

  useEffect(() => {
    setDoctorId("");
    setSelectedDate("");
    setSelectedTime("");
  }, [specialtyId]);

  useEffect(() => {
    if (!doctorId && doctors.length) setDoctorId(doctors[0].id);
  }, [doctorId, doctors]);

  useEffect(() => {
    setSelectedDate("");
    setSelectedTime("");
  }, [doctorId]);

  const selectedHospital = hospitals.find((item) => item.id === hospitalId);
  const selectedSpecialty = specialties.find((item) => item.id === specialtyId);
  const selectedDoctor = doctors.find((item) => item.id === doctorId);
  const doctorDetail = useQuery({
    queryKey: ["booking-doctor-detail", doctorId],
    queryFn: () => api.doctor(doctorId),
    enabled: Boolean(getAccessToken() && doctorId && !demoMode),
    retry: 1,
  });
  const doctorForSchedule = doctorDetail.data || selectedDoctor;
  const dateOptions = useMemo(() => bookingDateOptions(doctorForSchedule), [doctorForSchedule]);
  const timeOptions = useMemo(() => bookingTimeOptions(doctorForSchedule, selectedDate), [doctorForSchedule, selectedDate]);
  const selectedSlot = timeOptions.find((slot) => slot.value === selectedTime);
  const canBook = Boolean(!disabled && personalDataComplete && hospitalId && specialtyId && doctorId && selectedDate && selectedSlot);

  return <section className="booking-flow">
    <Panel title="Marcar consulta" action={<span className="badge">Hospital → Especialidade → Médico → Agenda</span>}>
      <div className="flow-steps" aria-label="Fluxo de marcação">
        <FlowStep number={1} label="Hospital" active={Boolean(hospitalId)} />
        <FlowStep number={2} label="Especialidade" active={Boolean(specialtyId)} />
        <FlowStep number={3} label="Médico" active={Boolean(doctorId)} />
        <FlowStep number={4} label="Agenda" active={Boolean(doctorId)} />
      </div>
      <div className="booking-layout">
        <div className="booking-column">
          <label>Hospital
            <select value={hospitalId} onChange={(event) => setHospitalId(event.target.value)} disabled={!hospitals.length}>
              {hospitals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {selectedHospital && <p className="helper-text">{[selectedHospital.city, selectedHospital.province, selectedHospital.country].filter(Boolean).join(" · ") || "Localização por confirmar"}</p>}

          <label>Especialidade
            <select value={specialtyId} onChange={(event) => setSpecialtyId(event.target.value)} disabled={!hospitalId || hospitalSpecialties.isLoading || !specialties.length}>
              {specialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {selectedSpecialty && <p className="helper-text">{selectedSpecialty.description || "Escolha esta área para ver os médicos disponíveis."}</p>}

          <label>Médico
            <select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} disabled={!specialtyId || hospitalDoctors.isLoading || !doctors.length}>
              {doctors.map((item) => <option key={item.id} value={item.id}>{doctorName(item)}</option>)}
            </select>
          </label>
          {selectedDoctor && <p className="helper-text">{selectedDoctor.specialty || selectedSpecialty?.name || "Especialidade seleccionada"}</p>}
        </div>

        <form className="booking-column schedule-card" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onSubmit({
            patient_id: patient?.id,
            hospital_id: hospitalId,
            doctor_id: doctorId,
            scheduled_start: data.get("scheduledStart"),
            scheduled_end: data.get("scheduledEnd"),
            timezone: "Africa/Maputo",
            type: "in_person",
            location: selectedHospital?.name || data.get("location"),
            reason: data.get("reason"),
          });
        }}>
          <div>
            <span className="section-kicker">Agenda</span>
            <h3>{selectedDoctor ? doctorName(selectedDoctor) : "Seleccione um médico"}</h3>
            <p className="helper-text">Escolha um dos horários disponíveis. A consulta ficará pendente até confirmação do médico.</p>
          </div>
          {doctorForSchedule?.availability_summary && <p className="helper-text">{doctorForSchedule.availability_summary}</p>}
          <input type="hidden" name="scheduledStart" value={selectedDate && selectedTime ? `${selectedDate}T${selectedTime}:00` : ""} />
          <input type="hidden" name="scheduledEnd" value={selectedDate && selectedSlot ? addMinutesToDateTime(selectedDate, selectedSlot.value, BOOKING_SLOT_MINUTES) : ""} />
          <div className="date-picker-panel">
            <span className="field-label">Data</span>
            <div className="date-choice-grid" aria-label="Datas disponíveis">
              {dateOptions.map((option) => <button type="button" key={option.value} className={`date-choice ${selectedDate === option.value ? "active" : ""}`} onClick={() => { setSelectedDate(option.value); setSelectedTime(""); }}>
                <span>{option.day}</span>
                <strong>{option.date}</strong>
              </button>)}
            </div>
            {!dateOptions.length && <p className="empty-state">Este médico ainda não tem agenda ativa para marcação online.</p>}
          </div>
          <div className="time-picker-panel">
            <span className="field-label">Hora</span>
            <div className="time-choice-grid" aria-label="Horários disponíveis">
              {timeOptions.map((slot) => <button type="button" key={`${slot.value}-${slot.location || ""}`} className={`time-choice ${selectedTime === slot.value ? "active" : ""}`} onClick={() => setSelectedTime(slot.value)}>
                <strong>{slot.label}</strong>
                {slot.location && <small>{slot.location}</small>}
              </button>)}
            </div>
            {selectedDate && !timeOptions.length && <p className="empty-state">Não há horários livres nesta data. Escolha outra data disponível.</p>}
          </div>
          <label>Motivo<textarea name="reason" rows={3} placeholder="Descreva brevemente o motivo da consulta" /></label>
          {!personalDataComplete && <p className="empty-state">Antes de marcar consulta, complete os dados pessoais do seu perfil.</p>}
          {!personalDataComplete && <button type="button" className="secondary-button" onClick={onCompleteProfile}>Completar dados pessoais</button>}
          <button disabled={!canBook}>{canBook ? `Solicitar ${selectedTime}` : "Seleccione data e hora"}</button>
        </form>
      </div>
    </Panel>
  </section>;
}

function FlowStep({ number, label, active }: { number: number; label: string; active: boolean }) {
  return <div className={`flow-step ${active ? "active" : ""}`}><span>{number}</span><strong>{label}</strong></div>;
}

function ProfileView({ user, patient, role, disabled, onSubmit }: { user?: CurrentUser; patient?: Patient; role: Role; disabled: boolean; onSubmit: (payload: ProfilePayload) => void }) {
  const patientUser = patient?.user;
  const isPatient = role === "patient";
  const savedPhotoUrl = user?.photo_url || patientUser?.photo_url || patient?.photo_url || "";
  const [photoPreview, setPhotoPreview] = useState("");
  const avatarName = user?.full_name || patientUser?.full_name || patient?.full_name || user?.email || roleLabel(role);
  const avatarInitials = avatarName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "W";

  useEffect(() => {
    return () => {
      if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  return <Panel title="Dados pessoais">
    <form className="form-grid profile-form" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const value = (name: string) => String(data.get(name) || "").trim();
      const submitter = event.nativeEvent.submitter as HTMLButtonElement | null;
      const action = (submitter?.value || "save_profile") as ProfilePayload["action"];
      const identityPayload = cleanPayload({
        full_name: value("full_name"),
        phone: value("phone"),
        gender: value("gender"),
        date_of_birth: value("date_of_birth"),
        document_type: value("document_type"),
        document_number: value("document_number"),
        address: value("address"),
      });
      onSubmit({
        action,
        user: cleanPayload({
          ...identityPayload,
          email: value("email"),
          photo_url: value("photo_url"),
          locale: value("locale"),
          timezone: value("timezone"),
        }),
        patient: isPatient ? cleanPayload({
          ...identityPayload,
          blood_type: value("blood_type"),
          allergies_summary: value("allergies_summary"),
          chronic_conditions_summary: value("chronic_conditions_summary"),
          insurance_provider: value("insurance_provider"),
          insurance_number: value("insurance_number"),
          emergency_contact_name: value("emergency_contact_name"),
          emergency_contact_phone: value("emergency_contact_phone"),
          consent_telemedicine: data.get("consent_telemedicine") === "on",
          consent_data_processing: data.get("consent_data_processing") === "on",
        }) : undefined,
        allergy: cleanPayload({ allergen: value("allergen"), severity: value("allergy_severity") || "unknown", reaction_description: value("reaction_description"), notes: value("allergy_notes") }),
        condition: cleanPayload({ condition_name: value("condition_name"), icd10_code: value("icd10_code"), diagnosed_date: value("diagnosed_date"), status: value("condition_status") || "active", notes: value("condition_notes") }),
        medication: cleanPayload({ medication_name: value("medication_name"), dosage: value("dosage"), frequency: value("frequency"), prescribed_by: value("prescribed_by"), start_date: value("medication_start_date"), end_date: value("medication_end_date"), is_active: data.get("medication_is_active") === "on", notes: value("medication_notes") }),
        insurance: cleanPayload({ provider_name: value("provider_name"), policy_number: value("policy_number"), plan_type: value("plan_type"), coverage_details: value("coverage_details"), valid_from: value("valid_from"), valid_until: value("valid_until"), is_primary: data.get("insurance_is_primary") === "on" }),
        contact: cleanPayload({ contact_name: value("contact_name"), relation_type: value("relation_type"), phone: value("contact_phone"), email: value("contact_email"), is_primary: data.get("contact_is_primary") === "on" }),
      });
    }}>
      <div className="profile-avatar-card wide">
        <div className="profile-avatar" aria-label={`Avatar de ${avatarName}`}>
          {photoPreview || savedPhotoUrl ? <img src={photoPreview || savedPhotoUrl} alt="" /> : <span>{avatarInitials}</span>}
        </div>
        <div className="profile-avatar-fields">
          <strong>{avatarName}</strong>
          <span>{roleLabel(role)}</span>
          <label>Foto do perfil<input name="profile_photo_file" type="file" accept="image/*" onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            setPhotoPreview((current) => {
              if (current.startsWith("blob:")) URL.revokeObjectURL(current);
              return file ? URL.createObjectURL(file) : "";
            });
          }} /></label>
          <label>URL da foto<input name="photo_url" defaultValue={savedPhotoUrl} placeholder="https://..." /></label>
        </div>
      </div>
      <div className="form-section wide"><h3>Identificação</h3></div>
      <label>Nome<input required name="full_name" defaultValue={user?.full_name || patientUser?.full_name || ""} /></label>
      <label>Email<input required name="email" type="email" defaultValue={user?.email || patientUser?.email || ""} /></label>
      <label>Telefone<input required name="phone" defaultValue={user?.phone || patientUser?.phone || patient?.phone || ""} /></label>
      <label>Género<input required name="gender" defaultValue={user?.gender || patientUser?.gender || ""} /></label>
      <label>Data de nascimento<input required name="date_of_birth" type="date" defaultValue={dateToInputDate(user?.date_of_birth || patientUser?.date_of_birth || patient?.date_of_birth)} /></label>
      <label>Tipo de documento<input required name="document_type" defaultValue={user?.document_type || patientUser?.document_type || "BI"} /></label>
      <label>Número do documento<input required name="document_number" defaultValue={user?.document_number || patientUser?.document_number || ""} /></label>
      <label className="wide">Endereço<input required name="address" defaultValue={user?.address || patientUser?.address || ""} /></label>
      <label>Locale<input required name="locale" defaultValue={user?.locale || patientUser?.locale || "pt-MZ"} /></label>
      <label>Timezone<input required name="timezone" defaultValue={user?.timezone || patientUser?.timezone || "Africa/Maputo"} /></label>
      <label>Tipo<input disabled value={roleLabel(role)} /></label>

      {isPatient && <>
        <div className="form-section wide"><h3>Documentos</h3><p>Opcional. Pode levar estes documentos consigo no dia da consulta para verificação pela entidade hospitalar.</p></div>
        <label>Documento de identificação<input name="identity_document_file" type="file" accept=".pdf,image/*" /></label>
        <label>Ficha de seguro ou plano de saúde<input name="insurance_document_file" type="file" accept=".pdf,image/*" /></label>

        <div className="form-section wide">
          <h3>Dados clínicos</h3>
          <p>Tipo sanguíneo, alergias, condições e medicação serão registados pelo médico na ficha do paciente após a consulta.</p>
        </div>

        <div className="form-section wide"><h3>Seguro ou plano de saúde</h3><p>Opcional. Pode apresentar estes dados no local da consulta, se preferir.</p></div>
        <label>Seguradora / plano<input name="insurance_provider" defaultValue={patient?.insurance_provider || ""} placeholder="Ex.: SAMS" /></label>
        <label>Número da apólice / cartão<input name="insurance_number" defaultValue={patient?.insurance_number || ""} /></label>
        <label>Adicionar provedor<input name="provider_name" placeholder="Nome da seguradora" /></label>
        <label>Número da apólice<input name="policy_number" /></label>
        <label>Tipo de plano<input name="plan_type" placeholder="Familiar, individual, empresarial" /></label>
        <label>Válido desde<input name="valid_from" type="date" /></label>
        <label>Válido até<input name="valid_until" type="date" /></label>
        <label className="wide">Cobertura<textarea name="coverage_details" rows={2} placeholder="Cobertura ambulatorial, internamento, medicamentos..." /></label>
        <label className="toggle-row wide"><span>Seguro principal</span><input name="insurance_is_primary" type="checkbox" /></label>
        <div className="form-action-row wide"><button className="profile-add-button" name="profile_action" value="add_insurance" disabled={disabled}>Adicionar seguro / plano</button></div>

        <div className="form-section wide"><h3>Contacto de emergência</h3><p>Opcional. Pode preencher agora ou partilhar no atendimento.</p></div>
        <label>Nome<input name="emergency_contact_name" defaultValue={patient?.emergency_contact_name || ""} /></label>
        <label>Telefone<input name="emergency_contact_phone" defaultValue={patient?.emergency_contact_phone || ""} /></label>
        <label>Adicionar contacto<input name="contact_name" /></label>
        <label>Relação<input name="relation_type" placeholder="Ex.: Esposa, irmão" /></label>
        <label>Telefone do contacto<input name="contact_phone" /></label>
        <label>Email do contacto<input name="contact_email" type="email" /></label>
        <label className="toggle-row wide"><span>Contacto principal</span><input name="contact_is_primary" type="checkbox" /></label>
        <div className="form-action-row wide"><button className="profile-add-button" name="profile_action" value="add_contact" disabled={disabled}>Adicionar contacto</button></div>

        <div className="form-section wide"><h3>Consentimentos</h3></div>
        <label className="toggle-row"><span>Telemedicina</span><input name="consent_telemedicine" type="checkbox" defaultChecked={Boolean(patient?.consent_telemedicine)} /></label>
        <label className="toggle-row"><span>Tratamento de dados</span><input name="consent_data_processing" type="checkbox" defaultChecked={Boolean(patient?.consent_data_processing)} /></label>
      </>}

      <button className="wide" name="profile_action" value="save_profile" disabled={disabled}>{disabled ? "Entre para editar" : "Guardar perfil"}</button>
    </form>
  </Panel>;
}
function RecordsView({ role, user, records, patients, doctors, appointments, disabled, onCreate }: { role: Role; user?: CurrentUser; records: MedicalRecord[]; patients: Patient[]; doctors: Doctor[]; appointments: Appointment[]; disabled: boolean; onCreate: (payload: unknown) => void }) {
  const canCreate = role === "doctor";
  const currentDoctor = doctors.find((doctor) => doctor.user_id === user?.id || doctor.user_email === user?.email);

  return <section className={`content-grid records-grid ${canCreate ? "" : "records-grid-single"}`}>
    <Panel title="Prontuários">
      <Timeline items={records} render={(item) => <><strong>{item.patient_full_name || item.patient_id}</strong><span>{item.chief_complaint || "Sem queixa"} · {item.assessment || "Sem avaliação"}</span><span>{formatDate(item.created_at)}</span></>} />
    </Panel>
    {canCreate && <Panel title="Novo registo clínico">
      <form className="stacked-form" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (currentDoctor) data.set("doctor_id", currentDoctor.id);
        onCreate(Object.fromEntries(data.entries()));
      }}>
        <SelectField name="patient_id" label="Paciente" items={patients.map((item) => ({ value: item.id, label: personName(item) }))} />
        {currentDoctor ? <input type="hidden" name="doctor_id" value={currentDoctor.id} /> : <SelectField name="doctor_id" label="Médico" items={doctors.map((item) => ({ value: item.id, label: doctorName(item) }))} />}
        <SelectField name="appointment_id" label="Consulta" items={appointments.map((item) => ({ value: item.id, label: `${formatDate(item.scheduled_start)} · ${item.patient_full_name || item.patient_id}` }))} />
        <textarea name="chief_complaint" rows={2} placeholder="Queixa principal" />
        <textarea name="assessment" rows={2} placeholder="Avaliacao" />
        <textarea name="plan" rows={2} placeholder="Plano" />
        <button disabled={disabled}>{disabled ? "Entre para criar" : "Criar prontuario"}</button>
      </form>
    </Panel>}
  </section>;
}
function NotificationsView({ notifications, preferences, onPreference }: { notifications: { id: string; channel: string; subject?: string | null; body: string; status: string; created_at: string }[]; preferences: { channel: string; enabled: boolean }[]; onPreference: (payload: { channel: string; enabled: boolean }) => void }) { return <section className="content-grid"><Panel title="Notificações"><Timeline items={notifications} render={(item) => <><strong>{item.subject || item.channel}</strong><span>{item.body}</span><StatusPill value={item.status} /></>} /></Panel><Panel title="Preferências"><PreferenceList preferences={preferences} onPreference={onPreference} /></Panel></section>; }
function WalletView({ wallet, transactions, disabled, onTopUp }: { wallet: { balance: string | number; currency: string }; transactions: { id: number; amount: string | number; direction: string; description?: string | null; transaction_type?: string; created_at: string }[]; disabled: boolean; onTopUp: (payload: unknown) => void }) { return <section className="content-grid"><Panel title="Carteira"><div className="wallet-card"><span>Saldo disponível</span><strong>{formatMoney(wallet.balance, wallet.currency)}</strong></div><form className="stacked-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onTopUp({ amount: data.get("amount"), provider: data.get("provider"), phone_number: data.get("phone") }); }}><input required name="amount" type="number" min="1" step="0.01" placeholder="Valor" /><select name="provider"><option value="mpesa">M-Pesa</option><option value="mkesh">mKesh</option><option value="emola">e-Mola</option></select><input required name="phone" placeholder="841234567" /><button disabled={disabled}>{disabled ? "Entre para carregar" : "Carregar carteira"}</button></form></Panel><Panel title="Movimentos"><Timeline items={transactions} render={(item) => <><strong>{item.direction === "credit" ? "+" : "-"} {formatMoney(item.amount)}</strong><span>{item.description || item.transaction_type || "Movimento"} · {formatDate(item.created_at)}</span></>} /></Panel></section>; }
function HospitalsView({ hospitals, search, onSearch }: { hospitals: HospitalType[]; search: string; onSearch: (value: string) => void }) {
  const normalizedSearch = search.toLowerCase();
  const filtered = hospitals.filter((item) => `${item.name} ${item.city || ""} ${item.province || ""} ${item.country || ""}`.toLowerCase().includes(normalizedSearch));
  return <PeopleView title="Hospitais" search={search} onSearch={onSearch} items={filtered} render={(item) => <article className="person-card"><div><h3>{item.name}</h3><p>{[item.city, item.province, item.country].filter(Boolean).join(" · ") || "Localizacao por definir"}</p></div><div className="badge-row"><span className="badge">{item.is_active === false ? "Inativo" : "Ativo"}</span><span className="badge">{item.id}</span></div></article>} />;
}
function SpecialtiesView({ specialties, search, onSearch }: { specialties: Specialty[]; search: string; onSearch: (value: string) => void }) {
  const normalizedSearch = search.toLowerCase();
  const filtered = specialties.filter((item) => `${item.name} ${item.description || ""} ${item.details || ""} ${item.classification || ""} ${item.grouping || ""}`.toLowerCase().includes(normalizedSearch));
  return <PeopleView title="Especialidades" search={search} onSearch={onSearch} items={filtered} render={(item) => <article className="person-card"><div><h3>{item.name}</h3><p>{item.description || item.details || "Descrição em revisão clínica."}</p></div></article>} />;
}
function SettingsView({ demoMode, setDemoMode, preferences, onPreference }: { demoMode: boolean; setDemoMode: (value: boolean) => void; preferences: { channel: string; enabled: boolean }[]; onPreference: (payload: { channel: string; enabled: boolean }) => void }) { return <section className="content-grid"><Panel title="Aplicacao"><div className="settings-list"><div><strong>Ligação</strong><span>Serviço Wutomi</span></div><label className="toggle-row"><span>Modo demonstracao</span><input type="checkbox" checked={demoMode} onChange={(event) => setDemoMode(event.target.checked)} /></label><div><strong>Locale</strong><span>pt-MZ</span></div><div><strong>Timezone</strong><span>Africa/Maputo</span></div></div></Panel><Panel title="Canais"><PreferenceList preferences={preferences} onPreference={onPreference} /></Panel></section>; }
function PreferenceList({ preferences, onPreference }: { preferences: { channel: string; enabled: boolean }[]; onPreference: (payload: { channel: string; enabled: boolean }) => void }) { if (!preferences.length) return <p className="empty-state">Sem preferencias carregadas para esta sessao.</p>; return <div className="settings-list">{preferences.map((item) => <label key={item.channel} className="toggle-row"><span>{item.channel}</span><input type="checkbox" checked={item.enabled} onChange={(event) => onPreference({ channel: item.channel, enabled: event.target.checked })} /></label>)}</div>; }
function AdminView({ summary }: { summary: Record<string, string | number | undefined> }) { const metrics = [["Utilizadores", summary.total_users], ["Médicos ativos", summary.active_doctors], ["Pacientes", summary.total_patients], ["Consultas", summary.total_appointments], ["Pendentes", summary.pending_appointments], ["Receita", formatMoney(summary.total_revenue)]]; return <section className="content-grid"><Panel title="Indicadores admin"><div className="admin-grid">{metrics.map(([label, value]) => <div key={label}><strong>{value || 0}</strong><span>{label}</span></div>)}</div></Panel><Panel title="Governança"><div className="timeline-item"><strong>Auditoria, aprovações e catálogo clínico</strong><span>Área ligada à governação da plataforma e segurança operacional.</span></div></Panel></section>; }
function PeopleView<T>({ title, search, onSearch, items, render }: { title: string; search: string; onSearch: (value: string) => void; items: T[]; render: (item: T) => React.ReactNode }) { return <Panel title={title} action={<div className="search-box"><Search size={17} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Pesquisar" /></div>}><div className="card-grid">{items.map((item, index) => <div key={index}>{render(item)}</div>)}</div>{!items.length && <p className="empty-state">Sem dados para esta sessão.</p>}</Panel>; }
function Metric({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint: string; icon: typeof Activity }) { return <article className="metric"><Icon size={20} /><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>; }
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="panel"><div className="panel-heading"><h2>{title}</h2>{action}</div>{children}</section>; }
function Timeline<T>({ items, render }: { items: T[]; render: (item: T) => React.ReactNode }) { if (!items.length) return <p className="empty-state">Sem dados.</p>; return <div className="timeline">{items.map((item, index) => <article className="timeline-item" key={index}>{render(item)}</article>)}</div>; }
function QueueItem({ value, label }: { value: number; label: string }) { return <div className="queue-item"><strong>{value}</strong><span>{label}</span></div>; }
function StatusPill({ value }: { value?: string | null }) { return <span className={`status-pill status-${value || "unknown"}`}>{statusLabels[value || ""] || value || "-"}</span>; }
function SelectField({ name, label, items }: { name: string; label: string; items: { value: string; label: string }[] }) { return <label>{label}<select required name={name}>{items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>; }
function PatientCard({ patient }: { patient: Patient }) { return <article className="person-card"><div><h3>{personName(patient)}</h3><p>{patient.phone || "Telefone nao informado"}</p></div><div className="badge-row"><span className="badge">Sangue: {patient.blood_type || "desconhecido"}</span><span className="badge">{patient.id}</span></div></article>; }
function DoctorCard({ doctor }: { doctor: Doctor }) {
  return <article className="person-card doctor-card">
    <div>
      <h3>{doctorName(doctor)}</h3>
      <p>{doctorSpecialtiesText(doctor)}</p>
    </div>
    <div className="doctor-meta">
      <span><strong>{doctorExperienceText(doctor)}</strong></span>
      <span><strong>Avaliação:</strong> {doctorRatingText(doctor)}</span>
      <span>{doctor.biography || doctor.experience || doctor.specialty_description || "Atendimento clínico com dados profissionais em atualização."}</span>
      <DoctorAgenda doctor={doctor} />
    </div>
    <div className="badge-row">
      <StatusPill value={doctor.status || "active"} />
      {doctor.in_person_enabled && <span className="badge">Presencial</span>}
      {doctor.telemedicine_enabled && <span className="badge">Telemedicina</span>}
    </div>
  </article>;
}
function personName(patient: Patient) { return patient.user_full_name || patient.full_name || patient.id; }
function doctorName(doctor: Doctor) { return doctor.user_full_name || doctor.user_email || doctor.id; }
function doctorExperienceText(doctor: Doctor) { return doctor.years_of_experience ? `${doctor.years_of_experience} anos de experiência` : "Anos de experiência por confirmar"; }
function doctorRatingText(doctor: Doctor) { return doctor.average_rating ? `${Number(doctor.average_rating).toLocaleString("pt-MZ", { maximumFractionDigits: 1 })}/5` : "Sem avaliação"; }
function doctorSpecialtiesText(doctor: Doctor) {
  const specialties = [doctor.specialty, doctor.subspecialty, ...(doctor.specialties || []).map((item) => item.name)].filter(Boolean);
  return [...new Set(specialties)].join(" · ") || "Especialidade nao informada";
}
function formatTime(value?: string) { return value ? value.slice(0, 5) : ""; }
function DoctorAgenda({ doctor }: { doctor: Doctor }) {
  const slots = (doctor.availability || []).filter((slot) => slot.is_active).sort((a, b) => a.weekday - b.weekday);
  if (slots.length) {
    const visible = slots.slice(0, 4);
    return <div className="doctor-agenda" aria-label={`Agenda de ${doctorName(doctor)}`}>
      <div className="doctor-agenda-heading">
        <CalendarDays size={15} />
        <strong>Agenda</strong>
      </div>
      <div className="doctor-agenda-grid">
        {visible.map((slot) => <div className="doctor-agenda-slot" key={slot.id}>
          <span className="agenda-day">{weekdayShort(slot.weekday_name)}</span>
          <span className="agenda-time">{formatTime(slot.start_time)}-{formatTime(slot.end_time)}</span>
          {slot.location && <span className="agenda-location"><MapPin size={12} />{slot.location}</span>}
        </div>)}
        {slots.length > visible.length && <span className="agenda-more">+{slots.length - visible.length} horário{slots.length - visible.length > 1 ? "s" : ""}</span>}
      </div>
    </div>;
  }
  return <div className="doctor-agenda doctor-agenda-summary">
    <div className="doctor-agenda-heading">
      <CalendarDays size={15} />
      <strong>Agenda</strong>
    </div>
    <span>{doctor.availability_summary || (doctor.in_person_enabled || doctor.telemedicine_enabled ? "Disponível mediante marcação" : "Agenda por confirmar")}</span>
  </div>;
}
function weekdayShort(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.startsWith("segunda")) return "Seg";
  if (normalized.startsWith("terça") || normalized.startsWith("terca")) return "Ter";
  if (normalized.startsWith("quarta")) return "Qua";
  if (normalized.startsWith("quinta")) return "Qui";
  if (normalized.startsWith("sexta")) return "Sex";
  if (normalized.startsWith("sábado") || normalized.startsWith("sabado")) return "Sab";
  if (normalized.startsWith("domingo")) return "Dom";
  return value.slice(0, 3);
}
