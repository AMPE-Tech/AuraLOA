import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";
import {
  GraficoMensal, GraficoTribunal, GraficoStatus,
  FunilEtapa, formatarValor
} from "../../types/dashboard";

interface Props {
  graficoMensal: GraficoMensal[];
  graficoTribunal: GraficoTribunal[];
  graficoStatus: GraficoStatus[];
  funil: FunilEtapa[];
}

const CARD = {
  background: "#162032",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "18px 20px",
} as const;

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "rgba(255,255,255,0.75)",
  marginBottom: 16,
  letterSpacing: "-0.01em",
};

const AXIS_TICK = { fill: "rgba(255,255,255,0.35)", fontSize: 10 };
const GRID_STROKE = "rgba(255,255,255,0.04)";

// Paleta brand
const CYAN    = "#22d3ee";
const GREEN   = "#34d399";
const VIOLET  = "#a78bfa";
const AMBER   = "#fbbf24";

const STATUS_COLORS = [GREEN, CYAN, AMBER];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 11 }}>
      {label && <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || "#fff", margin: "2px 0" }}>
          {p.name}: <span style={{ color: "#fff", fontWeight: 600 }}>{typeof p.value === "number" && p.value > 1000 ? formatarValor(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

function formatarValorAbrev(valor: number): string {
  if (valor >= 1_000_000) return `R$${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000) return `R$${(valor / 1_000).toFixed(0)}K`;
  return `R$${valor}`;
}

export function GraficosDashboard({ graficoMensal, graficoTribunal, graficoStatus, funil }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

      {/* Gráfico 1 — Evolução mensal (Area) */}
      <div style={CARD}>
        <p style={TITLE_STYLE}>Evolução de Consultas por Mês</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={graficoMensal}>
            <defs>
              <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={CYAN}  stopOpacity={0.25} />
                <stop offset="95%" stopColor={CYAN}  stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={GREEN} stopOpacity={0.2} />
                <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="mes" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="pesquisado" stroke={CYAN}  fill="url(#gradCyan)"  strokeWidth={2} name="Pesquisado" dot={false} />
            <Area type="monotone" dataKey="aprovado"   stroke={GREEN} fill="url(#gradGreen)" strokeWidth={2} name="Aprovado"   dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico 2 — Distribuição por status (Donut) */}
      <div style={CARD}>
        <p style={TITLE_STYLE}>Distribuição por Status</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={graficoStatus}
              cx="50%" cy="50%"
              innerRadius={52} outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {graficoStatus.map((_, i) => (
                <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico 3 — Valor por tribunal (Bar horizontal) */}
      <div style={CARD}>
        <p style={TITLE_STYLE}>Valor por Tribunal</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={graficoTribunal} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" tickFormatter={formatarValorAbrev} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="tribunal" tick={AXIS_TICK} axisLine={false} tickLine={false} width={45} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="valor_total" fill={CYAN} radius={[0, 4, 4, 0]} name="Valor Total"
              background={{ fill: "rgba(255,255,255,0.03)", radius: 4 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico 4 — Funil de conversão */}
      <div style={CARD}>
        <p style={TITLE_STYLE}>Funil de Conversão</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {funil.map((etapa) => {
            const maxQtd = funil[0]?.quantidade || 1;
            const pct = maxQtd > 0 ? Math.max(Math.round((etapa.quantidade / maxQtd) * 100), 4) : 4;
            return (
              <div key={etapa.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 110, fontSize: 10, color: "rgba(255,255,255,0.4)", textAlign: "right", flexShrink: 0 }}>
                  {etapa.label}
                </div>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 6, height: 22, position: "relative", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 6,
                    width: `${pct}%`,
                    background: etapa.cor,
                    opacity: 0.85,
                    display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8,
                    transition: "width 0.6s cubic-bezier(0.34,1.56,0.64,1)",
                  }}>
                    <span style={{ color: "#fff", fontSize: 10, fontWeight: 600 }}>{etapa.quantidade}</span>
                  </div>
                </div>
                <div style={{ width: 72, fontSize: 10, color: "rgba(255,255,255,0.3)", flexShrink: 0, textAlign: "right" }}>
                  {formatarValor(etapa.valor_total)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
