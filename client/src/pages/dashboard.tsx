import { useState, useEffect } from "react";
import {
  PrecatorioDashboard, FunilEtapa, GraficoMensal,
  GraficoTribunal, GraficoStatus, FUNIL_ETAPAS, STATUS_LABELS,
  StatusPrecatorio, calcularKPIs, formatarValor
} from "../types/dashboard";
import { KPICards } from "../components/dashboard/KPICards";
import { GraficosDashboard } from "../components/dashboard/GraficosDashboard";
import {
  FileSearch, TrendingUp, LayoutDashboard,
  FileText, Settings, LogOut, Scale,
  User, Camera, Zap, CreditCard, ChevronUp, X,
  Bell, RefreshCw
} from "lucide-react";
import { useLocation } from "wouter";

const STATUS_COLOR_MAP: Record<StatusPrecatorio, string> = {
  pesquisado:           "#cbd5e1",
  aprovado:             "#34d399",
  verificar:            "#fbbf24",
  suspeito:             "#f87171",
  proposta_enviada:     "#22d3ee",
  aguardando_vendedor:  "#fb923c",
  aguardando_comprador: "#fdba74",
  analise_interna:      "#a78bfa",
  fechado:              "#2dd4bf",
  cancelado:            "#6b7280",
};

function gerarDadosExemplo(): PrecatorioDashboard[] {
  const tribunais = ["TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6", "TJSP"];
  const status: StatusPrecatorio[] = [
    "aprovado", "aprovado", "aprovado", "verificar", "suspeito",
    "proposta_enviada", "aguardando_vendedor", "aguardando_comprador",
    "analise_interna", "fechado"
  ];
  return Array.from({ length: 24 }, (_, i) => ({
    id: `prec-${i + 1}`,
    numero_cnj: `000${String(i + 1).padStart(4, "0")}-${12 + i % 5}.2021.4.0${(i % 6) + 1}.0001`,
    tribunal: tribunais[i % tribunais.length],
    valor_face: 80000 + Math.random() * 1500000,
    valor_negociado: 60000 + Math.random() * 1200000,
    status: status[i % status.length],
    data_consulta: new Date(2026, Math.floor(i / 4), (i % 28) + 1).toISOString(),
    data_atualizacao: new Date(2026, Math.floor(i / 4) + 1, (i % 28) + 1).toISOString(),
    score_autenticidade: 50 + Math.floor(Math.random() * 50),
    tipo: i % 5 === 0 ? "RPV" : "PRECATORIO",
    credor_nome: `Credor ${i + 1}`,
    proposta_comercial: ["proposta_enviada", "aguardando_vendedor", "aguardando_comprador", "fechado"].includes(status[i % status.length]),
    negocio_fechado: status[i % status.length] === "fechado",
  }));
}

function prepararGraficoMensal(precatorios: PrecatorioDashboard[]): GraficoMensal[] {
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return meses.map((mes, idx) => {
    const doMes = precatorios.filter(p => new Date(p.data_consulta).getMonth() === idx);
    return {
      mes,
      pesquisado: doMes.length,
      aprovado: doMes.filter(p => (p.score_autenticidade ?? 0) >= 80).length,
      fechado: doMes.filter(p => p.status === "fechado").length,
      valor_pesquisado: doMes.reduce((a, p) => a + (p.valor_face ?? 0), 0),
      valor_fechado: doMes.filter(p => p.status === "fechado").reduce((a, p) => a + (p.valor_negociado ?? 0), 0),
    };
  });
}

function prepararGraficoTribunal(precatorios: PrecatorioDashboard[]): GraficoTribunal[] {
  const map = new Map<string, { quantidade: number; valor_total: number }>();
  precatorios.forEach(p => {
    const atual = map.get(p.tribunal) ?? { quantidade: 0, valor_total: 0 };
    map.set(p.tribunal, { quantidade: atual.quantidade + 1, valor_total: atual.valor_total + (p.valor_face ?? 0) });
  });
  return Array.from(map.entries())
    .map(([tribunal, dados]) => ({ tribunal, ...dados }))
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 7);
}

function prepararGraficoStatus(precatorios: PrecatorioDashboard[]): GraficoStatus[] {
  const aprovado = precatorios.filter(p => (p.score_autenticidade ?? 0) >= 80).length;
  const verificar = precatorios.filter(p => (p.score_autenticidade ?? 0) >= 50 && (p.score_autenticidade ?? 0) < 80).length;
  const suspeito = precatorios.filter(p => (p.score_autenticidade ?? 0) < 50).length;
  return [
    { name: "Aprovado", value: aprovado, color: "rgba(16,185,129,1)" },
    { name: "Verificar", value: verificar, color: "rgba(16,185,129,0.55)" },
    { name: "Suspeito", value: suspeito, color: "rgba(16,185,129,0.25)" },
  ].filter(d => d.value > 0);
}

function prepararFunil(precatorios: PrecatorioDashboard[]): FunilEtapa[] {
  return FUNIL_ETAPAS.map(etapa => ({
    ...etapa,
    quantidade: precatorios.filter(p => p.status === etapa.id).length,
    valor_total: precatorios.filter(p => p.status === etapa.id).reduce((a, p) => a + (p.valor_face ?? 0), 0),
  }));
}

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", active: true, rota: "/dashboard" },
  { icon: FileSearch, label: "Precatórios", active: false, rota: "/pendentes" },
  { icon: FileText, label: "Relatórios", active: false, rota: "/loa" },
  { icon: TrendingUp, label: "Análises", active: false, rota: "/sp" },
  { icon: Settings, label: "Configurações", active: false, rota: "/admin" },
];

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const [precatorios, setPrecatorios] = useState<PrecatorioDashboard[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<StatusPrecatorio | "todos">("todos");
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [precatorioSelecionado, setPrecatorioSelecionado] = useState<PrecatorioDashboard | null>(null);
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false);
  const [sidebarRecolhido, setSidebarRecolhido] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [usuarioInfo, setUsuarioInfo] = useState({
    nome: localStorage.getItem("aura_name") ?? "Usuário",
    email: localStorage.getItem("aura_email") ?? "",
    plano: localStorage.getItem("aura_plan") ?? "Free",
    consultasUsadas: parseInt(localStorage.getItem("aura_consultas_usadas") ?? "0"),
    consultasTotal: parseInt(localStorage.getItem("aura_consultas_total") ?? "10"),
    avatarLetra: (localStorage.getItem("aura_name") ?? "U").charAt(0).toUpperCase(),
  });

  const pctUso = Math.round((usuarioInfo.consultasUsadas / usuarioInfo.consultasTotal) * 100);
  const corUso = pctUso >= 90 ? "#ef4444" : pctUso >= 70 ? "#f59e0b" : "#10b981";

  useEffect(() => {
    // Fetch user info from API to get updated name/email
    const token = localStorage.getItem("aura_token");
    if (token) {
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setUsuarioInfo(prev => ({
              ...prev,
              nome: data.name ?? prev.nome,
              email: data.email ?? prev.email,
              avatarLetra: (data.name ?? prev.nome).charAt(0).toUpperCase(),
            }));
          }
        })
        .catch(() => {/* mantém valores do localStorage */});
    }

    // TODO: substituir por chamada real à API quando endpoint /api/dashboard/precatorios estiver disponível
    setTimeout(() => {
      setPrecatorios(gerarDadosExemplo());
      setCarregando(false);
    }, 600);
  }, []);

  const filtrados = precatorios.filter(p => {
    const statusOk = filtroStatus === "todos" || p.status === filtroStatus;
    const buscaOk = busca === "" ||
      p.numero_cnj.toLowerCase().includes(busca.toLowerCase()) ||
      (p.credor_nome ?? "").toLowerCase().includes(busca.toLowerCase()) ||
      p.tribunal.toLowerCase().includes(busca.toLowerCase());
    return statusOk && buscaOk;
  });
  const kpis = calcularKPIs(precatorios);
  const graficoMensal = prepararGraficoMensal(precatorios);
  const graficoTribunal = prepararGraficoTribunal(precatorios);
  const graficoStatus = prepararGraficoStatus(precatorios);
  const funil = prepararFunil(precatorios);

  // Design tokens canônicos do AuraLOA (sempre dark)
  const bg       = "#0d1117";
  const surface  = "#162032";
  const surface2 = "#1a2840";
  const border   = "rgba(255,255,255,0.07)";
  const text     = "#e2e8f0";
  const textMuted = "rgba(255,255,255,0.38)";

  const statusFiltros: { id: StatusPrecatorio | "todos"; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "aprovado", label: "Aprovados" },
    { id: "proposta_enviada", label: "Proposta" },
    { id: "aguardando_vendedor", label: "Aguard. Vendedor" },
    { id: "aguardando_comprador", label: "Aguard. Comprador" },
    { id: "analise_interna", label: "Análise" },
    { id: "fechado", label: "Fechados" },
    { id: "suspeito", label: "Suspeitos" },
  ];

  if (carregando) {
    return (
      <div style={{ background: "#0d1117", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #22d3ee", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 13 }}>Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const paginaAtiva = SIDEBAR_ITEMS.find(i => i.active)?.label ?? "Dashboard";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } *:focus-visible { outline: 2px solid #22d3ee; outline-offset: 2px; border-radius: 4px; }`}</style>

      {/* Sidebar */}
      <aside style={{
        width: sidebarRecolhido ? 56 : 220,
        minWidth: sidebarRecolhido ? 56 : 220,
        background: surface, borderRight: `1px solid ${border}`,
        display: "flex", flexDirection: "column", flexShrink: 0,
        position: "relative", overflow: "hidden",
        transition: "width 0.25s ease, min-width 0.25s ease"
      }}>

        {/* Topo — Logo */}
        <div style={{ padding: sidebarRecolhido ? "18px 11px 14px" : "18px 16px 14px", borderBottom: `1px solid ${border}`, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #22d3ee, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Scale size={17} color="white" />
            </div>
            {!sidebarRecolhido && (
              <div>
                <div style={{ color: text, fontWeight: 700, fontSize: 13, letterSpacing: "-0.01em" }}>AuraLOA</div>
                <div style={{ color: textMuted, fontSize: 11 }}>Análise de Precatórios</div>
              </div>
            )}
          </div>
        </div>

        {/* Navegação */}
        <nav aria-label="Menu principal" style={{ flex: 1, padding: sidebarRecolhido ? "12px 8px 0" : "12px 12px 0" }}>
          {SIDEBAR_ITEMS.map(item => (
            <div key={item.label} title={sidebarRecolhido ? item.label : undefined} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: sidebarRecolhido ? "10px 11px" : "9px 12px",
              borderRadius: 8, marginBottom: 2, cursor: "pointer",
              justifyContent: sidebarRecolhido ? "center" : "flex-start",
              background: item.active ? "linear-gradient(135deg, rgba(34,211,238,0.12), rgba(124,58,237,0.12))" : "transparent",
              borderLeft: item.active && !sidebarRecolhido ? "2px solid #22d3ee" : "2px solid transparent",
              transition: "all 0.2s"
            }}
              onClick={() => navigate(item.rota)}
              onMouseEnter={e => { if (!item.active) e.currentTarget.style.background = surface2; }}
              onMouseLeave={e => { if (!item.active) e.currentTarget.style.background = "transparent"; }}
            >
              <item.icon size={15} color={item.active ? "#22d3ee" : textMuted} style={{ flexShrink: 0 }} />
              {!sidebarRecolhido && (
                <span style={{ color: item.active ? text : textMuted, fontSize: 13, fontWeight: item.active ? 600 : 400 }}>{item.label}</span>
              )}
            </div>
          ))}
        </nav>

        {/* Perfil do usuário */}
        <div style={{ borderTop: `1px solid ${border}`, margin: "8px 0 0" }}>
          <div
            onClick={() => !sidebarRecolhido && setMenuUsuarioAberto(!menuUsuarioAberto)}
            title={sidebarRecolhido ? `${usuarioInfo.nome} — ${usuarioInfo.plano}` : undefined}
            aria-expanded={menuUsuarioAberto}
            aria-label="Menu do usuário"
            style={{
              padding: sidebarRecolhido ? "12px 11px" : "12px 16px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              justifyContent: sidebarRecolhido ? "center" : "flex-start",
              transition: "background 0.2s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = surface2; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #22d3ee, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{usuarioInfo.avatarLetra}</span>
            </div>
            {!sidebarRecolhido && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: text, fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{usuarioInfo.nome}</div>
                  <div style={{ color: "#22d3ee", fontSize: 11, fontWeight: 500 }}>{usuarioInfo.plano}</div>
                </div>
                <ChevronUp size={12} color={textMuted} style={{ transform: menuUsuarioAberto ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s ease" }} />
              </>
            )}
          </div>

          {/* Dropdown */}
          {menuUsuarioAberto && (
            <div style={{ background: surface2, borderTop: `1px solid ${border}`, overflow: "hidden" }}>
              {[
                { label: "Meu Perfil",    icon: User,       destaque: false },
                { label: "Alterar Foto",  icon: Camera,     destaque: false },
                { label: "Fazer Upgrade", icon: Zap,        destaque: true  },
                { label: "Assinatura",    icon: CreditCard, destaque: false },
              ].map(item => (
                <div key={item.label} style={{
                  padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  color: item.destaque ? "#22d3ee" : text, fontSize: 12, fontWeight: item.destaque ? 600 : 400,
                  transition: "background 0.15s"
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = surface2; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <item.icon size={13} />
                  {item.label}
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${border}` }}>
                <div style={{
                  padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  color: "#ef4444", fontSize: 12, transition: "background 0.15s"
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  onClick={() => {
                    localStorage.removeItem("aura_token");
                    localStorage.removeItem("aura_email");
                    localStorage.removeItem("aura_name");
                    localStorage.removeItem("aura_role");
                    localStorage.removeItem("aura_plan");
                    navigate("/");
                  }}
                >
                  <LogOut size={12} />
                  Sair
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé — Consultas (oculto quando recolhido) */}
        {!sidebarRecolhido && <div style={{ padding: "12px 16px 16px", borderTop: `1px solid ${border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <span style={{ color: textMuted, fontSize: 11, fontWeight: 600 }}>Consultas do mês</span>
            <span style={{ color: corUso, fontSize: 11, fontWeight: 700, fontVariant: "tabular-nums" }}>{usuarioInfo.consultasUsadas}/{usuarioInfo.consultasTotal}</span>
          </div>
          <div style={{ background: surface2, borderRadius: 6, height: 5, overflow: "hidden", marginBottom: 7 }}>
            <div style={{ width: `${pctUso}%`, height: "100%", background: `linear-gradient(90deg, ${corUso}, ${corUso}99)`, borderRadius: 6, transition: "width 0.5s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: textMuted, fontSize: 11 }}>{pctUso}% utilizado</span>
            <span style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(34,211,238,0.2)", cursor: "pointer", minHeight: 28, display: "inline-flex", alignItems: "center" }}>Upgrade</span>
          </div>
        </div>}

      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

        {/* Topbar */}
        <header style={{ background: surface, borderBottom: `1px solid ${border}`, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, height: 64, position: "relative" }}>

          {/* Botão collapse sidebar */}
          <button
            onClick={() => setSidebarRecolhido(!sidebarRecolhido)}
            title={sidebarRecolhido ? "Expandir menu" : "Recolher menu"}
            style={{
              position: "absolute", left: -12, top: "50%", transform: "translateY(-50%)",
              width: 24, height: 24, borderRadius: "50%",
              background: surface, border: `1px solid ${border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: textMuted, fontSize: 11, zIndex: 40,
              transition: "all 0.3s", boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            {sidebarRecolhido ? "›" : "‹"}
          </button>

          {/* Título da página */}
          <div>
            <h1 style={{ color: text, fontWeight: 700, fontSize: 18, margin: 0, letterSpacing: "-0.02em" }}>{paginaAtiva}</h1>
            <p style={{ color: textMuted, fontSize: 11, margin: "1px 0 0" }}>AuraLOA › {paginaAtiva}</p>
          </div>

          {/* Ações do topbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

            {/* Sino notificações */}
            <button
              aria-label="Notificações"
              title="Notificações"
              style={{
                background: "transparent", border: `1px solid ${border}`, borderRadius: 8,
                padding: "7px 10px", cursor: "pointer", color: textMuted, display: "flex", alignItems: "center",
                transition: "all 0.2s", minHeight: 34
              }}
              onMouseEnter={e => { e.currentTarget.style.background = surface2; (e.currentTarget as HTMLButtonElement).style.color = text; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = textMuted; }}
            >
              <Bell size={15} />
            </button>

            {/* Refresh */}
            <button
              aria-label="Atualizar dados"
              title="Atualizar dados"
              onClick={() => {
                setRefreshing(true);
                setTimeout(() => { setPrecatorios(gerarDadosExemplo()); setRefreshing(false); }, 800);
              }}
              disabled={refreshing}
              style={{
                background: "transparent", border: `1px solid ${border}`, borderRadius: 8,
                padding: "7px 10px", cursor: refreshing ? "default" : "pointer", color: refreshing ? "#22d3ee" : textMuted,
                display: "flex", alignItems: "center", transition: "all 0.2s", minHeight: 34,
                opacity: refreshing ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.background = surface2; (e.currentTarget as HTMLButtonElement).style.color = text; } }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = refreshing ? "#22d3ee" : textMuted; }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
            </button>

          </div>
        </header>

        {/* Conteúdo principal */}
        <main style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", flex: 1 }}>

          {/* KPI Cards — 7 métricas (4 volume + 3 valor) */}
          <KPICards kpis={kpis} />

          {/* Gráficos — 4 painéis (evolução, donut, tribunal, funil) */}
          <GraficosDashboard
            graficoMensal={graficoMensal}
            graficoTribunal={graficoTribunal}
            graficoStatus={graficoStatus}
            funil={funil}
          />

          {/* Tabela */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
            {/* Cabeçalho da tabela com busca + filtros */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ color: text, fontWeight: 600, fontSize: 14, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <FileSearch size={15} color="#22d3ee" />
                  Precatórios
                  <span style={{ background: "rgba(34,211,238,0.12)", color: "#22d3ee", fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 20 }}>{filtrados.length}</span>
                </h3>
                <div style={{ position: "relative" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: textMuted }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    aria-label="Buscar precatórios por CNJ, credor ou tribunal"
                    placeholder="Buscar CNJ, credor, tribunal..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    style={{
                      background: surface2, border: `1px solid ${border}`, borderRadius: 8,
                      padding: "7px 12px 7px 32px", color: text, fontSize: 12, outline: "none",
                      width: 240, minHeight: 34,
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {statusFiltros.map(f => (
                  <button key={f.id} onClick={() => setFiltroStatus(f.id)} style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: "pointer",
                    minHeight: 32,
                    border: filtroStatus === f.id ? "1px solid #22d3ee" : `1px solid ${border}`,
                    background: filtroStatus === f.id ? "rgba(34,211,238,0.12)" : "transparent",
                    color: filtroStatus === f.id ? "#22d3ee" : textMuted,
                    transition: "all 0.2s"
                  }}>{f.label}</button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}` }}>
                    {["Tipo", "CNJ", "Tribunal", "Credor", "Valor Face", "Score", "Status", "Data"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: h === "Valor Face" ? "right" : h === "Score" || h === "Status" ? "center" : "left", color: textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: textMuted, fontSize: 13 }}>
                      {busca ? `Nenhum resultado para "${busca}"` : "Nenhum precatório encontrado"}
                    </td></tr>
                  ) : filtrados.map((p, i) => (
                    <tr key={p.id} onClick={() => setPrecatorioSelecionado(p)}
                      style={{ borderBottom: `1px solid ${border}`, background: i % 2 === 0 ? "transparent" : `${surface2}50`, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = surface2; }}
                      onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "transparent" : `${surface2}50`; }}
                    >
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, letterSpacing: "0.04em",
                          background: p.tipo === "RPV" ? "rgba(167,139,250,0.15)" : "rgba(34,211,238,0.1)",
                          color: p.tipo === "RPV" ? "#a78bfa" : "#22d3ee",
                          border: `1px solid ${p.tipo === "RPV" ? "rgba(167,139,250,0.3)" : "rgba(34,211,238,0.2)"}`,
                        }}>{p.tipo}</span>
                      </td>
                      <td style={{ padding: "11px 16px", fontFamily: "monospace", fontSize: 11, color: textMuted }}>{p.numero_cnj}</td>
                      <td style={{ padding: "11px 16px", color: text, fontSize: 13 }}>{p.tribunal}</td>
                      <td style={{ padding: "11px 16px", color: textMuted, fontSize: 13 }}>{p.credor_nome ?? "—"}</td>
                      <td style={{ padding: "11px 16px", textAlign: "right", color: text, fontWeight: 600, fontSize: 13, fontVariant: "tabular-nums" }}>{formatarValor(p.valor_face)}</td>
                      <td style={{ padding: "11px 16px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-block", minWidth: 36, padding: "2px 6px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                          fontVariant: "tabular-nums",
                          background: (p.score_autenticidade ?? 0) >= 80 ? "rgba(52,211,153,0.15)" : (p.score_autenticidade ?? 0) >= 50 ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)",
                          color: (p.score_autenticidade ?? 0) >= 80 ? "#34d399" : (p.score_autenticidade ?? 0) >= 50 ? "#fbbf24" : "#f87171",
                        }}>{p.score_autenticidade ?? "—"}</span>
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "center" }}>
                        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.05)", border: `1px solid ${STATUS_COLOR_MAP[p.status]}`, color: STATUS_COLOR_MAP[p.status], opacity: 0.9 }}>
                          {STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px", color: textMuted, fontSize: 12 }}>
                        {new Date(p.data_consulta).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>

      {/* Drawer lateral */}
      {precatorioSelecionado && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div onClick={() => setPrecatorioSelecionado(null)} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ width: 420, background: surface, borderLeft: `1px solid ${border}`, display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease" }}>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ color: text, fontWeight: 700, fontSize: 16, margin: 0 }}>Detalhes do Precatório</h2>
                <p style={{ color: textMuted, fontSize: 12, margin: "4px 0 0" }}>{precatorioSelecionado.tipo}</p>
              </div>
              <button onClick={() => setPrecatorioSelecionado(null)} aria-label="Fechar detalhes" style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 7, color: textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}><X size={14} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ background: surface2, borderRadius: 10, padding: 16 }}>
                  <p style={{ color: textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", margin: "0 0 6px" }}>Número CNJ</p>
                  <p style={{ color: "#06b6d4", fontFamily: "monospace", fontSize: 13, fontWeight: 600, margin: 0 }}>{precatorioSelecionado.numero_cnj}</p>
                </div>
                {[
                  { label: "Tribunal", value: precatorioSelecionado.tribunal },
                  { label: "Credor", value: precatorioSelecionado.credor_nome ?? "—" },
                  { label: "Tipo", value: precatorioSelecionado.tipo },
                  { label: "Data da Consulta", value: new Date(precatorioSelecionado.data_consulta).toLocaleDateString("pt-BR") },
                  { label: "Última Atualização", value: new Date(precatorioSelecionado.data_atualizacao).toLocaleDateString("pt-BR") },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${border}`, paddingBottom: 12 }}>
                    <span style={{ color: textMuted, fontSize: 13 }}>{item.label}</span>
                    <span style={{ color: text, fontSize: 13, fontWeight: 500 }}>{item.value}</span>
                  </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10, padding: 14 }}>
                    <p style={{ color: textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", margin: "0 0 6px" }}>Valor Face</p>
                    <p style={{ color: "#06b6d4", fontSize: 16, fontWeight: 700, margin: 0 }}>{formatarValor(precatorioSelecionado.valor_face)}</p>
                  </div>
                  <div style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 10, padding: 14 }}>
                    <p style={{ color: textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", margin: "0 0 6px" }}>Valor Negociado</p>
                    <p style={{ color: "#7c3aed", fontSize: 16, fontWeight: 700, margin: 0 }}>{formatarValor(precatorioSelecionado.valor_negociado)}</p>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: textMuted, fontSize: 13 }}>Score de Autenticidade</span>
                  <span style={{
                    padding: "4px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: (precatorioSelecionado.score_autenticidade ?? 0) >= 80 ? "rgba(16,185,129,0.15)" : (precatorioSelecionado.score_autenticidade ?? 0) >= 50 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                    color: (precatorioSelecionado.score_autenticidade ?? 0) >= 80 ? "#10b981" : (precatorioSelecionado.score_autenticidade ?? 0) >= 50 ? "#f59e0b" : "#ef4444",
                  }}>{precatorioSelecionado.score_autenticidade ?? "—"} pts</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: textMuted, fontSize: 13 }}>Status</span>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.05)", border: `1px solid ${STATUS_COLOR_MAP[precatorioSelecionado.status]}`, color: STATUS_COLOR_MAP[precatorioSelecionado.status], opacity: 0.9 }}>
                    {STATUS_LABELS[precatorioSelecionado.status]}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {[
                    { label: "Proposta Comercial", valor: precatorioSelecionado.proposta_comercial },
                    { label: "Negócio Fechado", valor: precatorioSelecionado.negocio_fechado },
                  ].map(item => (
                    <div key={item.label} style={{ flex: 1, background: item.valor ? "rgba(16,185,129,0.1)" : surface2, border: `1px solid ${item.valor ? "rgba(16,185,129,0.2)" : border}`, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                      <p style={{ color: textMuted, fontSize: 11, margin: "0 0 4px" }}>{item.label}</p>
                      <p style={{ color: item.valor ? "#10b981" : textMuted, fontWeight: 700, fontSize: 13, margin: 0 }}>{item.valor ? "Sim" : "Não"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${border}` }}>
              <button onClick={() => setPrecatorioSelecionado(null)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: textMuted, cursor: "pointer", fontSize: 13 }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
