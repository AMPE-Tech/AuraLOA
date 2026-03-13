import { Badge } from "@/components/ui/badge";
import { Globe, Building2, Landmark, TrendingUp, BarChart3, Database, Activity } from "lucide-react";

const loaProjectionData = [
  { year: "2025", federal: 48.2, estadual: 55.1, municipal: 28.3 },
  { year: "2026", federal: 52.7, estadual: 60.5, municipal: 31.2 },
  { year: "2027", federal: 57.1, estadual: 66.3, municipal: 34.8 },
  { year: "2028", federal: 62.4, estadual: 72.0, municipal: 38.5 },
];

const donutData = [
  { name: "Federal", value: 100, color: "#4b8df8" },
  { name: "Estadual", value: 130, color: "#34d399" },
  { name: "Municipal", value: 70, color: "#6b7db3" },
];

const tribunaisData = [
  { tribunal: "TRF3", processos: 9250, valor: 42.1, color: "#4b8df8" },
  { tribunal: "TRF4", processos: 8900, valor: 38.7, color: "#3b82d6" },
  { tribunal: "TRF6", processos: 7200, valor: 31.2, color: "#2e9ecf" },
  { tribunal: "TRF1", processos: 5100, valor: 22.8, color: "#5570b8" },
  { tribunal: "TRF5", processos: 4300, valor: 18.9, color: "#6264a7" },
  { tribunal: "TRF2", processos: 3800, valor: 15.6, color: "#34d399" },
];

const esferaBarData = [
  { esfera: "Federal", valor: 100, color: "#4b8df8" },
  { esfera: "Estadual", valor: 130, color: "#34d399" },
  { esfera: "Municipal", valor: 70, color: "#6b7db3" },
];

export function MarketOverviewV2() {
  const total = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <section id="overview" className="py-10 md:py-16 border-t border-slate-700/30">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">

        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-100" data-testid="text-overview-title">
                Visao Geral do Mercado
              </h2>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Dados agregados do mercado de precatorios no Brasil
            </p>
          </div>
          <Badge className="mt-2 md:mt-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px] font-mono w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5 inline-block" />
            Dados publicos
          </Badge>
        </div>

        {/* KPI Cards — 3 esferas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {[
            { icon: Globe,     label: "Federal",   tag: "TRF1-6",     value: "R$ 100B", pct: 33, color: "#4b8df8", tagBg: "bg-blue-500/10",    tagText: "text-blue-400",    tagBorder: "border-blue-500/20" },
            { icon: Building2, label: "Estadual",  tag: "TJSP e mais", value: "R$ 130B", pct: 43, color: "#34d399", tagBg: "bg-emerald-500/10", tagText: "text-emerald-400", tagBorder: "border-emerald-500/20" },
            { icon: Landmark,  label: "Municipal", tag: "Prefeituras", value: "R$ 70B",  pct: 23, color: "#6b7db3", tagBg: "bg-cyan-500/10",    tagText: "text-cyan-400",    tagBorder: "border-cyan-500/20" },
          ].map((item) => (
            <div
              key={item.label}
              className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628] p-4 hover:border-slate-600/50 transition-colors"
              data-testid={`kpi-mercado-${item.label.toLowerCase()}`}
            >
              <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(59,130,246,0.3) 19px, rgba(59,130,246,0.3) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(59,130,246,0.3) 19px, rgba(59,130,246,0.3) 20px)' }} />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <item.icon className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-mono text-slate-400">{item.label}</span>
                  </div>
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${item.tagBg} ${item.tagText} border ${item.tagBorder}`}>{item.tag}</span>
                </div>
                <span className="text-xl font-bold text-slate-100 font-mono block mb-3">{item.value}</span>
                <div className="w-full h-1 rounded-full bg-slate-700/50 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: item.color, opacity: 0.6 }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* KPI mini cards — 4 métricas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { icon: TrendingUp, label: "Estoque Total",   value: "R$ 300B", suffix: "+", suffixColor: "text-blue-400",   sub: "Em precatorios no Brasil", iconColor: "text-emerald-400" },
            { icon: Activity,   label: "Processos Ativos", value: "~1.2M",  sub: "Precatorios e RPVs",                  iconColor: "text-blue-400" },
            { icon: BarChart3,  label: "LOA 2026",         value: "R$ 144B", sub: "Projecao consolidada",               iconColor: "text-purple-400" },
            { icon: Database,   label: "Tribunais",        value: "10+",     sub: "TRF1-6, TJSP e mais",                iconColor: "text-amber-400" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628] p-3.5"
              data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 14px, rgba(148,163,184,0.3) 14px, rgba(148,163,184,0.3) 15px), repeating-linear-gradient(90deg, transparent, transparent 14px, rgba(148,163,184,0.3) 14px, rgba(148,163,184,0.3) 15px)' }} />
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <kpi.icon className={`w-3 h-3 ${kpi.iconColor}`} />
                  <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">{kpi.label}</span>
                </div>
                <p className="text-lg font-bold text-slate-100 font-mono">
                  {kpi.value}
                  {"suffix" in kpi && kpi.suffix && <span className={`text-sm ${"suffixColor" in kpi ? kpi.suffixColor : ""}`}>{kpi.suffix}</span>}
                </p>
                <p className="text-[8px] font-mono text-slate-500 mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Linha 1: Donut (SVG) + Barras Tribunais (SVG) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">

          {/* Donut SVG */}
          <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]" data-testid="chart-donut-esfera">
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(59,130,246,0.3) 29px, rgba(59,130,246,0.3) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(59,130,246,0.3) 29px, rgba(59,130,246,0.3) 30px)' }} />
            <div className="relative p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Distribuicao por Esfera</span>
              </div>
              <div className="relative h-[200px] flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-[180px] h-[180px]">
                  {(() => {
                    let cumAngle = -90;
                    return donutData.map((d) => {
                      const angle = (d.value / total) * 360;
                      const startAngle = cumAngle;
                      cumAngle += angle;
                      const endAngle = cumAngle;
                      const startRad = (startAngle * Math.PI) / 180;
                      const endRad = (endAngle * Math.PI) / 180;
                      const outerR = 85;
                      const innerR = 58;
                      const x1o = 100 + outerR * Math.cos(startRad);
                      const y1o = 100 + outerR * Math.sin(startRad);
                      const x2o = 100 + outerR * Math.cos(endRad);
                      const y2o = 100 + outerR * Math.sin(endRad);
                      const x1i = 100 + innerR * Math.cos(endRad);
                      const y1i = 100 + innerR * Math.sin(endRad);
                      const x2i = 100 + innerR * Math.cos(startRad);
                      const y2i = 100 + innerR * Math.sin(startRad);
                      const largeArc = angle > 180 ? 1 : 0;
                      const path = `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i} Z`;
                      return (
                        <path key={d.name} d={path} fill={d.color} opacity="0.7" stroke="#0a1628" strokeWidth="2" />
                      );
                    });
                  })()}
                  <circle cx="100" cy="100" r="52" fill="#0a1628" />
                  <text x="100" y="95"  textAnchor="middle" fill="#e2e8f0" fontSize="18" fontFamily="monospace" fontWeight="bold">R$ 300B</text>
                  <text x="100" y="112" textAnchor="middle" fill="#64748b" fontSize="8"  fontFamily="monospace">Estoque Total</text>
                </svg>
              </div>
              <div className="flex items-center justify-center gap-4 mt-2">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[9px] font-mono text-slate-500">{d.name}</span>
                    <span className="text-[9px] font-mono text-slate-300 font-bold">R$ {d.value}B</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Barras Tribunais SVG */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]" data-testid="chart-tribunais">
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(59,130,246,0.3) 29px, rgba(59,130,246,0.3) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(59,130,246,0.3) 29px, rgba(59,130,246,0.3) 30px)' }} />
            <div className="relative p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Estoque por Tribunal Federal</span>
                </div>
                <span className="text-[8px] font-mono text-slate-600">R$ Bilhoes</span>
              </div>
              <div className="relative h-[220px] rounded-lg bg-[#060e1f] border border-slate-700/30 overflow-hidden p-4">
                <svg viewBox="0 0 500 200" className="w-full h-full">
                  <line x1="60" y1="180" x2="480" y2="180" stroke="#1e293b" strokeWidth="1" />
                  <line x1="60" y1="180" x2="60"  y2="10"  stroke="#1e293b" strokeWidth="1" />
                  {[0, 15, 30, 45, 60].map((v, i) => (
                    <g key={i}>
                      <line x1="60" y1={180 - (v / 60) * 160} x2="480" y2={180 - (v / 60) * 160} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3,3" />
                      <text x="55" y={184 - (v / 60) * 160} textAnchor="end" fill="#64748b" fontSize="7" fontFamily="monospace">R${v}B</text>
                    </g>
                  ))}
                  {tribunaisData.map((d, i) => {
                    const barH = (d.valor / 60) * 160;
                    const x = 90 + i * 65;
                    return (
                      <g key={d.tribunal}>
                        <rect x={x - 15} y={180 - barH} width="30" height={barH} fill={d.color} opacity="0.6" rx="3" />
                        <rect x={x - 15} y={180 - barH} width="30" height={barH} fill={d.color} opacity="0.15" rx="3">
                          <animate attributeName="opacity" values="0.15;0.25;0.15" dur="3s" repeatCount="indefinite" />
                        </rect>
                        <text x={x} y={175 - barH} textAnchor="middle" fill="#e2e8f0" fontSize="7" fontFamily="monospace" fontWeight="bold">R${d.valor}B</text>
                        <text x={x} y={194}         textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">{d.tribunal}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

        </div>

        {/* Linha 2: Barras esfera (progress) + Projeção LOA (SVG multi-bar + linhas) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* Estoque por Esfera — barras de progresso */}
          <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]" data-testid="chart-esfera-bars">
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(16,185,129,0.3) 29px, rgba(16,185,129,0.3) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(16,185,129,0.3) 29px, rgba(16,185,129,0.3) 30px)' }} />
            <div className="relative p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Estoque por Esfera</span>
                </div>
                <span className="text-[8px] font-mono text-slate-600">R$ Bilhoes</span>
              </div>
              <div className="space-y-3">
                {esferaBarData.map((d) => {
                  const pct = (d.valor / 150) * 100;
                  return (
                    <div key={d.esfera} className="rounded-lg bg-slate-800/30 border border-slate-700/20 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono font-bold text-slate-200">{d.esfera}</span>
                        <span className="text-[10px] font-mono font-bold" style={{ color: d.color }}>R$ {d.valor}B</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-700/50 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: d.color, opacity: 0.6 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {esferaBarData.map((d) => (
                  <div key={d.esfera} className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-2.5 text-center">
                    <p className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">{d.esfera}</p>
                    <p className="text-sm font-bold text-slate-100 font-mono mt-0.5">R$ {d.valor}B</p>
                    <p className="text-[8px] font-mono text-slate-600">{((d.valor / total) * 100).toFixed(0)}% do total</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Projeção LOA — barras agrupadas + linhas SVG */}
          <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]" data-testid="chart-loa-projection">
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(168,85,247,0.3) 29px, rgba(168,85,247,0.3) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(168,85,247,0.3) 29px, rgba(168,85,247,0.3) 30px)' }} />
            <div className="relative p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Activity className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest">Projecao LOA 2025-2028</span>
                  </div>
                  <p className="text-[8px] font-mono text-slate-600 ml-5">Crescimento estimado por esfera</p>
                </div>
                <div className="flex items-center gap-3">
                  {[
                    { label: "Federal",   color: "#4b8df8" },
                    { label: "Estadual",  color: "#34d399" },
                    { label: "Municipal", color: "#6b7db3" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                      <span className="text-[8px] font-mono text-slate-500">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative h-[240px] rounded-lg bg-[#060e1f] border border-slate-700/30 overflow-hidden p-4">
                <svg viewBox="0 0 400 200" className="w-full h-full">
                  <line x1="50" y1="180" x2="380" y2="180" stroke="#1e293b" strokeWidth="1" />
                  <line x1="50" y1="180" x2="50"  y2="10"  stroke="#1e293b" strokeWidth="1" />
                  {[0, 50, 100, 150, 200].map((v, i) => (
                    <g key={i}>
                      <line x1="50" y1={180 - (v / 200) * 160} x2="380" y2={180 - (v / 200) * 160} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3,3" />
                      <text x="45" y={184 - (v / 200) * 160} textAnchor="end" fill="#64748b" fontSize="7" fontFamily="monospace">{v}</text>
                    </g>
                  ))}

                  {/* Barras agrupadas por ano */}
                  {loaProjectionData.map((d, i) => {
                    const x = 90 + i * 85;
                    const fedH = (d.federal / 200) * 160;
                    const estH = (d.estadual / 200) * 160;
                    const munH = (d.municipal / 200) * 160;
                    return (
                      <g key={d.year}>
                        <rect x={x - 18} y={180 - munH} width="12" height={munH} fill="#6b7db3" opacity="0.5" rx="2" />
                        <rect x={x - 4}  y={180 - estH} width="12" height={estH} fill="#34d399" opacity="0.5" rx="2" />
                        <rect x={x + 10} y={180 - fedH} width="12" height={fedH} fill="#4b8df8" opacity="0.5" rx="2" />
                        <text x={x} y={194} textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">{d.year}</text>
                      </g>
                    );
                  })}

                  {/* Linhas de tendência com pontos animados */}
                  {(["federal", "estadual", "municipal"] as const).map((key, lineIdx) => {
                    const colors = ["#4b8df8", "#34d399", "#6b7db3"];
                    const color = colors[lineIdx];
                    const points = loaProjectionData.map((d, i) => {
                      const x = 90 + i * 85;
                      const y = 180 - (d[key] / 200) * 160;
                      return `${x},${y}`;
                    }).join(" ");
                    return (
                      <g key={key}>
                        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" strokeLinejoin="round" />
                        {loaProjectionData.map((d, i) => {
                          const x = 90 + i * 85;
                          const y = 180 - (d[key] / 200) * 160;
                          return (
                            <g key={i}>
                              <circle cx={x} cy={y} r="3" fill={color} opacity="0.8" />
                              <circle cx={x} cy={y} r="5" fill={color} opacity="0.15">
                                <animate attributeName="r"       values="5;8;5"          dur="3s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.15;0;0.15"    dur="3s" repeatCount="indefinite" />
                              </circle>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Mini cards de total por ano */}
              <div className="grid grid-cols-4 gap-2 mt-3">
                {loaProjectionData.map((d) => {
                  const yearTotal = d.federal + d.estadual + d.municipal;
                  return (
                    <div key={d.year} className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-2 text-center">
                      <p className="text-[8px] font-mono text-purple-400 uppercase tracking-wider">{d.year}</p>
                      <p className="text-xs font-bold text-slate-100 font-mono mt-0.5">R$ {yearTotal.toFixed(0)}B</p>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
