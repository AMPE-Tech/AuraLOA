import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Users, UserPlus, Trash2, KeyRound, LogOut,
  ChevronRight, Check, X, Pencil, RefreshCw, Scale,
  Lock, Unlock, AlertCircle, Info, Clock, CalendarDays,
  TrendingUp, Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function authHeaders() {
  const token = localStorage.getItem("aura_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

interface UserRow {
  email: string;
  name: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
  expiresAt?: string;
  lastLoginAt?: string;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

function toInputDate(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
}

function expiryStatus(expiresAt?: string): "never" | "expired" | "soon" | "ok" {
  if (!expiresAt) return "never";
  const exp = new Date(expiresAt);
  const now = new Date();
  if (exp < now) return "expired";
  const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) return "soon";
  return "ok";
}

function ExpiryBadge({ expiresAt }: { expiresAt?: string }) {
  const status = expiryStatus(expiresAt);
  if (status === "never") return <span className="text-xs text-white/30">Sem validade</span>;
  if (status === "expired") return (
    <span className="inline-flex items-center gap-1 text-xs text-red-400 font-medium">
      <X className="w-3 h-3" /> Expirado {formatDate(expiresAt)}
    </span>
  );
  if (status === "soon") return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
      <Clock className="w-3 h-3" /> Expira {formatDate(expiresAt)}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
      <CalendarDays className="w-3 h-3" /> Até {formatDate(expiresAt)}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return role === "admin" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25">
      <Shield className="w-3 h-3" /> Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/20">
      <Users className="w-3 h-3" /> Usuário
    </span>
  );
}

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const myEmail = localStorage.getItem("aura_email") || "";

  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [newExpires, setNewExpires] = useState("");

  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editPass, setEditPass] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");
  const [editExpires, setEditExpires] = useState("");

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { headers: authHeaders() });
      if (!res.ok) throw new Error("Sem permissão");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const addUser = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          email: newEmail, name: newName, password: newPass, role: newRole,
          expiresAt: newExpires ? new Date(newExpires).toISOString() : undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Usuário criado", description: `${newEmail} adicionado com sucesso.` });
      setShowAdd(false);
      setNewEmail(""); setNewName(""); setNewPass(""); setNewRole("user"); setNewExpires("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateUser = useMutation({
    mutationFn: async (payload: { email: string; role?: string; active?: boolean; password?: string; expiresAt?: string | null }) => {
      const { email, ...body } = payload;
      const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Usuário atualizado" });
      setEditTarget(null); setEditPass(""); setEditExpires("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (_d, email) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Usuário removido", description: email });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function handleLogout() {
    localStorage.removeItem("aura_token");
    localStorage.removeItem("aura_email");
    localStorage.removeItem("aura_role");
    setLocation("/login");
  }

  function openEdit(u: UserRow) {
    setEditTarget(u);
    setEditRole(u.role);
    setEditPass("");
    setEditExpires(toInputDate(u.expiresAt));
  }

  const now = new Date();
  const expired = users.filter(u => u.expiresAt && new Date(u.expiresAt) < now);
  const expiringSoon = users.filter(u => {
    if (!u.expiresAt) return false;
    const d = new Date(u.expiresAt);
    return d >= now && (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 7;
  });
  const withLogin = users.filter(u => u.lastLoginAt);
  const newestUser = [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return (
    <div className="min-h-screen bg-[hsl(225_10%_6%)] text-white">
      <header className="border-b border-white/[0.07] bg-[hsl(225_10%_6%)/80] backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ background: "linear-gradient(135deg, #06b6d4, #7c3aed)" }}
            >
              <Scale className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight">AuraLOA</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-sm text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-violet-400" /> Administração
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocation("/dashboard")}
              className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
              data-testid="button-back-dashboard"
            >
              ← Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/5"
              data-testid="button-logout-admin"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administração</h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie usuários e configurações da plataforma AuraLOA</p>
        </div>

        {/* KPI cards — linha 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total de usuários", value: String(users.length), icon: Users, color: "blue", sub: `${users.filter(u => u.active).length} ativos` },
            { label: "Administradores", value: String(users.filter(u => u.role === "admin").length), icon: Shield, color: "violet", sub: `${users.filter(u => u.role === "user").length} usuários padrão` },
            { label: "Com acesso expirado", value: String(expired.length), icon: X, color: expired.length > 0 ? "red" : "slate", sub: `${expiringSoon.length} expiram em 7 dias` },
            { label: "Acessaram a plataforma", value: String(withLogin.length), icon: Activity, color: "emerald", sub: newestUser ? `Último cadastro: ${formatDate(newestUser.createdAt)}` : "Nenhum cadastro ainda" },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className={`rounded-xl border bg-[hsl(222_9%_9%)] p-4 border-${color}-500/15`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 text-${color}-400`} />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
              <p className="text-2xl font-bold tracking-tight" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
              <p className="text-xs text-slate-600 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Alertas */}
        {(expired.length > 0 || expiringSoon.length > 0) && (
          <div className="space-y-2">
            {expired.length > 0 && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/[0.06] border border-red-500/20 text-xs text-red-300/90">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                <p>
                  <strong>{expired.length} usuário{expired.length > 1 ? "s" : ""} com acesso expirado:</strong>{" "}
                  {expired.map(u => u.name).join(", ")}. Renove ou desative essas contas.
                </p>
              </div>
            )}
            {expiringSoon.length > 0 && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-xs text-amber-300/80">
                <Clock className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                <p>
                  <strong>{expiringSoon.length} usuário{expiringSoon.length > 1 ? "s" : ""} com acesso expirando em até 7 dias:</strong>{" "}
                  {expiringSoon.map(u => `${u.name} (${formatDate(u.expiresAt)})`).join(", ")}.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Users section */}
        <div className="rounded-2xl border border-white/[0.07] bg-[hsl(222_9%_9%)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h2 className="font-semibold text-sm">Usuários</h2>
              <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 text-xs font-mono">{users.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/users"] })}
                className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                title="Atualizar"
                data-testid="button-refresh-users"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowAdd(!showAdd)}
                className="flex items-center gap-1.5 text-xs bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors"
                data-testid="button-add-user"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Novo usuário
              </button>
            </div>
          </div>

          {/* Add user form */}
          {showAdd && (
            <div className="px-6 py-4 border-b border-white/[0.06] bg-blue-500/[0.03]">
              <p className="text-xs font-medium text-blue-300 mb-3 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> Novo usuário
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Email *</label>
                  <input
                    type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    placeholder="usuario@email.com"
                    className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    data-testid="input-new-email"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nome *</label>
                  <input
                    type="text" value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    data-testid="input-new-name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Senha *</label>
                  <input
                    type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    data-testid="input-new-password"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Perfil</label>
                  <select
                    value={newRole} onChange={e => setNewRole(e.target.value as "user" | "admin")}
                    className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    data-testid="select-new-role"
                  >
                    <option value="user">Usuário</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> Data de validade do acesso
                    <span className="text-slate-600">(opcional)</span>
                  </label>
                  <input
                    type="date" value={newExpires} onChange={e => setNewExpires(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    data-testid="input-new-expires"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => addUser.mutate()}
                  disabled={!newEmail || !newName || newPass.length < 6 || addUser.isPending}
                  className="flex items-center gap-1.5 text-xs bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                  data-testid="button-confirm-add-user"
                >
                  {addUser.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Criar usuário
                </button>
                <button
                  onClick={() => { setShowAdd(false); setNewEmail(""); setNewName(""); setNewPass(""); setNewExpires(""); }}
                  className="text-xs text-slate-500 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
                  data-testid="button-cancel-add-user"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Users table */}
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-10 text-center text-slate-600 text-sm">Nenhum usuário cadastrado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th className="text-left text-xs text-slate-500 font-medium px-6 py-3">Usuário</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Perfil</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Status</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Validade</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Último acesso</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Cadastro</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-6 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {users.map((u) => {
                    const expStatus = expiryStatus(u.expiresAt);
                    return (
                      <tr
                        key={u.email}
                        className={`hover:bg-white/[0.02] transition-colors group ${expStatus === "expired" ? "bg-red-500/[0.03]" : expStatus === "soon" ? "bg-amber-500/[0.03]" : ""}`}
                        data-testid={`row-user-${u.email}`}
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-white/70">{u.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="font-medium text-white text-sm">{u.name}</p>
                              <p className="text-xs text-slate-500 font-mono">{u.email}</p>
                            </div>
                            {u.email === myEmail && (
                              <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded-md">você</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><RoleBadge role={u.role} /></td>
                        <td className="px-4 py-3.5">
                          {u.active ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" /> Inativo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5"><ExpiryBadge expiresAt={u.expiresAt} /></td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">{formatDateTime(u.lastLoginAt)}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">{formatDate(u.createdAt)}</td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {u.email !== myEmail && (
                              <button
                                onClick={() => updateUser.mutate({ email: u.email, active: !u.active })}
                                title={u.active ? "Desativar" : "Ativar"}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                data-testid={`button-toggle-active-${u.email}`}
                              >
                                {u.active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(u)}
                              title="Editar"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                              data-testid={`button-edit-${u.email}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {u.email !== myEmail && (
                              <button
                                onClick={() => { if (confirm(`Remover ${u.email}?`)) deleteUser.mutate(u.email); }}
                                title="Remover"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                data-testid={`button-delete-${u.email}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Platform info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/[0.07] bg-[hsl(222_9%_9%)] overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/[0.06]">
              <Info className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-sm">Informações da Plataforma</h2>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {[
                { label: "Plataforma", value: "AuraLOA" },
                { label: "Módulo", value: "Pesquisa de Precatórios na LOA" },
                { label: "Versão", value: "1.0.0" },
                { label: "Autenticação", value: "HMAC-SHA256" },
                { label: "Evidências", value: "SHA-256 por consulta" },
                { label: "Validade automática", value: "Sim — bloqueio no login" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                  <p className="font-medium text-white text-sm">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-[hsl(222_9%_9%)] overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/[0.06]">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-sm">Resumo de Acessos</h2>
            </div>
            <div className="px-6 py-5 space-y-3 text-sm">
              {users.length === 0 ? (
                <p className="text-slate-600 text-xs">Nenhum usuário cadastrado.</p>
              ) : (
                users
                  .slice()
                  .sort((a, b) => (b.lastLoginAt || "").localeCompare(a.lastLoginAt || ""))
                  .map(u => (
                    <div key={u.email} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-semibold text-white/60">{u.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-600 truncate">{u.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-400">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca acessou"}</p>
                        <ExpiryBadge expiresAt={u.expiresAt} />
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-xs text-amber-300/80">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
          <p>
            Usuários são armazenados em memória — alterações são perdidas ao reiniciar o servidor.
            Para persistência, conecte um banco de dados. Datas de validade são verificadas automaticamente no login.
          </p>
        </div>

      </main>

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[hsl(222_9%_9%)] rounded-2xl border border-white/[0.1] shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-400" />
                Editar usuário
              </h3>
              <button
                onClick={() => setEditTarget(null)}
                className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Email</p>
                <p className="text-sm font-mono text-white bg-slate-800 rounded-lg px-3 py-2">{editTarget.email}</p>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Perfil</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as "user" | "admin")}
                  disabled={editTarget.email === myEmail}
                  className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  data-testid="select-edit-role"
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Admin</option>
                </select>
                {editTarget.email === myEmail && (
                  <p className="text-xs text-slate-600 mt-1">Não é possível alterar o próprio perfil.</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> Data de validade do acesso
                  <span className="text-slate-600">(deixe vazio para sem limite)</span>
                </label>
                <input
                  type="date"
                  value={editExpires}
                  onChange={e => setEditExpires(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  data-testid="input-edit-expires"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nova senha <span className="text-slate-600">(deixe em branco para manter)</span></label>
                <input
                  type="password"
                  value={editPass}
                  onChange={e => setEditPass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                  data-testid="input-edit-password"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setEditTarget(null)}
                className="text-sm text-slate-500 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => updateUser.mutate({
                  email: editTarget.email,
                  role: editRole,
                  password: editPass.length >= 6 ? editPass : undefined,
                  expiresAt: editExpires ? new Date(editExpires + "T23:59:59").toISOString() : null,
                })}
                disabled={updateUser.isPending}
                className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-colors"
                data-testid="button-confirm-edit-user"
              >
                {updateUser.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
