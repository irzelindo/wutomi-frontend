import { useEffect, useMemo, useState } from "react";
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
import { api, clearOauthHash, getAccessToken, pageItems, readOauthSessionFromUrl, setSession } from "./api";
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

type ModuleSpec = {
  view: View;
  label: string;
  icon: typeof Activity;
  access: Access[];
  summary: string;
};

const modules: ModuleSpec[] = [
  { view: "overview", label: "Visao geral", icon: Activity, access: ["public", "patient", "doctor", "hospital", "admin"], summary: "Resumo da actividade e próximos passos." },
  { view: "auth", label: "Acesso", icon: KeyRound, access: ["public"], summary: "Entrar, criar conta, recuperar acesso e usar Google ou GitHub." },
  { view: "booking", label: "Agendamento", icon: ClipboardPlus, access: ["patient", "hospital", "admin"], summary: "Escolha hospital, especialidade, médico e horário." },
  { view: "appointments", label: "Consultas", icon: CalendarDays, access: ["patient", "doctor", "hospital", "admin"], summary: "Acompanhe marcações, estados e histórico." },
  { view: "patients", label: "Perfil clinico", icon: UserRound, access: ["doctor", "hospital", "admin"], summary: "Dados clínicos, consentimentos, alergias, medicação e contactos." },
  { view: "doctors", label: "Medicos", icon: Stethoscope, access: ["doctor", "hospital", "admin", "patient"], summary: "Encontre médicos por especialidade, hospital e disponibilidade." },
  { view: "hospitals", label: "Hospitais", icon: Building2, access: ["hospital", "admin", "patient", "doctor"], summary: "Escolha uma unidade de atendimento próxima." },
  { view: "specialties", label: "Especialidades", icon: BadgeCheck, access: ["patient", "doctor", "hospital", "admin"], summary: "Conheça áreas clínicas e escolha a mais adequada." },
  { view: "records", label: "Prontuario", icon: FileText, access: ["doctor", "patient", "admin"], summary: "Notas clínicas, diagnósticos, prescrições e anexos." },
  { view: "notifications", label: "Notificacoes", icon: Bell, access: ["patient", "doctor", "hospital", "admin"], summary: "Lembretes, avisos e preferências de contacto." },
  { view: "wallet", label: "Carteira", icon: WalletCards, access: ["doctor", "hospital"], summary: "Saldo, carregamentos e movimentos." },
  { view: "profile", label: "Perfil", icon: UserRound, access: ["patient", "doctor", "hospital", "admin"], summary: "Dados pessoais, contacto e preferências regionais." },
  { view: "settings", label: "Configuracoes", icon: Settings, access: ["patient", "doctor", "hospital", "admin"], summary: "Preferências, notificações e modo de demonstração." },
  { view: "admin", label: "Admin", icon: ShieldCheck, access: ["admin"], summary: "Auditoria, validações, gestão operacional e segurança." },
];

const viewTitles = Object.fromEntries(modules.map((item) => [item.view, item.label])) as Record<View, string>;
const statusLabels: Record<string, string> = { pending: "Pendente", confirmed: "Confirmada", in_progress: "Em consulta", completed: "Concluida", cancelled: "Cancelada", no_show: "Faltou", rescheduled: "Reagendada", active: "Ativo", sent: "Enviada", read: "Lida" };

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
  const allPrivateErrors = [appointmentsQuery, patientsQuery, doctorsQuery, hospitalsQuery, specialtiesQuery, recordsQuery, notificationsQuery, walletQuery, adminQuery].filter((query) => query.error);

  useEffect(() => {
    if (!visibleModules.some((item) => item.view === view)) setView(visibleModules[0]?.view || "overview");
  }, [role, authenticated, view, visibleModules]);

  const appointments = dataOrDemo(appointmentsQuery.data, demoAppointments, demoMode);
  const patients = dataOrDemo(patientsQuery.data, demoPatients, demoMode);
  const doctors = dataOrDemo(doctorsQuery.data, demoDoctors, demoMode);
  const hospitals = dataOrDemo(hospitalsQuery.data, demoHospitals, demoMode);
  const specialties = dataOrDemo(specialtiesQuery.data, demoSpecialties, demoMode);
  const transactions = dataOrDemo(transactionsQuery.data, demoTransactions, demoMode);
  const records = dataOrDemo(recordsQuery.data, demoMedicalRecords, demoMode);
  const notifications = dataOrDemo(notificationsQuery.data, demoNotifications, demoMode);
  const preferences = preferencesQuery.data || (demoMode ? demoPreferences : []);
  const adminSummary = adminQuery.data || (demoMode ? demoAdminSummary : emptyAdminSummary);
  const wallet = walletQuery.data || (demoMode ? demoWallet : { balance: 0, currency: "MZN" });

  const login = useMutation({
    mutationFn: (payload: { email: string; password: string }) => api.login(payload.email, payload.password),
    onSuccess: (session) => { setSession(session); setDemoMode(false); setNotice("Sessão iniciada. Vamos começar pela escolha do hospital."); setView("booking"); queryClient.invalidateQueries(); },
    onError: (error) => setNotice(`Falha no login: ${error.message}`),
  });

  const register = useMutation({
    mutationFn: (payload: { email: string; full_name: string; password: string; role: string }) => api.register({ email: payload.email, full_name: payload.full_name, password: payload.password }),
    onSuccess: (_, payload) => { setNotice(`Conta criada para ${payload.full_name}. Entre e complete o perfil de ${roleLabel(payload.role)}.`); setSelectedRole(payload.role as Role); setAuthMode("login"); },
    onError: (error) => setNotice(`Nao foi possivel cadastrar: ${error.message}`),
  });

  const forgot = useMutation({ mutationFn: api.forgotPassword, onSuccess: (data) => setNotice(data.reset_token ? `${data.message}. Token dev: ${data.reset_token}` : data.message), onError: (error) => setNotice(`Falha ao recuperar senha: ${error.message}`) });
  const updateProfile = useMutation({ mutationFn: (payload: unknown) => api.updateUser(user.data?.id || "", payload), onSuccess: () => { setNotice("Perfil atualizado."); queryClient.invalidateQueries({ queryKey: ["me"] }); }, onError: (error) => setNotice(`Nao foi possivel atualizar perfil: ${error.message}`) });
  const appointmentAction = useMutation({ mutationFn: ({ id, action }: { id: string; action: "confirm" | "check-in" | "complete" }) => action === "confirm" ? api.confirmAppointment(id) : action === "check-in" ? api.checkInAppointment(id) : api.completeAppointment(id), onSuccess: () => { setNotice("Consulta atualizada."); queryClient.invalidateQueries({ queryKey: ["appointments"] }); }, onError: (error) => setNotice(`Nao foi possivel atualizar: ${error.message}`) });
  const createAppointment = useMutation({ mutationFn: (payload: unknown) => api.createAppointment(payload), onSuccess: () => { setNotice("Pedido de consulta enviado. O médico deverá confirmar a marcação."); queryClient.invalidateQueries({ queryKey: ["appointments"] }); setView("appointments"); }, onError: (error) => setNotice(`Nao foi possivel criar consulta: ${error.message}`) });
  const createRecord = useMutation({ mutationFn: api.createMedicalRecord, onSuccess: () => { setNotice("Prontuario criado."); queryClient.invalidateQueries({ queryKey: ["medical-records"] }); }, onError: (error) => setNotice(`Nao foi possivel criar prontuario: ${error.message}`) });
  const topUp = useMutation({ mutationFn: api.topUpWallet, onSuccess: () => { setNotice("Pedido de carregamento enviado."); queryClient.invalidateQueries({ queryKey: ["wallet"] }); queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] }); }, onError: (error) => setNotice(`Nao foi possivel carregar: ${error.message}`) });
  const updatePreference = useMutation({ mutationFn: api.updatePreference, onSuccess: () => { setNotice("Preferencia atualizada."); queryClient.invalidateQueries({ queryKey: ["preferences"] }); }, onError: (error) => setNotice(`Nao foi possivel atualizar preferencia: ${error.message}`) });

  const todayAppointments = useMemo(() => {
    const today = new Date().toDateString();
    return appointments.filter((item) => new Date(item.scheduled_start).toDateString() === today);
  }, [appointments]);

  async function logout() {
    try { if (authenticated) await api.logout(); } catch { /* logout local mesmo com token expirado */ }
    setSession(null); setNotice("Sessao terminada."); queryClient.clear(); setView("overview");
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
              <option value="patient">Paciente</option><option value="doctor">Medico</option><option value="hospital">Hospital</option><option value="admin">Admin</option>
            </select>
            <button className="icon-button" onClick={refreshAll} title="Atualizar dados"><RefreshCw size={18} /></button>
          </div>
        </header>

        {!authenticated && <SessionPanel mode={authMode} setMode={setAuthMode} role={selectedRole} setRole={setSelectedRole} providers={oauthProviders.data || []} onLogin={login.mutate} onRegister={register.mutate} onForgot={forgot.mutate} onOauth={async (provider) => { const response = await api.oauthAuthorize(provider); window.location.href = response.authorization_url; }} loading={login.isPending || register.isPending || forgot.isPending} />}
        {authenticated && <AuthenticatedBar user={user.data} role={role} onLogout={logout} />}
        {notice && <section className="notice"><Bell size={17} /><span>{notice}</span><button onClick={() => setNotice("")}>Fechar</button></section>}
        {allPrivateErrors.length > 0 && authenticated && <ApiErrorBanner errors={allPrivateErrors.map((query) => query.error as Error)} />}

        {view === "overview" && <Overview role={role} authenticated={authenticated} demoMode={demoMode} modules={visibleModules} appointments={appointments} todayAppointments={todayAppointments} pending={appointments.filter((item) => item.status === "pending").length} active={appointments.filter((item) => item.status === "in_progress").length} completed={appointments.filter((item) => item.status === "completed").length} patients={patients.length} doctors={doctors.length} hospitals={hospitals.length} revenue={adminSummary.total_revenue} />}
        {view === "auth" && <AuthModule providers={oauthProviders.data || []} />}
        {view === "appointments" && <RequireAuth authenticated={authenticated}><AppointmentsView appointments={appointments} onAction={(id, action) => appointmentAction.mutate({ id, action })} /></RequireAuth>}
        {view === "booking" && <RequireAuth authenticated={authenticated}><BookingView hospitals={hospitals} patients={patients} disabled={!authenticated} demoMode={demoMode} onSubmit={(body) => createAppointment.mutate(body)} /></RequireAuth>}
        {view === "patients" && <RequireAuth authenticated={authenticated}><PeopleView title="Pacientes" search={search} onSearch={setSearch} items={patients.filter((item) => personName(item).toLowerCase().includes(search.toLowerCase()))} render={(patient) => <PatientCard patient={patient} />} /></RequireAuth>}
        {view === "doctors" && <RequireAuth authenticated={authenticated}><PeopleView title="Medicos" search={search} onSearch={setSearch} items={doctors.filter((item) => `${doctorName(item)} ${item.specialty || ""}`.toLowerCase().includes(search.toLowerCase()))} render={(doctor) => <DoctorCard doctor={doctor} />} /></RequireAuth>}
        {view === "hospitals" && <RequireAuth authenticated={authenticated}><HospitalsView hospitals={hospitals} /></RequireAuth>}
        {view === "specialties" && <RequireAuth authenticated={authenticated}><SpecialtiesView specialties={specialties} /></RequireAuth>}
        {view === "records" && <RequireAuth authenticated={authenticated}><RecordsView records={records} patients={patients} doctors={doctors} appointments={appointments} disabled={!authenticated} onCreate={(payload) => createRecord.mutate(payload)} /></RequireAuth>}
        {view === "notifications" && <RequireAuth authenticated={authenticated}><NotificationsView notifications={notifications} preferences={preferences} onPreference={(payload) => updatePreference.mutate(payload)} /></RequireAuth>}
        {view === "wallet" && <RequireAuth authenticated={authenticated}><WalletView wallet={wallet} transactions={transactions} disabled={!authenticated} onTopUp={(payload) => topUp.mutate(payload)} /></RequireAuth>}
        {view === "profile" && <RequireAuth authenticated={authenticated}><ProfileView user={user.data} role={role} disabled={!authenticated} onSubmit={(payload) => updateProfile.mutate(payload)} /></RequireAuth>}
        {view === "settings" && <SettingsView demoMode={demoMode} setDemoMode={setDemoMode} preferences={preferences} onPreference={(payload) => updatePreference.mutate(payload)} />}
        {view === "admin" && <RequireRole role={role} required="admin"><AdminView summary={adminSummary} /></RequireRole>}
      </main>
    </div>
  );
}

const emptyAdminSummary = { total_users: 0, active_users: 0, admin_users: 0, total_doctors: 0, active_doctors: 0, total_patients: 0, total_appointments: 0, pending_appointments: 0, completed_appointments: 0, total_payments: 0, completed_payments: 0, total_revenue: 0 };
function dataOrDemo<T>(payload: { items?: T[]; results?: T[] } | T[] | undefined, demo: T[], demoMode: boolean): T[] { if (payload) return pageItems(payload); return demoMode ? demo : []; }
function roleLabel(role: string) { return role === "doctor" ? "Medico" : role === "hospital" ? "Hospital" : role === "admin" ? "Admin" : "Paciente"; }

function AuthenticatedBar({ user, role, onLogout }: { user?: CurrentUser; role: Role; onLogout: () => void }) { return <section className="session-panel compact-session"><div><span className="section-kicker">Sessao</span><h2>{user?.full_name || user?.email || "Utilizador autenticado"}</h2><p>{roleLabel(role)} · {user?.is_verified ? "email verificado" : "email por verificar"}</p></div><button onClick={onLogout} className="secondary-button"><LogOut size={17} /> Sair</button></section>; }
function ApiErrorBanner({ errors }: { errors: Error[] }) { return <section className="notice"><Bell size={17} /><span>Alguns módulos não carregaram. Esta conta pode não ter permissão para tudo: {errors[0]?.message}</span></section>; }
function RequireAuth({ authenticated, children }: { authenticated: boolean; children: React.ReactNode }) { return authenticated ? <>{children}</> : <Panel title="Sessao necessaria"><p className="empty-state">Entre para carregar os dados deste módulo.</p></Panel>; }
function RequireRole({ role, required, children }: { role: Role; required: Role; children: React.ReactNode }) { return role === required ? <>{children}</> : <Panel title="Acesso restrito"><p className="empty-state">Este modulo exige perfil {roleLabel(required)}.</p></Panel>; }

function SessionPanel(props: { mode: AuthMode; setMode: (mode: AuthMode) => void; role: Role; setRole: (role: Role) => void; providers: { provider: string; display_name: string; configured: boolean }[]; onLogin: (payload: { email: string; password: string }) => void; onRegister: (payload: { email: string; full_name: string; password: string; role: string }) => void; onForgot: (email: string) => void; onOauth: (provider: string) => void; loading: boolean }) {
  const [email, setEmail] = useState(""); const [fullName, setFullName] = useState(""); const [password, setPassword] = useState("");
  return <section className="session-panel auth-expanded"><div className="auth-copy"><span className="section-kicker">Acesso</span><h2>Entrar ou criar conta</h2><p>O cadastro cria uma conta comum. Perfil admin só pode ser atribuído pela equipa administrativa.</p></div><div className="auth-box"><div className="segmented"><button className={props.mode === "login" ? "active" : ""} onClick={() => props.setMode("login")}>Login</button><button className={props.mode === "register" ? "active" : ""} onClick={() => props.setMode("register")}>Cadastro</button><button className={props.mode === "oauth" ? "active" : ""} onClick={() => props.setMode("oauth")}>OAuth</button><button className={props.mode === "forgot" ? "active" : ""} onClick={() => props.setMode("forgot")}>Senha</button></div>{props.mode === "login" && <form className="login-form" onSubmit={(event) => { event.preventDefault(); props.onLogin({ email, password }); }}><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Palavra-passe" /><button disabled={props.loading}><KeyRound size={16} /> Entrar</button></form>}{props.mode === "register" && <form className="login-form register-form" onSubmit={(event) => { event.preventDefault(); props.onRegister({ email, full_name: fullName, password, role: props.role }); }}><input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nome completo" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimo 8 caracteres" /><select value={props.role === "admin" ? "patient" : props.role} onChange={(event) => props.setRole(event.target.value as Role)}><option value="patient">Paciente</option><option value="doctor">Medico</option><option value="hospital">Hospital</option></select><button disabled={props.loading}><UserPlus size={16} /> Criar conta</button></form>}{props.mode === "oauth" && <div className="oauth-grid">{props.providers.length ? props.providers.map((provider) => <button key={provider.provider} disabled={!provider.configured} onClick={() => props.onOauth(provider.provider)}>{provider.display_name}{!provider.configured ? " indisponivel" : ""}</button>) : <p className="empty-state">Nenhum provedor social disponível neste momento.</p>}</div>}{props.mode === "forgot" && <form className="login-form" onSubmit={(event) => { event.preventDefault(); props.onForgot(email); }}><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" /><button disabled={props.loading}>Enviar recuperacao</button></form>}</div></section>;
}

function Overview({ role, authenticated, demoMode, modules, appointments, todayAppointments, pending, active, completed, patients, doctors, hospitals, revenue }: { role: Role; authenticated: boolean; demoMode: boolean; modules: ModuleSpec[]; appointments: Appointment[]; todayAppointments: Appointment[]; pending: number; active: number; completed: number; patients: number; doctors: number; hospitals: number; revenue: string | number }) { return <><section className="metric-grid"><Metric label="Consultas hoje" value={todayAppointments.length} hint={authenticated ? "Actualizadas" : "Entre para ver"} icon={CalendarDays} /><Metric label="Pendentes" value={pending} hint="Aguardam confirmacao" icon={BadgeCheck} /><Metric label="Cadastros" value={role === "patient" ? doctors + hospitals : patients + doctors + hospitals} hint={role === "patient" ? doctors + " medicos · " + hospitals + " hospitais" : patients + " pacientes · " + doctors + " medicos · " + hospitals + " hospitais"} icon={HeartPulse} /><Metric label="Receita" value={formatMoney(revenue)} hint="Pagamentos concluidos" icon={CreditCard} /></section>{!authenticated && !demoMode && <Panel title="Dados reais protegidos"><p className="empty-state">Entre com uma conta real ou ative o modo demonstração em Configurações para explorar os módulos.</p></Panel>}<section className="content-grid"><Panel title={`Módulos para ${roleLabel(role)}`}><div className="module-grid">{modules.map((module) => { const Icon = module.icon; return <article className="module-card" key={module.view}><Icon size={18} /><strong>{module.label}</strong><span>{module.summary}</span><small>{module.access.includes("patient") ? "Disponível no fluxo do paciente" : "Área operacional"}</small></article>; })}</div></Panel><Panel title="Fila clinica"><div className="queue-grid"><QueueItem value={pending} label="Por confirmar" /><QueueItem value={active} label="Em atendimento" /><QueueItem value={completed} label="Concluidas" /></div></Panel></section>{appointments.length > 0 && <Panel title="Agenda imediata"><Timeline items={todayAppointments.length ? todayAppointments : appointments.slice(0, 4)} render={(item) => <><strong>{formatDate(item.scheduled_start)} · {item.patient_full_name || item.patient_id}</strong><span>{item.doctor_full_name || item.doctor_id} · {item.doctor_specialty || "Especialidade"}</span><StatusPill value={item.status} /></>} /></Panel>}</>; }

function AuthModule({ providers }: { providers: { provider: string; display_name: string; configured: boolean }[] }) { return <Panel title="Formas de acesso"><div className="module-grid"><article className="module-card"><KeyRound size={18} /><strong>Email e palavra-passe</strong><span>Entrar com a conta Wutomi e manter a sessão segura.</span></article>{providers.map((provider) => <article className="module-card" key={provider.provider}><ShieldCheck size={18} /><strong>{provider.display_name}</strong><span>{provider.configured ? "Disponível" : "Indisponível"}</span></article>)}</div></Panel>; }
function AppointmentsView({ appointments, onAction }: { appointments: Appointment[]; onAction: (id: string, action: "confirm" | "check-in" | "complete") => void }) { const [status, setStatus] = useState(""); const filtered = appointments.filter((item) => !status || item.status === status); return <Panel title="Consultas" action={<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos estados</option><option value="pending">Pendente</option><option value="confirmed">Confirmada</option><option value="in_progress">Em consulta</option><option value="completed">Concluida</option><option value="cancelled">Cancelada</option></select>}><div className="table-wrap"><table><thead><tr><th>Hora</th><th>Paciente</th><th>Medico</th><th>Especialidade</th><th>Estado</th><th>Acoes</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>{formatDate(item.scheduled_start)}</td><td>{item.patient_full_name || item.patient_id}</td><td>{item.doctor_full_name || item.doctor_id}</td><td>{item.doctor_specialty || "-"}</td><td><StatusPill value={item.status} /></td><td><div className="row-actions"><button onClick={() => onAction(item.id, "confirm")}>Confirmar</button><button onClick={() => onAction(item.id, "check-in")}>Check-in</button><button onClick={() => onAction(item.id, "complete")}>Concluir</button></div></td></tr>)}</tbody></table>{!filtered.length && <p className="empty-state">Sem consultas para esta sessão.</p>}</div></Panel>; }
function BookingView({ hospitals, patients, disabled, demoMode, onSubmit }: { hospitals: HospitalType[]; patients: Patient[]; disabled: boolean; demoMode: boolean; onSubmit: (body: unknown) => void }) {
  const [hospitalId, setHospitalId] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [doctorId, setDoctorId] = useState("");
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
  }, [specialtyId]);

  useEffect(() => {
    if (!doctorId && doctors.length) setDoctorId(doctors[0].id);
  }, [doctorId, doctors]);

  const selectedHospital = hospitals.find((item) => item.id === hospitalId);
  const selectedSpecialty = specialties.find((item) => item.id === specialtyId);
  const selectedDoctor = doctors.find((item) => item.id === doctorId);
  const canBook = Boolean(!disabled && patient?.id && hospitalId && specialtyId && doctorId);

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
              {doctors.map((item) => <option key={item.id} value={item.id}>{doctorName(item)} · {formatMoney(item.consultation_fee, item.currency || "MZN")}</option>)}
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
            <p className="helper-text">Escolha uma data e hora. A consulta ficará pendente até confirmação do médico.</p>
          </div>
          <label>Início<input required name="scheduledStart" type="datetime-local" /></label>
          <label>Fim<input required name="scheduledEnd" type="datetime-local" /></label>
          <label>Motivo<textarea name="reason" rows={3} placeholder="Descreva brevemente o motivo da consulta" /></label>
          {!patient && <p className="empty-state">Complete o seu perfil de paciente antes de marcar consulta.</p>}
          <button disabled={!canBook}>{canBook ? "Solicitar marcação" : "Seleccione as opções"}</button>
        </form>
      </div>
    </Panel>
  </section>;
}

function FlowStep({ number, label, active }: { number: number; label: string; active: boolean }) {
  return <div className={`flow-step ${active ? "active" : ""}`}><span>{number}</span><strong>{label}</strong></div>;
}

function ProfileView({ user, role, disabled, onSubmit }: { user?: CurrentUser; role: Role; disabled: boolean; onSubmit: (payload: unknown) => void }) { return <section className="content-grid"><Panel title="Dados pessoais"><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit(Object.fromEntries(data.entries())); }}><label>Nome<input name="full_name" defaultValue={user?.full_name || ""} /></label><label>Email<input name="email" type="email" defaultValue={user?.email || ""} /></label><label>Telefone<input name="phone" defaultValue={user?.phone || ""} /></label><label>Genero<input name="gender" defaultValue={user?.gender || ""} /></label><label>Documento<input name="document_type" defaultValue={user?.document_type || "BI"} /></label><label>Numero<input name="document_number" defaultValue={user?.document_number || ""} /></label><label className="wide">Endereco<input name="address" defaultValue={user?.address || ""} /></label><label>Locale<input name="locale" defaultValue={user?.locale || "pt-MZ"} /></label><label>Timezone<input name="timezone" defaultValue={user?.timezone || "Africa/Maputo"} /></label><label>Tipo<input disabled value={roleLabel(role)} /></label><button disabled={disabled}>{disabled ? "Entre para editar" : "Guardar perfil"}</button></form></Panel><Panel title="Perfil operacional"><div className="timeline"><article className="timeline-item"><strong>Paciente</strong><span>Complete dados clinicos no modulo Pacientes.</span></article><article className="timeline-item"><strong>Medico</strong><span>Crie perfil medico, especialidades, disponibilidade e carteira.</span></article><article className="timeline-item"><strong>Hospital</strong><span>Associe equipa, medicos, pacientes e agenda.</span></article></div></Panel></section>; }
function RecordsView({ records, patients, doctors, appointments, disabled, onCreate }: { records: MedicalRecord[]; patients: Patient[]; doctors: Doctor[]; appointments: Appointment[]; disabled: boolean; onCreate: (payload: unknown) => void }) { return <section className="content-grid"><Panel title="Prontuarios"><Timeline items={records} render={(item) => <><strong>{item.patient_full_name || item.patient_id}</strong><span>{item.chief_complaint || "Sem queixa"} · {item.assessment || "Sem avaliacao"}</span><span>{formatDate(item.created_at)}</span></>} /></Panel><Panel title="Novo registo clinico"><form className="stacked-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onCreate(Object.fromEntries(data.entries())); }}><SelectField name="patient_id" label="Paciente" items={patients.map((item) => ({ value: item.id, label: personName(item) }))} /><SelectField name="doctor_id" label="Medico" items={doctors.map((item) => ({ value: item.id, label: doctorName(item) }))} /><SelectField name="appointment_id" label="Consulta" items={appointments.map((item) => ({ value: item.id, label: `${formatDate(item.scheduled_start)} · ${item.patient_full_name || item.patient_id}` }))} /><textarea name="chief_complaint" rows={2} placeholder="Queixa principal" /><textarea name="assessment" rows={2} placeholder="Avaliacao" /><textarea name="plan" rows={2} placeholder="Plano" /><button disabled={disabled}>{disabled ? "Entre para criar" : "Criar prontuario"}</button></form></Panel></section>; }
function NotificationsView({ notifications, preferences, onPreference }: { notifications: { id: string; channel: string; subject?: string | null; body: string; status: string; created_at: string }[]; preferences: { channel: string; enabled: boolean }[]; onPreference: (payload: { channel: string; enabled: boolean }) => void }) { return <section className="content-grid"><Panel title="Notificacoes"><Timeline items={notifications} render={(item) => <><strong>{item.subject || item.channel}</strong><span>{item.body}</span><StatusPill value={item.status} /></>} /></Panel><Panel title="Preferencias"><PreferenceList preferences={preferences} onPreference={onPreference} /></Panel></section>; }
function WalletView({ wallet, transactions, disabled, onTopUp }: { wallet: { balance: string | number; currency: string }; transactions: { id: number; amount: string | number; direction: string; description?: string | null; transaction_type?: string; created_at: string }[]; disabled: boolean; onTopUp: (payload: unknown) => void }) { return <section className="content-grid"><Panel title="Carteira"><div className="wallet-card"><span>Saldo disponivel</span><strong>{formatMoney(wallet.balance, wallet.currency)}</strong></div><form className="stacked-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onTopUp({ amount: data.get("amount"), provider: data.get("provider"), phone_number: data.get("phone") }); }}><input required name="amount" type="number" min="1" step="0.01" placeholder="Valor" /><select name="provider"><option value="mpesa">M-Pesa</option><option value="mkesh">mKesh</option><option value="emola">e-Mola</option></select><input required name="phone" placeholder="841234567" /><button disabled={disabled}>{disabled ? "Entre para carregar" : "Carregar carteira"}</button></form></Panel><Panel title="Movimentos"><Timeline items={transactions} render={(item) => <><strong>{item.direction === "credit" ? "+" : "-"} {formatMoney(item.amount)}</strong><span>{item.description || item.transaction_type || "Movimento"} · {formatDate(item.created_at)}</span></>} /></Panel></section>; }
function HospitalsView({ hospitals }: { hospitals: HospitalType[] }) { return <PeopleView title="Hospitais" search="" onSearch={() => undefined} items={hospitals} render={(item) => <article className="person-card"><div><h3>{item.name}</h3><p>{[item.city, item.province, item.country].filter(Boolean).join(" · ") || "Localizacao por definir"}</p></div><div className="badge-row"><span className="badge">{item.is_active === false ? "Inativo" : "Ativo"}</span><span className="badge">{item.id}</span></div></article>} />; }
function SpecialtiesView({ specialties }: { specialties: Specialty[] }) { return <PeopleView title="Especialidades" search="" onSearch={() => undefined} items={specialties} render={(item) => <article className="person-card"><div><h3>{item.name}</h3><p>{item.description || item.details || "Descrição em revisão clínica."}</p></div></article>} />; }
function SettingsView({ demoMode, setDemoMode, preferences, onPreference }: { demoMode: boolean; setDemoMode: (value: boolean) => void; preferences: { channel: string; enabled: boolean }[]; onPreference: (payload: { channel: string; enabled: boolean }) => void }) { return <section className="content-grid"><Panel title="Aplicacao"><div className="settings-list"><div><strong>Ligação</strong><span>Serviço Wutomi</span></div><label className="toggle-row"><span>Modo demonstracao</span><input type="checkbox" checked={demoMode} onChange={(event) => setDemoMode(event.target.checked)} /></label><div><strong>Locale</strong><span>pt-MZ</span></div><div><strong>Timezone</strong><span>Africa/Maputo</span></div></div></Panel><Panel title="Canais"><PreferenceList preferences={preferences} onPreference={onPreference} /></Panel></section>; }
function PreferenceList({ preferences, onPreference }: { preferences: { channel: string; enabled: boolean }[]; onPreference: (payload: { channel: string; enabled: boolean }) => void }) { if (!preferences.length) return <p className="empty-state">Sem preferencias carregadas para esta sessao.</p>; return <div className="settings-list">{preferences.map((item) => <label key={item.channel} className="toggle-row"><span>{item.channel}</span><input type="checkbox" checked={item.enabled} onChange={(event) => onPreference({ channel: item.channel, enabled: event.target.checked })} /></label>)}</div>; }
function AdminView({ summary }: { summary: Record<string, string | number | undefined> }) { const metrics = [["Utilizadores", summary.total_users], ["Medicos ativos", summary.active_doctors], ["Pacientes", summary.total_patients], ["Consultas", summary.total_appointments], ["Pendentes", summary.pending_appointments], ["Receita", formatMoney(summary.total_revenue)]]; return <section className="content-grid"><Panel title="Indicadores admin"><div className="admin-grid">{metrics.map(([label, value]) => <div key={label}><strong>{value || 0}</strong><span>{label}</span></div>)}</div></Panel><Panel title="Governanca"><div className="timeline-item"><strong>Auditoria, aprovacoes e catalogo clinico</strong><span>Área ligada à governação da plataforma e segurança operacional.</span></div></Panel></section>; }
function PeopleView<T>({ title, search, onSearch, items, render }: { title: string; search: string; onSearch: (value: string) => void; items: T[]; render: (item: T) => React.ReactNode }) { return <Panel title={title} action={<div className="search-box"><Search size={17} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Pesquisar" /></div>}><div className="card-grid">{items.map((item, index) => <div key={index}>{render(item)}</div>)}</div>{!items.length && <p className="empty-state">Sem dados para esta sessão.</p>}</Panel>; }
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
