import { useState, useEffect } from "react";
import { KPICards } from "../components/dashboard/KPICards";
import {
  PrecatorioDashboard, FunilEtapa, GraficoMensal,
  GraficoTribunal, GraficoStatus, FUNIL_ETAPAS, STATUS_LABELS,
  STATUS_CORES, StatusPrecatorio, calcularKPIs, formatarValor
} from "../types/dashboard";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  FileSearch, TrendingUp, CheckCircle,
  Briefcase, LayoutDashboard,
  FileText, Settings, LogOut, Scale
} from "lucide-react";
import { useLocation } from "wouter";

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
  const [dark, setDark] = useState(true);
  const [precatorioSelecionado, setPrecatorioSelecionado] = useState<PrecatorioDashboard | null>(null);
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false);
  const [sidebarRecolhido, setSidebarRecolhido] = useState(false);

  const usuarioInfo = {
    nome: "Marcos Costa",
    email: "marcos@cstbrasil.com",
    plano: "Professional",
    consultasUsadas: 4,
    consultasTotal: 6,
    avatarLetra: "M",
  };

  const pctUso = Math.round((usuarioInfo.consultasUsadas / usuarioInfo.consultasTotal) * 100);
  const corUso = pctUso >= 90 ? "#ef4444" : pctUso >= 70 ? "#f59e0b" : "#10b981";

  useEffect(() => {
    setTimeout(() => {
      setPrecatorios(gerarDadosExemplo());
      setCarregando(false);
    }, 600);
  }, []);

  const filtrados = filtroStatus === "todos" ? precatorios : precatorios.filter(p => p.status === filtroStatus);
  const kpis = calcularKPIs(precatorios);
  const graficoMensal = prepararGraficoMensal(precatorios);
  const graficoTribunal = prepararGraficoTribunal(precatorios);
  const graficoStatus = prepararGraficoStatus(precatorios);
  const funil = prepararFunil(precatorios);

  const bg = dark ? "#0d1b2a" : "#f8fafc";
  const surface = dark ? "#112240" : "#ffffff";
  const surface2 = dark ? "#1a2f4a" : "#f1f5f9";
  const border = dark ? "#1e3a5f" : "#e2e8f0";
  const text = dark ? "#e2e8f0" : "#1e293b";
  const textMuted = dark ? "#64748b" : "#94a3b8";

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
      <div style={{ background: "#0d1b2a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #06b6d4", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "#64748b", fontSize: 14 }}>Carregando dashboard...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const paginaAtiva = SIDEBAR_ITEMS.find(i => i.active)?.label ?? "Dashboard";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: bg, fontFamily: "'DM Sans', system-ui, sans-serif", transition: "all 0.3s" }}>

      {/* Sidebar */}
      <aside style={{ width: sidebarRecolhido ? 0 : 220, minWidth: sidebarRecolhido ? 0 : 220, background: surface, borderRight: sidebarRecolhido ? "none" : `1px solid ${border}`, display: "flex", flexDirection: "column", flexShrink: 0, position: "relative", overflow: "hidden", transition: "width 0.3s ease, min-width 0.3s ease" }}>

        {/* Topo — Logo */}
        <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #06b6d4, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Scale size={17} color="white" />
            </div>
            <div>
              <div style={{ color: text, fontWeight: 700, fontSize: 13, letterSpacing: "-0.01em" }}>AuraLOA</div>
              <div style={{ color: textMuted, fontSize: 10 }}>Análise Inteligente de Precatórios</div>
            </div>
          </div>
        </div>

        {/* Navegação */}
        <nav style={{ flex: 1, padding: "12px 12px 0" }}>
          {SIDEBAR_ITEMS.map(item => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
              borderRadius: 8, marginBottom: 2, cursor: "pointer",
              background: item.active ? "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(124,58,237,0.15))" : "transparent",
              borderLeft: item.active ? "2px solid #06b6d4" : "2px solid transparent",
              transition: "all 0.2s"
            }}
              onClick={() => navigate(item.rota)}
              onMouseEnter={e => { if (!item.active) e.currentTarget.style.background = surface2; }}
              onMouseLeave={e => { if (!item.active) e.currentTarget.style.background = "transparent"; }}
            >
              <item.icon size={15} color={item.active ? "#06b6d4" : textMuted} />
              <span style={{ color: item.active ? text : textMuted, fontSize: 13, fontWeight: item.active ? 600 : 400 }}>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* Perfil do usuário */}
        <div style={{ borderTop: `1px solid ${border}`, margin: "8px 0 0" }}>
          <div
            onClick={() => setMenuUsuarioAberto(!menuUsuarioAberto)}
            style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "background 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = surface2; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #06b6d4, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{usuarioInfo.avatarLetra}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: text, fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{usuarioInfo.nome}</div>
              <div style={{ color: "#06b6d4", fontSize: 10, fontWeight: 500 }}>{usuarioInfo.plano}</div>
            </div>
            <span style={{ color: textMuted, fontSize: 10, display: "inline-block", transform: menuUsuarioAberto ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▲</span>
          </div>

          {/* Dropdown */}
          {menuUsuarioAberto && (
            <div style={{ background: surface2, borderTop: `1px solid ${border}`, overflow: "hidden" }}>
              {[
                { label: "Meu Perfil", emoji: "👤" },
                { label: "Alterar Foto", emoji: "📷" },
                { label: "Fazer Upgrade", emoji: "⚡", destaque: true },
                { label: "Assinatura", emoji: "💳" },
              ].map(item => (
                <div key={item.label} style={{
                  padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  color: item.destaque ? "#06b6d4" : text, fontSize: 12, fontWeight: item.destaque ? 600 : 400,
                  transition: "background 0.15s"
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = border; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 12 }}>{item.emoji}</span>
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
                >
                  <LogOut size={12} />
                  Sair
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé — Consultas */}
        <div style={{ padding: "12px 16px 16px", borderTop: `1px solid ${border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <span style={{ color: textMuted, fontSize: 11, fontWeight: 600 }}>Consultas do mês</span>
            <span style={{ color: corUso, fontSize: 11, fontWeight: 700 }}>{usuarioInfo.consultasUsadas}/{usuarioInfo.consultasTotal}</span>
          </div>
          <div style={{ background: surface2, borderRadius: 6, height: 5, overflow: "hidden", marginBottom: 7 }}>
            <div style={{ width: `${pctUso}%`, height: "100%", background: `linear-gradient(90deg, ${corUso}, ${corUso}99)`, borderRadius: 6, transition: "width 0.5s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: textMuted, fontSize: 10 }}>{pctUso}% utilizado</span>
            <span style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4", fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, border: "1px solid rgba(6,182,212,0.2)", cursor: "pointer" }}>Upgrade</span>
          </div>
        </div>

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
            <button style={{
              background: "transparent", border: `1px solid ${border}`, borderRadius: 8,
              padding: "6px 10px", cursor: "pointer", color: textMuted, display: "flex", alignItems: "center",
              transition: "all 0.2s"
            }}
              onMouseEnter={e => { e.currentTarget.style.background = surface2; (e.currentTarget as HTMLButtonElement).style.color = text; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = textMuted; }}
              title="Notificações"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>

            {/* Toggle idioma */}
            <button
              onClick={() => {}}
              style={{
                background: "transparent", border: `1px solid ${border}`, borderRadius: 8,
                padding: "6px 10px", cursor: "pointer", color: textMuted, fontSize: 12,
                display: "flex", alignItems: "center", gap: 5, transition: "all 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = surface2; (e.currentTarget as HTMLButtonElement).style.color = text; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = textMuted; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              EN
            </button>

            {/* Dark mode */}
            <button
              onClick={() => setDark(!dark)}
              style={{
                background: "transparent", border: `1px solid ${border}`, borderRadius: 8,
                padding: "6px 10px", cursor: "pointer", color: textMuted, fontSize: 12,
                display: "flex", alignItems: "center", gap: 5, transition: "all 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = surface2; (e.currentTarget as HTMLButtonElement).style.color = text; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = textMuted; }}
            >
              {dark
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
              {dark ? "Claro" : "Escuro"}
            </button>

            {/* Refresh */}
            <button
              onClick={() => setPrecatorios(gerarDadosExemplo())}
              style={{
                background: "transparent", border: `1px solid ${border}`, borderRadius: 8,
                padding: "6px 10px", cursor: "pointer", color: textMuted,
                display: "flex", alignItems: "center", transition: "all 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = surface2; (e.currentTarget as HTMLButtonElement).style.color = text; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = textMuted; }}
              title="Atualizar dados"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>

          </div>
        </header>

        {/* Conteúdo principal */}
        <main style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", flex: 1 }}>

          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              { label: "Total Pesquisado", value: kpis.total_pesquisado, sub: "precatórios", color: "#06b6d4", icon: FileSearch },
              { label: "Aprovados", value: kpis.total_aprovado, sub: `${kpis.taxa_aprovacao}% do total`, color: "#10b981", icon: CheckCircle },
              { label: "Em Negociação", value: kpis.total_proposta, sub: "com proposta ativa", color: "#7c3aed", icon: Briefcase },
              { label: "Fechados", value: kpis.total_fechado, sub: `${kpis.taxa_conversao}% conversão`, color: "#f59e0b", icon: TrendingUp },
            ].map(card => (
              <div key={card.label} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "20px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${card.color}, transparent)` }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ color: textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>{card.label}</p>
                    <p style={{ color: text, fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>{card.value}</p>
                    <p style={{ color: textMuted, fontSize: 12, margin: 0 }}>{card.sub}</p>
                  </div>
                  <div style={{ background: `${card.color}20`, borderRadius: 10, padding: 10 }}>
                    <card.icon size={18} color={card.color} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Valor cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { label: "Valor Total Pesquisado", value: formatarValor(kpis.valor_total_pesquisado), color: "#06b6d4" },
              { label: "Valor em Negociação", value: formatarValor(kpis.valor_total_negociacao), color: "#7c3aed" },
              { label: "Valor Fechado", value: formatarValor(kpis.valor_total_fechado), color: "#10b981" },
            ].map(card => (
              <div key={card.label} style={{ background: `linear-gradient(135deg, ${card.color}18, ${card.color}08)`, border: `1px solid ${card.color}30`, borderRadius: 12, padding: "18px 20px" }}>
                <p style={{ color: textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>{card.label}</p>
                <p style={{ color: card.color, fontSize: 22, fontWeight: 700, margin: 0 }}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Gráficos linha + donut */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ color: text, fontWeight: 600, fontSize: 14, margin: "0 0 16px" }}>Evolução de Consultas</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={graficoMensal}>
                  <defs>
                    <linearGradient id="gradCiano" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradVerde" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={border} />
                  <XAxis dataKey="mes" tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: surface2, border: `1px solid ${border}`, borderRadius: 8, color: text }} />
                  <Area type="monotone" dataKey="pesquisado" stroke="#06b6d4" strokeWidth={2} fill="url(#gradCiano)" name="Pesquisado" />
                  <Area type="monotone" dataKey="aprovado" stroke="#10b981" strokeWidth={2} fill="url(#gradVerde)" name="Aprovado" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ color: text, fontWeight: 600, fontSize: 14, margin: "0 0 16px" }}>Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={graficoStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {graficoStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: surface2, border: `1px solid ${border}`, borderRadius: 8, color: text }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: textMuted }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tribunal + Funil */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ color: text, fontWeight: 600, fontSize: 14, margin: "0 0 16px" }}>Valor por Tribunal</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={graficoTribunal} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={border} />
                  <XAxis type="number" tick={{ fill: textMuted, fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1e6 ? `R$${(v/1e6).toFixed(1)}M` : `R$${(v/1e3).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="tribunal" tick={{ fill: textMuted, fontSize: 11 }} width={45} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: surface2, border: `1px solid ${border}`, borderRadius: 8, color: text }} formatter={(v: number) => [formatarValor(v), "Valor"]} />
                  <Bar dataKey="valor_total" radius={[0, 4, 4, 0]}>
                    {graficoTribunal.map((_, i) => <Cell key={i} fill={`rgba(6,182,212,${1 - i * 0.12})`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ color: text, fontWeight: 600, fontSize: 14, margin: "0 0 16px" }}>Funil de Conversão</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {funil.map(etapa => {
                  const maxQtd = funil[0]?.quantidade || 1;
                  const pct = maxQtd > 0 ? Math.max(Math.round((etapa.quantidade / maxQtd) * 100), 4) : 4;
                  return (
                    <div key={etapa.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 100, textAlign: "right", color: textMuted, fontSize: 11, flexShrink: 0 }}>{etapa.label}</div>
                      <div style={{ flex: 1, background: surface2, borderRadius: 6, height: 22, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: etapa.cor, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6, transition: "width 0.5s" }}>
                          <span style={{ color: "white", fontSize: 11, fontWeight: 600 }}>{etapa.quantidade}</span>
                        </div>
                      </div>
                      <div style={{ width: 80, color: textMuted, fontSize: 11, flexShrink: 0 }}>{formatarValor(etapa.valor_total)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ color: text, fontWeight: 600, fontSize: 14, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <FileSearch size={15} color="#06b6d4" />
                Precatórios ({filtrados.length})
              </h3>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {statusFiltros.map(f => (
                  <button key={f.id} onClick={() => setFiltroStatus(f.id)} style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: "pointer",
                    border: filtroStatus === f.id ? "1px solid #06b6d4" : `1px solid ${border}`,
                    background: filtroStatus === f.id ? "rgba(6,182,212,0.15)" : "transparent",
                    color: filtroStatus === f.id ? "#06b6d4" : textMuted,
                    transition: "all 0.2s"
                  }}>{f.label}</button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}` }}>
                    {["CNJ", "Tribunal", "Credor", "Valor Face", "Score", "Status", "Data"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: h === "Valor Face" ? "right" : h === "Score" || h === "Status" ? "center" : "left", color: textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: textMuted, fontSize: 13 }}>Nenhum precatório encontrado</td></tr>
                  ) : filtrados.map((p, i) => (
                    <tr key={p.id} onClick={() => setPrecatorioSelecionado(p)}
                      style={{ borderBottom: `1px solid ${border}`, background: i % 2 === 0 ? "transparent" : `${surface2}50`, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = surface2; }}
                      onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "transparent" : `${surface2}50`; }}
                    >
                      <td style={{ padding: "11px 16px", fontFamily: "monospace", fontSize: 11, color: textMuted }}>{p.numero_cnj}</td>
                      <td style={{ padding: "11px 16px", color: text, fontSize: 13 }}>{p.tribunal}</td>
                      <td style={{ padding: "11px 16px", color: textMuted, fontSize: 13 }}>{p.credor_nome ?? "—"}</td>
                      <td style={{ padding: "11px 16px", textAlign: "right", color: text, fontWeight: 600, fontSize: 13 }}>{formatarValor(p.valor_face)}</td>
                      <td style={{ padding: "11px 16px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-block", minWidth: 36, padding: "2px 6px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: (p.score_autenticidade ?? 0) >= 80 ? "rgba(16,185,129,0.15)" : (p.score_autenticidade ?? 0) >= 50 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                          color: (p.score_autenticidade ?? 0) >= 80 ? "#10b981" : (p.score_autenticidade ?? 0) >= 50 ? "#f59e0b" : "#ef4444",
                        }}>{p.score_autenticidade ?? "—"}</span>
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "center" }}>
                        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.05)", border: "1px solid currentColor", opacity: 0.9 }} className={STATUS_CORES[p.status]}>
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
              <button onClick={() => setPrecatorioSelecionado(null)} style={{ background: "transparent", border: "none", color: textMuted, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>✕</button>
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
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.05)", border: "1px solid currentColor", opacity: 0.9 }} className={STATUS_CORES[precatorioSelecionado.status]}>
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
