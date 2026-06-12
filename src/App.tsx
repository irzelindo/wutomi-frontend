import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Hospital,
  KeyRound,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  UserRound,
  WalletCards,
} from "lucide-react";
import { API_BASE_URL, api, getAccessToken, pageItems, setSession } from "./api";
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

type View = "overview" | "appointments" | "booking" | "patients" | "doctors" | "hospitals" | "specialties" | "records" | "notifications" | "wallet" | "profile" | "settings" | "admin";
type AuthMode = "login" | "register" | "forgot" | "oauth";

const navItems: { view: View; label: string; icon: typeof Activity }[] = [
  { view: "overview", label: "Visao geral", icon: Activity },
  { view: "booking", label: "Agendamento", icon: ClipboardPlus },
  { view: "appointments", label: "Consultas", icon: CalendarDays },
  { view: "patients", label: "Pacientes", icon: UserRound },
  { view: "doctors", label: "Medicos", icon: Stethoscope },
  { view: "hospitals", label: "Hospitais", icon: Building2 },
  { view: "records", label: "Prontuario", icon: FileText },
  { view: "notifications", label: "Notificacoes", icon: Bell },
  { view: "wallet", label: "Carteira", icon: WalletCards },
  { view: "specialties", label: "Especialidades", icon: BadgeCheck },
  { view: "profile", label: "Perfil", icon: UserRound },
  { view: "settings", label: "Configuracoes", icon: Settings },
  { view: "admin", label: "Admin", icon: ShieldCheck },
];

const viewTitles: Record<View, string> = {
  overview: "Visao geral operacional",
  appointments: "Consultas",
  booking: "Novo agendamento",
  patients: "Pacientes",
  doctors: "Medicos",
  hospitals: "Hospitais",
  specialties: "Especialidades",
  records: "Prontuario clinico",
  notifications: "Notificacoes",
  wallet: "Carteira",
  profile: "Perfil",
  settings: "Configuracoes",
  admin: "Administracao",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  in_progress: "Em consulta",
  completed: "Concluida",
  cancelled: "Cancelada",
  no_show: "Faltou",
  rescheduled: "Reagendada",
  active: "Ativo",
  sent: "Enviada",
  read: "Lida",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-MZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatMoney(value?: string | number | null, currency = "MZN") {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("pt-MZ", { maximumFractionDigits: 2 })} ${currency}`;
}

function useAuthedQuery<T>(key: string[], queryFn: () => Promise<T>) {
  return useQuery({ queryKey: key, queryFn, enabled: Boolean(getAccessToken()) });
}

export function App() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("overview");
  const [role, setRole] = useState<Role>("hospital");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const health = useQuery({ queryKey: ["health"], queryFn: api.health, retry: 0 });
  const oauthProviders = useQuery({ queryKey: ["oauth-providers"], queryFn: api.oauthProviders, retry: 0 });
  const user = useAuthedQuery(["me"], api.me);
  const appointmentsQuery = useAuthedQuery(["appointments"], api.appointments);
  const patientsQuery = useAuthedQuery(["patients"], api.patients);
  const doctorsQuery = useAuthedQuery(["doctors"], api.doctors);
  const hospitalsQuery = useAuthedQuery(["hospitals"], api.hospitals);
  const specialtiesQuery = useAuthedQuery(["specialties"], api.specialties);
  const walletQuery = useAuthedQuery(["wallet"], api.wallet);
  const transactionsQuery = useAuthedQuery(["wallet-transactions"], api.walletTransactions);
  const recordsQuery = useAuthedQuery(["medical-records"], api.medicalRecords);
  const notificationsQuery = useAuthedQuery(["notifications"], api.notifications);
  const preferencesQuery = useAuthedQuery(["preferences"], api.preferences);
  const adminQuery = useAuthedQuery(["admin-summary"], api.adminSummary);

  const appointments = pageItems(appointmentsQuery.data || { items: demoAppointments });
  const patients = pageItems(patientsQuery.data || { items: demoPatients });
  const doctors = pageItems(doctorsQuery.data || { items: demoDoctors });
  const hospitals = pageItems(hospitalsQuery.data || { items: demoHospitals });
  const specialties = pageItems(specialtiesQuery.data || { items: demoSpecialties });
  const transactions = pageItems(transactionsQuery.data || { items: demoTransactions });
  const records = pageItems(recordsQuery.data || { items: demoMedicalRecords });
  const notifications = pageItems(notificationsQuery.data || { items: demoNotifications });
  const preferences = preferencesQuery.data || demoPreferences;
  const adminSummary = adminQuery.data || demoAdminSummary;
  const wallet = walletQuery.data || demoWallet;
  const authenticated = Boolean(getAccessToken());

  const login = useMutation({
    mutationFn: (payload: { email: string; password: string }) => api.login(payload.email, payload.password),
    onSuccess: (session) => {
      setSession(session);
      setNotice("Sessao iniciada com sucesso.");
      queryClient.invalidateQueries();
    },
    onError: (error) => setNotice(`Falha no login: ${error.message}`),
  });

  const register = useMutation({
    mutationFn: (payload: { email: string; full_name: string; password: string; role: string }) => api.register(payload),
    onSuccess: (_, payload) => {
      setNotice(`Conta criada para ${payload.full_name}. Agora pode entrar.`);
      setRole(payload.role as Role);
      setAuthMode("login");
    },
    onError: (error) => setNotice(`Nao foi possivel cadastrar: ${error.message}`),
  });

  const forgot = useMutation({
    mutationFn: api.forgotPassword,
    onSuccess: (data) => setNotice(data.reset_token ? `${data.message}. Token dev: ${data.reset_token}` : data.message),
    onError: (error) => setNotice(`Falha ao recuperar senha: ${error.message}`),
  });

  const updateProfile = useMutation({
    mutationFn: (payload: unknown) => api.updateUser(user.data?.id || "", payload),
    onSuccess: () => {
      setNotice("Perfil atualizado.");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => setNotice(`Nao foi possivel atualizar perfil: ${error.message}`),
  });

  const appointmentAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "confirm" | "check-in" | "complete" }) => {
      if (action === "confirm") return api.confirmAppointment(id);
      if (action === "check-in") return api.checkInAppointment(id);
      return api.completeAppointment(id);
    },
    onSuccess: () => {
      setNotice("Consulta atualizada.");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error) => setNotice(`Nao foi possivel atualizar: ${error.message}`),
  });

  const createAppointment = useMutation({
    mutationFn: (payload: { hospitalId: string; body: unknown }) => api.createHospitalAppointment(payload.hospitalId, payload.body),
    onSuccess: () => {
      setNotice("Consulta criada.");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setView("appointments");
    },
    onError: (error) => setNotice(`Nao foi possivel criar consulta: ${error.message}`),
  });

  const createRecord = useMutation({
    mutationFn: api.createMedicalRecord,
    onSuccess: () => {
      setNotice("Prontuario criado.");
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
    },
    onError: (error) => setNotice(`Nao foi possivel criar prontuario: ${error.message}`),
  });

  const topUp = useMutation({
    mutationFn: api.topUpWallet,
    onSuccess: () => {
      setNotice("Pedido de carregamento enviado.");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
    },
    onError: (error) => setNotice(`Nao foi possivel carregar: ${error.message}`),
  });

  const updatePreference = useMutation({
    mutationFn: api.updatePreference,
    onSuccess: () => {
      setNotice("Preferencia atualizada.");
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
    onError: (error) => setNotice(`Nao foi possivel atualizar preferencia: ${error.message}`),
  });

  const todayAppointments = useMemo(() => {
    const today = new Date().toDateString();
    return appointments.filter((item) => new Date(item.scheduled_start).toDateString() === today);
  }, [appointments]);

  const pendingAppointments = appointments.filter((item) => item.status === "pending");
  const activeAppointments = appointments.filter((item) => item.status === "in_progress");
  const completedAppointments = appointments.filter((item) => item.status === "completed");

  async function logout() {
    try {
      if (authenticated) await api.logout();
    } catch {
      // Local logout should still proceed if the token was already invalid.
    }
    setSession(null);
    setNotice("Sessao terminada. Modo demonstracao ativo.");
    queryClient.clear();
  }

  function refreshAll() {
    queryClient.invalidateQueries();
    health.refetch();
  }

  function go(viewName: View) {
    setView(viewName);
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark">W</span><div><strong>Wutomi</strong><small>Console clinica</small></div></div>
        <nav className="nav-list" aria-label="Navegacao principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <button className={`nav-item ${view === item.view ? "active" : ""}`} key={item.view} onClick={() => go(item.view)}><Icon size={18} /><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="api-card"><span>API</span><strong>{health.data ? `${health.data.status} / ${health.data.database}` : "offline"}</strong><small>{API_BASE_URL}</small><small>{authenticated ? "Sessao autenticada" : "Modo demonstracao"}</small></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="title-block"><span>API Wutomi na porta 8001</span><h1>{viewTitles[view]}</h1></div>
          <div className="topbar-actions">
            <select value={role} onChange={(event) => setRole(event.target.value as Role)} aria-label="Tipo de utilizador">
              <option value="patient">Paciente</option><option value="doctor">Medico</option><option value="hospital">Hospital</option><option value="admin">Admin</option>
            </select>
            <button className="icon-button" onClick={refreshAll} title="Atualizar dados"><RefreshCw size={18} /></button>
          </div>
        </header>

        <SessionPanel
          user={user.data}
          authenticated={authenticated}
          mode={authMode}
          setMode={setAuthMode}
          role={role}
          setRole={setRole}
          providers={oauthProviders.data || []}
          onLogin={login.mutate}
          onRegister={register.mutate}
          onForgot={forgot.mutate}
          onLogout={logout}
          onOauth={async (provider) => {
            const response = await api.oauthAuthorize(provider);
            window.location.href = response.authorization_url;
          }}
          loading={login.isPending || register.isPending || forgot.isPending}
        />

        {notice && <section className="notice"><Bell size={17} /><span>{notice}</span><button onClick={() => setNotice("")}>Fechar</button></section>}

        {view === "overview" && <Overview appointments={appointments} todayAppointments={todayAppointments} pending={pendingAppointments.length} active={activeAppointments.length} completed={completedAppointments.length} patients={patients.length} doctors={doctors.length} hospitals={hospitals.length} revenue={adminSummary.total_revenue} />}
        {view === "appointments" && <AppointmentsView appointments={appointments} onAction={(id, action) => appointmentAction.mutate({ id, action })} />}
        {view === "booking" && <BookingView hospitals={hospitals} specialties={specialties} doctors={doctors} patients={patients} disabled={!authenticated} onSubmit={(hospitalId, body) => createAppointment.mutate({ hospitalId, body })} />}
        {view === "patients" && <PeopleView title="Pacientes" search={search} onSearch={setSearch} items={patients.filter((item) => personName(item).toLowerCase().includes(search.toLowerCase()))} render={(patient) => <PatientCard patient={patient} />} />}
        {view === "doctors" && <PeopleView title="Medicos" search={search} onSearch={setSearch} items={doctors.filter((item) => `${doctorName(item)} ${item.specialty || ""}`.toLowerCase().includes(search.toLowerCase()))} render={(doctor) => <DoctorCard doctor={doctor} />} />}
        {view === "hospitals" && <HospitalsView hospitals={hospitals} />}
        {view === "specialties" && <SpecialtiesView specialties={specialties} />}
        {view === "records" && <RecordsView records={records} patients={patients} doctors={doctors} appointments={appointments} disabled={!authenticated} onCreate={(payload) => createRecord.mutate(payload)} />}
        {view === "notifications" && <NotificationsView notifications={notifications} preferences={preferences} onPreference={(payload) => updatePreference.mutate(payload)} />}
        {view === "wallet" && <WalletView wallet={wallet} transactions={transactions} disabled={!authenticated} onTopUp={(payload) => topUp.mutate(payload)} />}
        {view === "profile" && <ProfileView user={user.data} role={role} disabled={!authenticated} onSubmit={(payload) => updateProfile.mutate(payload)} />}
        {view === "settings" && <SettingsView preferences={preferences} onPreference={(payload) => updatePreference.mutate(payload)} />}
        {view === "admin" && <AdminView summary={adminSummary} />}
      </main>
    </div>
  );
}

function SessionPanel(props: {
  user?: CurrentUser;
  authenticated: boolean;
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  role: Role;
  setRole: (role: Role) => void;
  providers: { provider: string; display_name: string; configured: boolean }[];
  onLogin: (payload: { email: string; password: string }) => void;
  onRegister: (payload: { email: string; full_name: string; password: string; role: string }) => void;
  onForgot: (email: string) => void;
  onLogout: () => void;
  onOauth: (provider: string) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  if (props.authenticated) {
    return <section className="session-panel"><div><span className="section-kicker">Sessao</span><h2>{props.user?.full_name || props.user?.email || "Utilizador autenticado"}</h2><p>Perfil atual: {props.user?.role || props.role} · {props.user?.is_verified ? "email verificado" : "email por verificar"}</p></div><button onClick={props.onLogout} className="secondary-button"><LogOut size={17} /> Sair</button></section>;
  }

  return (
    <section className="session-panel auth-expanded">
      <div className="auth-copy"><span className="section-kicker">Acesso</span><h2>Entrar ou criar conta</h2><p>Cadastro base cria utilizador; depois o perfil permite escolher o tipo e completar dados clinicos ou operacionais.</p></div>
      <div className="auth-box">
        <div className="segmented"><button className={props.mode === "login" ? "active" : ""} onClick={() => props.setMode("login")}>Login</button><button className={props.mode === "register" ? "active" : ""} onClick={() => props.setMode("register")}>Cadastro</button><button className={props.mode === "oauth" ? "active" : ""} onClick={() => props.setMode("oauth")}>OAuth</button><button className={props.mode === "forgot" ? "active" : ""} onClick={() => props.setMode("forgot")}>Senha</button></div>
        {props.mode === "login" && <form className="login-form" onSubmit={(event) => { event.preventDefault(); props.onLogin({ email, password }); }}><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Palavra-passe" /><button disabled={props.loading}><KeyRound size={16} /> Entrar</button></form>}
        {props.mode === "register" && <form className="login-form register-form" onSubmit={(event) => { event.preventDefault(); props.onRegister({ email, full_name: fullName, password, role: props.role }); }}><input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nome completo" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimo 8 caracteres" /><select value={props.role} onChange={(event) => props.setRole(event.target.value as Role)}><option value="patient">Paciente</option><option value="doctor">Medico</option><option value="hospital">Hospital</option><option value="admin">Admin</option></select><button disabled={props.loading}><UserPlus size={16} /> Criar conta</button></form>}
        {props.mode === "oauth" && <div className="oauth-grid">{props.providers.length ? props.providers.map((provider) => <button key={provider.provider} disabled={!provider.configured} onClick={() => props.onOauth(provider.provider)}>{provider.display_name}{!provider.configured ? " indisponivel" : ""}</button>) : <p className="empty-state">Nenhum provedor OAuth devolvido pela API.</p>}</div>}
        {props.mode === "forgot" && <form className="login-form" onSubmit={(event) => { event.preventDefault(); props.onForgot(email); }}><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" /><button disabled={props.loading}>Enviar recuperacao</button></form>}
      </div>
    </section>
  );
}

function Overview({ appointments, todayAppointments, pending, active, completed, patients, doctors, hospitals, revenue }: { appointments: Appointment[]; todayAppointments: Appointment[]; pending: number; active: number; completed: number; patients: number; doctors: number; hospitals: number; revenue: string | number }) {
  return <><section className="metric-grid"><Metric label="Consultas hoje" value={todayAppointments.length} hint="Agenda do dia" icon={CalendarDays} /><Metric label="Pendentes" value={pending} hint="Aguardam confirmacao" icon={BadgeCheck} /><Metric label="Pacientes" value={patients} hint={`${doctors} medicos · ${hospitals} hospitais`} icon={HeartPulse} /><Metric label="Receita" value={formatMoney(revenue)} hint="Pagamentos concluidos" icon={CreditCard} /></section><section className="content-grid"><Panel title="Agenda imediata"><Timeline items={todayAppointments.length ? todayAppointments : appointments.slice(0, 4)} render={(item) => <><strong>{formatDate(item.scheduled_start)} · {item.patient_full_name || item.patient_id}</strong><span>{item.doctor_full_name || item.doctor_id} · {item.doctor_specialty || "Especialidade"}</span><StatusPill value={item.status} /></>} /></Panel><Panel title="Fila clinica"><div className="queue-grid"><QueueItem value={pending} label="Por confirmar" /><QueueItem value={active} label="Em atendimento" /><QueueItem value={completed} label="Concluidas" /></div></Panel></section></>;
}

function AppointmentsView({ appointments, onAction }: { appointments: Appointment[]; onAction: (id: string, action: "confirm" | "check-in" | "complete") => void }) {
  const [status, setStatus] = useState("");
  const filtered = appointments.filter((item) => !status || item.status === status);
  return <Panel title="Consultas" action={<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos estados</option><option value="pending">Pendente</option><option value="confirmed">Confirmada</option><option value="in_progress">Em consulta</option><option value="completed">Concluida</option><option value="cancelled">Cancelada</option></select>}><div className="table-wrap"><table><thead><tr><th>Hora</th><th>Paciente</th><th>Medico</th><th>Especialidade</th><th>Estado</th><th>Acoes</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>{formatDate(item.scheduled_start)}</td><td>{item.patient_full_name || item.patient_id}</td><td>{item.doctor_full_name || item.doctor_id}</td><td>{item.doctor_specialty || "-"}</td><td><StatusPill value={item.status} /></td><td><div className="row-actions"><button onClick={() => onAction(item.id, "confirm")}>Confirmar</button><button onClick={() => onAction(item.id, "check-in")}>Check-in</button><button onClick={() => onAction(item.id, "complete")}>Concluir</button></div></td></tr>)}</tbody></table></div></Panel>;
}

function BookingView({ hospitals, specialties, doctors, patients, disabled, onSubmit }: { hospitals: HospitalType[]; specialties: Specialty[]; doctors: Doctor[]; patients: Patient[]; disabled: boolean; onSubmit: (hospitalId: string, body: unknown) => void }) {
  return <Panel title="Novo agendamento" action={<span className="badge">Hospital {'>'} Especialidade {'>'} Medico {'>'} Agenda</span>}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit(String(data.get("hospitalId")), { patient_id: data.get("patientId"), doctor_id: data.get("doctorId"), scheduled_start: data.get("scheduledStart"), scheduled_end: data.get("scheduledEnd"), timezone: "Africa/Maputo", type: "in_person", location: data.get("location"), reason: data.get("reason") }); }}><SelectField name="hospitalId" label="Hospital" items={hospitals.map((item) => ({ value: item.id, label: item.name }))} /><SelectField name="specialtyId" label="Especialidade" items={specialties.map((item) => ({ value: item.id, label: item.name }))} /><SelectField name="doctorId" label="Medico" items={doctors.map((item) => ({ value: item.id, label: `${doctorName(item)} · ${item.specialty || "Especialidade"}` }))} /><SelectField name="patientId" label="Paciente" items={patients.map((item) => ({ value: item.id, label: personName(item) }))} /><label>Inicio<input required name="scheduledStart" type="datetime-local" /></label><label>Fim<input required name="scheduledEnd" type="datetime-local" /></label><label className="wide">Motivo<textarea name="reason" rows={3} placeholder="Consulta de rotina, sintomas, acompanhamento..." /></label><label className="wide">Local<input name="location" placeholder="Hospital, sala ou recepcao" /></label><button disabled={disabled}>{disabled ? "Entre para criar" : "Criar consulta"}</button></form></Panel>;
}

function ProfileView({ user, role, disabled, onSubmit }: { user?: CurrentUser; role: Role; disabled: boolean; onSubmit: (payload: unknown) => void }) {
  return <section className="content-grid"><Panel title="Dados pessoais"><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit(Object.fromEntries(data.entries())); }}><label>Nome<input name="full_name" defaultValue={user?.full_name || ""} /></label><label>Email<input name="email" type="email" defaultValue={user?.email || ""} /></label><label>Telefone<input name="phone" defaultValue={user?.phone || ""} /></label><label>Genero<input name="gender" defaultValue={user?.gender || ""} /></label><label>Documento<input name="document_type" defaultValue={user?.document_type || "BI"} /></label><label>Numero<input name="document_number" defaultValue={user?.document_number || ""} /></label><label className="wide">Endereco<input name="address" defaultValue={user?.address || ""} /></label><label>Locale<input name="locale" defaultValue={user?.locale || "pt-MZ"} /></label><label>Timezone<input name="timezone" defaultValue={user?.timezone || "Africa/Maputo"} /></label><label>Tipo<select name="role" defaultValue={user?.role || role}><option value="patient">Paciente</option><option value="doctor">Medico</option><option value="hospital">Hospital</option><option value="admin">Admin</option></select></label><button disabled={disabled}>{disabled ? "Entre para editar" : "Guardar perfil"}</button></form></Panel><Panel title="Proximos dados por tipo"><div className="timeline"><article className="timeline-item"><strong>Paciente</strong><span>Consentimentos, alergias, condicoes, medicacao, seguro e contactos.</span></article><article className="timeline-item"><strong>Medico</strong><span>Licenca, especialidades NUCC, disponibilidade, documentos e carteira.</span></article><article className="timeline-item"><strong>Hospital</strong><span>Dados institucionais, equipa, medicos, pacientes e agenda presencial.</span></article></div></Panel></section>;
}

function RecordsView({ records, patients, doctors, appointments, disabled, onCreate }: { records: MedicalRecord[]; patients: Patient[]; doctors: Doctor[]; appointments: Appointment[]; disabled: boolean; onCreate: (payload: unknown) => void }) {
  return <section className="content-grid"><Panel title="Prontuarios"><Timeline items={records} render={(item) => <><strong>{item.patient_full_name || item.patient_id}</strong><span>{item.chief_complaint || "Sem queixa"} · {item.assessment || "Sem avaliacao"}</span><span>{formatDate(item.created_at)}</span></>} /></Panel><Panel title="Novo registo clinico"><form className="stacked-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onCreate(Object.fromEntries(data.entries())); }}><SelectField name="patient_id" label="Paciente" items={patients.map((item) => ({ value: item.id, label: personName(item) }))} /><SelectField name="doctor_id" label="Medico" items={doctors.map((item) => ({ value: item.id, label: doctorName(item) }))} /><SelectField name="appointment_id" label="Consulta" items={appointments.map((item) => ({ value: item.id, label: `${formatDate(item.scheduled_start)} · ${item.patient_full_name || item.patient_id}` }))} /><textarea name="chief_complaint" rows={2} placeholder="Queixa principal" /><textarea name="assessment" rows={2} placeholder="Avaliacao" /><textarea name="plan" rows={2} placeholder="Plano" /><button disabled={disabled}>{disabled ? "Entre para criar" : "Criar prontuario"}</button></form></Panel></section>;
}

function NotificationsView({ notifications, preferences, onPreference }: { notifications: { id: string; channel: string; subject?: string | null; body: string; status: string; created_at: string }[]; preferences: { channel: string; enabled: boolean }[]; onPreference: (payload: { channel: string; enabled: boolean }) => void }) {
  return <section className="content-grid"><Panel title="Notificacoes"><Timeline items={notifications} render={(item) => <><strong>{item.subject || item.channel}</strong><span>{item.body}</span><StatusPill value={item.status} /></>} /></Panel><Panel title="Preferencias"><div className="settings-list">{preferences.map((item) => <label key={item.channel} className="toggle-row"><span>{item.channel}</span><input type="checkbox" checked={item.enabled} onChange={(event) => onPreference({ channel: item.channel, enabled: event.target.checked })} /></label>)}</div></Panel></section>;
}

function WalletView({ wallet, transactions, disabled, onTopUp }: { wallet: { balance: string | number; currency: string }; transactions: { id: number; amount: string | number; direction: string; description?: string | null; transaction_type?: string; created_at: string }[]; disabled: boolean; onTopUp: (payload: unknown) => void }) {
  return <section className="content-grid"><Panel title="Carteira"><div className="wallet-card"><span>Saldo disponivel</span><strong>{formatMoney(wallet.balance, wallet.currency)}</strong></div><form className="stacked-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onTopUp({ amount: data.get("amount"), provider: data.get("provider"), phone_number: data.get("phone") }); }}><input required name="amount" type="number" min="1" step="0.01" placeholder="Valor" /><select name="provider"><option value="mpesa">M-Pesa</option><option value="mkesh">mKesh</option><option value="emola">e-Mola</option></select><input required name="phone" placeholder="841234567" /><button disabled={disabled}>{disabled ? "Entre para carregar" : "Carregar carteira"}</button></form></Panel><Panel title="Movimentos"><Timeline items={transactions} render={(item) => <><strong>{item.direction === "credit" ? "+" : "-"} {formatMoney(item.amount)}</strong><span>{item.description || item.transaction_type || "Movimento"} · {formatDate(item.created_at)}</span></>} /></Panel></section>;
}

function HospitalsView({ hospitals }: { hospitals: HospitalType[] }) { return <PeopleView title="Hospitais" search="" onSearch={() => undefined} items={hospitals} render={(item) => <article className="person-card"><div><h3>{item.name}</h3><p>{[item.city, item.province, item.country].filter(Boolean).join(" · ") || "Localizacao por definir"}</p></div><div className="badge-row"><span className="badge">{item.is_active === false ? "Inativo" : "Ativo"}</span><span className="badge">{item.id}</span></div></article>} />; }
function SpecialtiesView({ specialties }: { specialties: Specialty[] }) { return <PeopleView title="Especialidades NUCC / pt-MZ" search="" onSearch={() => undefined} items={specialties} render={(item) => <article className="person-card"><div><h3>{item.name}</h3><p>{item.description || item.classification || "Catalogo validado"}</p></div><div className="badge-row"><span className="badge">{item.grouping || "NUCC"}</span><span className="badge">{item.id}</span></div></article>} />; }
function SettingsView({ preferences, onPreference }: { preferences: { channel: string; enabled: boolean }[]; onPreference: (payload: { channel: string; enabled: boolean }) => void }) { return <section className="content-grid"><Panel title="Aplicacao"><div className="settings-list"><div><strong>API base</strong><span>{API_BASE_URL}</span></div><div><strong>Locale</strong><span>pt-MZ</span></div><div><strong>Timezone</strong><span>Africa/Maputo</span></div></div></Panel><Panel title="Canais"><div className="settings-list">{preferences.map((item) => <label key={item.channel} className="toggle-row"><span>{item.channel}</span><input type="checkbox" checked={item.enabled} onChange={(event) => onPreference({ channel: item.channel, enabled: event.target.checked })} /></label>)}</div></Panel></section>; }
function AdminView({ summary }: { summary: Record<string, string | number | undefined> }) { const metrics = [["Utilizadores", summary.total_users], ["Medicos ativos", summary.active_doctors], ["Pacientes", summary.total_patients], ["Consultas", summary.total_appointments], ["Pendentes", summary.pending_appointments], ["Receita", formatMoney(summary.total_revenue)]]; return <section className="content-grid"><Panel title="Indicadores admin"><div className="admin-grid">{metrics.map(([label, value]) => <div key={label}><strong>{value || 0}</strong><span>{label}</span></div>)}</div></Panel><Panel title="Governanca"><div className="timeline-item"><strong>Auditoria, aprovacoes e catalogo clinico</strong><span>Area ligada aos endpoints de admin, users, doctors, hospitals e specialties.</span></div></Panel></section>; }
function PeopleView<T>({ title, search, onSearch, items, render }: { title: string; search: string; onSearch: (value: string) => void; items: T[]; render: (item: T) => React.ReactNode }) { return <Panel title={title} action={onSearch ? <div className="search-box"><Search size={17} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Pesquisar" /></div> : undefined}><div className="card-grid">{items.map((item, index) => <div key={index}>{render(item)}</div>)}</div></Panel>; }
function Metric({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint: string; icon: typeof Activity }) { return <article className="metric"><Icon size={20} /><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>; }
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="panel"><div className="panel-heading"><h2>{title}</h2>{action}</div>{children}</section>; }
function Timeline<T>({ items, render }: { items: T[]; render: (item: T) => React.ReactNode }) { if (!items.length) return <p className="empty-state">Sem dados.</p>; return <div className="timeline">{items.map((item, index) => <article className="timeline-item" key={index}>{render(item)}</article>)}</div>; }
function QueueItem({ value, label }: { value: number; label: string }) { return <div className="queue-item"><strong>{value}</strong><span>{label}</span></div>; }
function StatusPill({ value }: { value?: string | null }) { return <span className={`status-pill status-${value || "unknown"}`}>{statusLabels[value || ""] || value || "-"}</span>; }
function SelectField({ name, label, items }: { name: string; label: string; items: { value: string; label: string }[] }) { return <label>{label}<select required name={name}>{items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>; }
function PatientCard({ patient }: { patient: Patient }) { return <article className="person-card"><div><h3>{personName(patient)}</h3><p>{patient.phone || "Telefone nao informado"}</p></div><div className="badge-row"><span className="badge">Sangue: {patient.blood_type || "desconhecido"}</span><span className="badge">{patient.id}</span></div></article>; }
function DoctorCard({ doctor }: { doctor: Doctor }) { return <article className="person-card"><div><h3>{doctorName(doctor)}</h3><p>{doctor.specialty || "Especialidade nao informada"}</p></div><div className="badge-row"><StatusPill value={doctor.status || "active"} /><span className="badge">{formatMoney(doctor.consultation_fee, doctor.currency || "MZN")}</span></div></article>; }
function personName(patient: Patient) { return patient.user_full_name || patient.full_name || patient.id; }
function doctorName(doctor: Doctor) { return doctor.user_full_name || doctor.user_email || doctor.id; }
