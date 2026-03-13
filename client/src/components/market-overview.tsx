import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar, BarChart, XAxis, YAxis, Area, AreaChart,
  CartesianGrid, Cell, PieChart, Pie, LabelList,
} from "recharts";
import { Globe, Building2, Landmark, TrendingUp, BarChart3, Database, Activity } from "lucide-react";

// ── Dados ────────────────────────────────────────────────────────────────────

const loaProjectionData = [
  { year: "2025", federal: 48.2, estadual: 55.1, municipal: 28.3 },
  { year: "2026", federal: 52.7, estadual: 60.5, municipal: 31.2 },
  { year: "2027", federal: 57.1, estadual: 66.3, municipal: 34.8 },
  { year: "2028", federal: 62.4, estadual: 72.0, municipal: 38.5 },
];

const esferaBreakdownData = [
  { esfera: "Federal",   valor: 100, fill: "hsl(217 80% 58%)" },
  { esfera: "Estadual",  valor: 130, fill: "hsl(155 55% 48%)" },
  { esfera: "Municipal", valor: 70,  fill: "hsl(220 20% 52%)" },
];

const donutData = [
  { name: "Federal",   value: 100, fill: "hsl(217 80% 58%)" },
  { name: "Estadual",  value: 130, fill: "hsl(155 55% 48%)" },
  { name: "Municipal", value: 70,  fill: "hsl(220 20% 52%)" },
];

const tribunaisData = [
  { tribunal: "TRF3", processos: 9250, valor: 42.1, fill: "hsl(217 80% 58%)" },
  { tribunal: "TRF4", processos: 8900, valor: 38.7, fill: "hsl(210 65% 52%)" },
  { tribunal: "TRF6", processos: 7200, valor: 31.2, fill: "hsl(200 55% 48%)" },
  { tribunal: "TRF1", processos: 5100, valor: 22.8, fill: "hsl(220 40% 55%)" },
  { tribunal: "TRF5", processos: 4300, valor: 18.9, fill: "hsl(230 35% 52%)" },
  { tribunal: "TRF2", processos: 3800, valor: 15.6, fill: "hsl(155 55% 48%)" },
];

// ── Configs Recharts ─────────────────────────────────────────────────────────

const areaChartConfig = {
  federal:   { label: "Federal",   color: "hsl(var(--chart-1))" },
  estadual:  { label: "Estadual",  color: "hsl(var(--chart-2))" },
  municipal: { label: "Municipal", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const barChartConfig = {
  valor: { label: "R$ Bilhoes", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const tribunaisChartConfig = {
  valor: { label: "R$ Bilhoes", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const donutChartConfig = {
  Federal:   { label: "Federal",   color: "hsl(217 80% 58%)" },
  Estadual:  { label: "Estadual",  color: "hsl(155 55% 48%)" },
  Municipal: { label: "Municipal", color: "hsl(220 20% 52%)" },
} satisfies ChartConfig;

// ── Componente ───────────────────────────────────────────────────────────────

export function MarketOverview() {
  return (
    <section id="overview" className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(222_9%_9%)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">

        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <h2 className="text-lg font-semibold text-white/90" data-testid="text-overview-title">
                Visao Geral do Mercado
              </h2>
            </div>
            <p className="text-xs text-white/45">
              Dados agregados do mercado de precatorios no Brasil
            </p>
          </div>
          <div className="mt-3 md:mt-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/15 bg-emerald-500/[0.05]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400/70">Dados publicos</span>
          </div>
        </div>

        {/* Cards Federal / Estadual / Municipal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#0f172a]/40 border border-slate-800/80 rounded-xl p-6 flex flex-col" data-testid="kpi-mercado-federal">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" /> Federal
              </span>
              <span className="text-[10px] font-mono bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">TRF1-6</span>
            </div>
            <span className="text-3xl font-bold text-white mb-4">R$ 100B</span>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: "33%" }} />
            </div>
          </div>
          <div className="bg-[#0f172a]/40 border border-slate-800/80 rounded-xl p-6 flex flex-col" data-testid="kpi-mercado-estadual">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Estadual
              </span>
              <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30">TJSP e mais</span>
            </div>
            <span className="text-3xl font-bold text-white mb-4">R$ 130B</span>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: "43%" }} />
            </div>
          </div>
          <div className="bg-[#0f172a]/40 border border-slate-800/80 rounded-xl p-6 flex flex-col" data-testid="kpi-mercado-municipal">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <Landmark className="w-4 h-4" /> Municipal
              </span>
              <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">Prefeituras</span>
            </div>
            <span className="text-3xl font-bold text-white mb-4">R$ 70B</span>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: "23%" }} />
            </div>
          </div>
        </div>

        {/* KPIs pequenos */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="bg-white/[0.02] border-white/[0.06]" data-testid="kpi-total-precatorios">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-3 h-3 text-emerald-400/60" />
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Estoque Total</p>
              </div>
              <p className="text-xl font-bold text-white">R$ 300B<span className="text-sm text-blue-400">+</span></p>
              <p className="text-[10px] text-white/35 mt-1">Em precatorios no Brasil</p>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.02] border-white/[0.06]" data-testid="kpi-processos-ativos">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-3 h-3 text-blue-400/60" />
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Processos Ativos</p>
              </div>
              <p className="text-xl font-bold text-white">~1.2M</p>
              <p className="text-[10px] text-white/35 mt-1">Precatorios e RPVs</p>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.02] border-white/[0.06]" data-testid="kpi-loa-2026">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-3 h-3 text-purple-400/60" />
                <p className="text-[10px] text-white/40 uppercase tracking-wider">LOA 2026</p>
              </div>
              <p className="text-xl font-bold text-white">R$ 144B</p>
              <p className="text-[10px] text-white/35 mt-1">Projecao consolidada</p>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.02] border-white/[0.06]" data-testid="kpi-tribunais">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-3 h-3 text-amber-400/60" />
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Tribunais</p>
              </div>
              <p className="text-xl font-bold text-white">10+</p>
              <p className="text-[10px] text-white/35 mt-1">TRF1-6, TJSP e mais</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos linha 1: Donut + Barras horizontais tribunais */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
          <Card className="bg-white/[0.02] border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-white/40" data-testid="text-chart-breakdown">Distribuicao por Esfera</h3>
              </div>
              <ChartContainer config={donutChartConfig} className="h-[200px] w-full">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-white/10 bg-[hsl(225_10%_10%)] p-2.5 shadow-xl">
                        <p className="text-xs font-semibold text-white">{d.name}</p>
                        <p className="text-[10px] text-white/60">R$ <span className="text-white font-medium">{d.value}B</span></p>
                      </div>
                    );
                  }} />
                  <text x="50%" y="46%" textAnchor="middle" className="fill-white text-xl font-bold">R$ 300B</text>
                  <text x="50%" y="58%" textAnchor="middle" className="fill-white/40 text-[10px]">Estoque Total</text>
                </PieChart>
              </ChartContainer>
              <div className="flex items-center justify-center gap-4 mt-2">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                    <span className="text-[10px] text-white/50">{d.name}</span>
                    <span className="text-[10px] font-medium text-white/70">R$ {d.value}B</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 bg-white/[0.02] border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-white/40" data-testid="text-chart-tribunais">Estoque por Tribunal Federal</h3>
                <span className="text-[10px] text-white/35">R$ Bilhoes</span>
              </div>
              <ChartContainer config={tribunaisChartConfig} className="h-[200px] w-full">
                <BarChart data={tribunaisData} layout="vertical" accessibilityLayer barSize={18}>
                  <CartesianGrid horizontal={false} stroke="hsl(220 10% 18%)" strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 50%)" }} tickFormatter={(v) => `R$${v}B`} />
                  <YAxis type="category" dataKey="tribunal" tickLine={false} axisLine={false} width={45} tick={{ fontSize: 11, fill: "hsl(220 10% 55%)", fontWeight: 500 }} />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-white/10 bg-[hsl(225_10%_10%)] p-3 shadow-xl">
                          <p className="text-xs font-semibold text-white mb-1">{d.tribunal}</p>
                          <p className="text-[10px] text-white/60">Valor: <span className="text-white font-medium">R$ {d.valor}B</span></p>
                          <p className="text-[10px] text-white/60">Processos: <span className="text-white font-medium">{d.processos.toLocaleString()}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {tribunaisData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="valor" position="right" formatter={(v: number) => `R$${v}B`} style={{ fontSize: 11, fill: "hsl(220 10% 60%)" }} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos linha 2: Barras verticais esfera + Área projeção LOA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card className="bg-white/[0.02] border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-white/40" data-testid="text-chart-esfera-breakdown">Estoque por Esfera</h3>
                <span className="text-[10px] text-white/35">R$ Bilhoes</span>
              </div>
              <ChartContainer config={barChartConfig} className="h-[200px] w-full">
                <BarChart data={esferaBreakdownData} accessibilityLayer barSize={40}>
                  <CartesianGrid vertical={false} stroke="hsl(220 10% 18%)" strokeDasharray="3 3" />
                  <XAxis dataKey="esfera" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(220 10% 50%)" }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} tick={{ fontSize: 11, fill: "hsl(220 10% 45%)" }} />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-white/10 bg-[hsl(225_10%_10%)] p-3 shadow-xl">
                          <p className="text-xs font-semibold text-white">{d.esfera}</p>
                          <p className="text-[10px] text-white/60 mt-1">R$ <span className="text-white font-medium">{d.valor}B</span></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {esferaBreakdownData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="valor" position="top" formatter={(v: number) => `R$${v}B`} style={{ fontSize: 11, fill: "hsl(220 10% 65%)", fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.02] border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-white/40" data-testid="text-chart-projection">Projecao LOA 2025-2028</h3>
                  <p className="text-[9px] text-white/25 mt-0.5">Crescimento estimado por esfera</p>
                </div>
                <div className="flex items-center gap-3">
                  {[
                    { label: "Federal",   color: "hsl(217 80% 58%)" },
                    { label: "Estadual",  color: "hsl(155 55% 48%)" },
                    { label: "Municipal", color: "hsl(220 20% 52%)" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                      <span className="text-[9px] text-white/40">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ChartContainer config={areaChartConfig} className="h-[200px] w-full">
                <AreaChart data={loaProjectionData} accessibilityLayer>
                  <defs>
                    <linearGradient id="gradFederal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(217 80% 58%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(217 80% 58%)" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="gradEstadual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(155 55% 48%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(155 55% 48%)" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="gradMunicipal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(220 20% 52%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(220 20% 52%)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(220 10% 18%)" strokeDasharray="3 3" />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(220 10% 50%)" }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} tick={{ fontSize: 11, fill: "hsl(220 10% 45%)" }} domain={[0, 200]} />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const total = payload.reduce((sum, p) => sum + (p.value as number), 0);
                      return (
                        <div className="rounded-lg border border-white/10 bg-[hsl(225_10%_10%)] p-3 shadow-xl">
                          <p className="text-xs font-semibold text-white mb-2">LOA {label}</p>
                          {payload.map((p) => (
                            <div key={p.dataKey as string} className="flex items-center justify-between gap-4 mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                <span className="text-[10px] text-white/60 capitalize">{p.dataKey as string}</span>
                              </div>
                              <span className="text-[10px] text-white font-medium">R$ {(p.value as number).toFixed(1)}B</span>
                            </div>
                          ))}
                          <div className="border-t border-white/10 mt-1.5 pt-1.5 flex justify-between">
                            <span className="text-[10px] text-white/50">Total</span>
                            <span className="text-[10px] text-white font-bold">R$ {total.toFixed(1)}B</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="federal"   stackId="1" fill="url(#gradFederal)"   stroke="hsl(217 80% 58%)" strokeWidth={2} />
                  <Area type="monotone" dataKey="estadual"  stackId="1" fill="url(#gradEstadual)"  stroke="hsl(155 55% 48%)" strokeWidth={2} />
                  <Area type="monotone" dataKey="municipal" stackId="1" fill="url(#gradMunicipal)" stroke="hsl(220 20% 52%)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

      </div>
    </section>
  );
}
