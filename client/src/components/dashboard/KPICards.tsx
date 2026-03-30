import { DashboardKPIs, formatarValor } from "../../types/dashboard";
import { TrendingUp, FileSearch, CheckCircle, AlertTriangle, XCircle, Briefcase, DollarSign } from "lucide-react";

interface Props {
  kpis: DashboardKPIs;
}

type Variant = "cyan" | "green" | "amber" | "red" | "violet" | "emerald" | "slate";

interface CardProps {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  icone: React.ReactNode;
  variant: Variant;
}

const VARIANT_STYLES: Record<Variant, { accent: string; iconBg: string; iconColor: string; glow: string }> = {
  cyan:    { accent: "#22d3ee", iconBg: "rgba(34,211,238,0.12)",  iconColor: "#22d3ee", glow: "rgba(34,211,238,0.08)" },
  green:   { accent: "#22c55e", iconBg: "rgba(34,197,94,0.12)",   iconColor: "#22c55e", glow: "rgba(34,197,94,0.08)" },
  amber:   { accent: "#fbbf24", iconBg: "rgba(251,191,36,0.12)",  iconColor: "#fbbf24", glow: "rgba(251,191,36,0.08)" },
  red:     { accent: "#f87171", iconBg: "rgba(248,113,113,0.12)", iconColor: "#f87171", glow: "rgba(248,113,113,0.08)" },
  violet:  { accent: "#a78bfa", iconBg: "rgba(167,139,250,0.12)", iconColor: "#a78bfa", glow: "rgba(167,139,250,0.08)" },
  emerald: { accent: "#34d399", iconBg: "rgba(52,211,153,0.12)",  iconColor: "#34d399", glow: "rgba(52,211,153,0.08)" },
  slate:   { accent: "#94a3b8", iconBg: "rgba(148,163,184,0.12)", iconColor: "#94a3b8", glow: "rgba(148,163,184,0.08)" },
};

function KPICard({ titulo, valor, subtitulo, icone, variant }: CardProps) {
  const s = VARIANT_STYLES[variant];
  return (
    <div
      style={{
        background: "#162032",
        border: "1px solid rgba(255,255,255,0.07)",
        borderTop: `2px solid ${s.accent}`,
        borderRadius: 12,
        padding: "18px 20px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        transition: "background 0.2s",
        cursor: "default",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `#1a2840`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#162032"; }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.38)",
          margin: 0,
          marginBottom: 6,
        }}>
          {titulo}
        </p>
        <p style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#ffffff",
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
        }}>
          {valor}
        </p>
        {subtitulo && (
          <p style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            margin: 0,
            marginTop: 5,
          }}>
            {subtitulo}
          </p>
        )}
      </div>
      <div style={{
        background: s.iconBg,
        borderRadius: 10,
        padding: 10,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ color: s.iconColor, display: "flex" }}>{icone}</div>
      </div>
    </div>
  );
}

export function KPICards({ kpis }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Linha 1 — 4 KPIs de volume */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPICard
          titulo="Total Pesquisado"
          valor={kpis.total_pesquisado}
          subtitulo="precatórios consultados"
          icone={<FileSearch size={17} />}
          variant="slate"
        />
        <KPICard
          titulo="Aprovados"
          valor={kpis.total_aprovado}
          subtitulo={`${kpis.taxa_aprovacao}% do total`}
          icone={<CheckCircle size={17} />}
          variant="green"
        />
        <KPICard
          titulo="Verificar"
          valor={kpis.total_verificar}
          subtitulo="requerem atenção"
          icone={<AlertTriangle size={17} />}
          variant="amber"
        />
        <KPICard
          titulo="Suspeitos"
          valor={kpis.total_suspeito}
          subtitulo="bloqueados"
          icone={<XCircle size={17} />}
          variant="red"
        />
      </div>

      {/* Linha 2 — 3 KPIs de valor */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <KPICard
          titulo="Valor Total Pesquisado"
          valor={formatarValor(kpis.valor_total_pesquisado)}
          subtitulo="face dos precatórios"
          icone={<DollarSign size={17} />}
          variant="cyan"
        />
        <KPICard
          titulo="Em Negociação"
          valor={formatarValor(kpis.valor_total_negociacao)}
          subtitulo={`${kpis.total_proposta} com proposta ativa`}
          icone={<Briefcase size={17} />}
          variant="violet"
        />
        <KPICard
          titulo="Negócios Fechados"
          valor={formatarValor(kpis.valor_total_fechado)}
          subtitulo={`${kpis.total_fechado} contratos — ${kpis.taxa_conversao}% conversão`}
          icone={<TrendingUp size={17} />}
          variant="emerald"
        />
      </div>
    </div>
  );
}
