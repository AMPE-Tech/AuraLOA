import { Scale } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReportKPI {
  label: string;
  value: string | number;
  subtitle?: string;
  variant: "approved" | "warning" | "danger" | "info" | "purple" | "emerald" | "neutral";
  icon?: React.ReactNode;
}

export interface ReportTableColumn<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
}

export interface ReportSection {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export interface ReportTemplateProps {
  title: string;
  subtitle?: string;
  date?: string;
  referenceId?: string;
  sha256?: string;
  kpis?: ReportKPI[];
  sections?: ReportSection[];
  children?: React.ReactNode;
  /** Modo escuro (dashboard dark palette) */
  dark?: boolean;
}

// ─── Color map ───────────────────────────────────────────────────────────────

const kpiVariant: Record<ReportKPI["variant"], { bg: string; icon: string; badge: string }> = {
  approved: { bg: "bg-green-50",   icon: "text-green-600",  badge: "bg-green-100 text-green-700" },
  warning:  { bg: "bg-yellow-50",  icon: "text-yellow-600", badge: "bg-yellow-100 text-yellow-700" },
  danger:   { bg: "bg-red-50",     icon: "text-red-600",    badge: "bg-red-100 text-red-700" },
  info:     { bg: "bg-blue-50",    icon: "text-blue-600",   badge: "bg-blue-100 text-blue-700" },
  purple:   { bg: "bg-purple-50",  icon: "text-purple-600", badge: "bg-purple-100 text-purple-700" },
  emerald:  { bg: "bg-emerald-50", icon: "text-emerald-600",badge: "bg-emerald-100 text-emerald-700" },
  neutral:  { bg: "bg-slate-50",   icon: "text-slate-600",  badge: "bg-slate-100 text-slate-700" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

export function ReportKPICard({ label, value, subtitle, variant, icon }: ReportKPI) {
  const cls = kpiVariant[variant];
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-[10px] text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`${cls.bg} p-2.5 rounded-lg`}>
            <div className={cls.icon}>{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReportBadge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: ReportKPI["variant"];
}) {
  const cls = kpiVariant[variant];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cls.badge}`}>
      {children}
    </span>
  );
}

export function ReportTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyLabel = "Nenhum dado disponível",
}: {
  columns: ReportTableColumn<T>[];
  rows: T[];
  emptyLabel?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 ${
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-gray-400">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3 border-b border-gray-100 last:border-0 text-gray-700 ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""
                    }`}
                  >
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Header de relatório ──────────────────────────────────────────────────────

function ReportHeader({ title, subtitle, date, referenceId }: Pick<ReportTemplateProps, "title" | "subtitle" | "date" | "referenceId">) {
  return (
    <div
      className="rounded-xl p-10 mb-8 text-white"
      style={{ background: "linear-gradient(135deg, #06b6d4, #7c3aed)" }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
          <Scale className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight">AuraLOA</p>
          <p className="text-[11px] text-white/75">Análise Inteligente de Precatórios</p>
        </div>
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="text-sm text-white/80 mt-1">{subtitle}</p>}
      <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/70">
        {date && <span>Data: {date}</span>}
        {referenceId && <span>Ref.: {referenceId}</span>}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ReportTemplate({
  title,
  subtitle,
  date,
  referenceId,
  sha256,
  kpis,
  sections,
  children,
}: ReportTemplateProps) {
  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {/* Topbar */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-7 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #06b6d4, #7c3aed)" }}
            >
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-gray-900">AuraLOA</p>
              <p className="text-[11px] text-gray-400">Análise Inteligente de Precatórios</p>
            </div>
          </div>
          <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
            Relatório Técnico
          </span>
        </div>
      </header>

      {/* Corpo */}
      <main className="max-w-[1400px] mx-auto px-7 py-8 space-y-8">
        {/* Header do relatório */}
        <ReportHeader title={title} subtitle={subtitle} date={date} referenceId={referenceId} />

        {/* KPIs */}
        {kpis && kpis.length > 0 && (
          <section>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpis.map((kpi, i) => (
                <ReportKPICard key={i} {...kpi} />
              ))}
            </div>
          </section>
        )}

        {/* Seções customizadas */}
        {sections?.map((section, i) => (
          <section key={i}>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900">{section.title}</h2>
              {section.subtitle && (
                <p className="text-xs text-gray-500 mt-0.5">{section.subtitle}</p>
              )}
            </div>
            {section.children}
          </section>
        ))}

        {/* Slot livre */}
        {children}

        {/* SHA-256 / evidência */}
        {sha256 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
              Cadeia de Custódia — SHA-256
            </p>
            <p className="font-mono text-[11px] text-gray-500 break-all">{sha256}</p>
          </div>
        )}

        {/* Rodapé */}
        <footer className="border-t border-gray-100 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #06b6d4, #7c3aed)" }}
            >
              <Scale className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-gray-700">AuraLOA</span>
            <span className="text-[11px] text-gray-400">— Plataforma AuraTECH</span>
          </div>
          <span className="text-[10px] text-gray-400">
            Documento gerado automaticamente. Todas as informações são baseadas em fontes públicas verificadas.
          </span>
        </footer>
      </main>
    </div>
  );
}
