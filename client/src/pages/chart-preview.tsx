import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  PieChart,
  Pie,
  Cell,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Clock,
  Zap,
  Users,
  ArrowRight,
  Shield,
  Layers,
  Database,
  Hash,
  CheckCircle2,
  TrendingUp,
  FileCheck,
  Search,
  BarChart3,
  Scale,
} from "lucide-react";

const radialData = [
  { name: "AuraLOA", value: 7, fill: "hsl(142 72% 48%)" },
  { name: "Manual", value: 280, fill: "hsl(0 70% 45%)" },
];

const radialConfig = {
  value: { label: "Horas" },
} satisfies ChartConfig;

const donutData = [
  { name: "Economia (AuraLOA)", value: 273, fill: "hsl(142 72% 48%)" },
  { name: "Tempo AuraLOA", value: 7, fill: "hsl(217 91% 50%)" },
];

const donutManualData = [
  { name: "Tempo Manual", value: 280, fill: "hsl(0 70% 45%)" },
  { name: "Restante", value: 0, fill: "transparent" },
];

const donutConfig = {
  value: { label: "Horas" },
} satisfies ChartConfig;

const etapas = [
  { etapa: "Coleta", manual: 120, digital: 3 },
  { etapa: "Cruzamento", manual: 80, digital: 2 },
  { etapa: "Validacao", manual: 40, digital: 1 },
  { etapa: "Evidencia", manual: 24, digital: 0.5 },
  { etapa: "Relatorio", manual: 16, digital: 0.5 },
];

const barConfig = {
  manual: { label: "Manual", color: "hsl(0 70% 45%)" },
  digital: { label: "AuraLOA", color: "hsl(142 72% 48%)" },
} satisfies ChartConfig;

export default function ChartPreview() {
  return (
    <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-bold mb-1">Preview: Graficos Due Diligence</h1>
        <p className="text-sm text-muted-foreground">3 opcoes de visualizacao — escolha a que preferir</p>
      </div>

      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-primary text-primary-foreground">Opcao A</Badge>
            <h2 className="text-sm font-semibold">RadialBar Gauge — Arcos Concentricos</h2>
          </div>
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 flex items-center justify-center">
                  <div className="relative">
                    <ChartContainer config={radialConfig} className="h-[280px] w-[280px]">
                      <RadialBarChart
                        innerRadius="35%"
                        outerRadius="90%"
                        data={radialData}
                        startAngle={180}
                        endAngle={-180}
                        barSize={20}
                      >
                        <PolarAngleAxis type="number" domain={[0, 280]} angleAxisId={0} tick={false} />
                        <RadialBar
                          dataKey="value"
                          cornerRadius={6}
                          background={{ fill: "hsl(var(--muted))" }}
                        />
                      </RadialBarChart>
                    </ChartContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold text-primary">40x</span>
                      <span className="text-[10px] text-muted-foreground">mais rapido</span>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2 flex flex-col justify-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500/80 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Due Diligence Manual</p>
                      <p className="text-xl font-bold text-red-400">280 horas</p>
                      <p className="text-[10px] text-muted-foreground">~35 dias uteis | 2-3 analistas</p>
                    </div>
                  </div>
                  <div className="w-full h-px bg-border" />
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">AuraLOA Digital</p>
                      <p className="text-xl font-bold text-emerald-400">7 horas</p>
                      <p className="text-[10px] text-muted-foreground">~1 dia util | automatizado</p>
                    </div>
                  </div>
                  <div className="w-full h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Economia</p>
                      <p className="text-lg font-bold text-primary">97.5%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Custo salvo</p>
                      <p className="text-lg font-bold text-primary">~R$ 85K</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-primary text-primary-foreground">Opcao B</Badge>
            <h2 className="text-sm font-semibold">Donut Comparativo — Proporcao de Economia</h2>
          </div>
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="relative">
                      <ChartContainer config={donutConfig} className="h-[200px] w-[200px]">
                        <PieChart>
                          <Pie
                            data={donutManualData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={0}
                          >
                            {donutManualData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-red-400">280h</span>
                        <span className="text-[9px] text-muted-foreground">Manual</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight className="w-5 h-5 text-primary" />
                    <span className="text-[10px] font-mono text-primary font-bold">40x</span>
                  </div>

                  <div className="text-center">
                    <div className="relative">
                      <ChartContainer config={donutConfig} className="h-[200px] w-[200px]">
                        <PieChart>
                          <Pie
                            data={donutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={0}
                          >
                            {donutData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-emerald-400">7h</span>
                        <span className="text-[9px] text-muted-foreground">AuraLOA</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2 flex flex-col justify-center gap-3">
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Economia Total</p>
                      <p className="text-3xl font-bold text-emerald-400">273h</p>
                      <p className="text-[10px] text-muted-foreground mt-1">economizadas por due diligence</p>
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tempo</p>
                        <p className="text-lg font-bold text-primary">-97.5%</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Custo</p>
                        <p className="text-lg font-bold text-primary">~R$ 85K</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-primary text-primary-foreground">Opcao C</Badge>
            <h2 className="text-sm font-semibold">Progress Bars Comparativas — Impacto Visual Direto</h2>
          </div>
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs font-medium">Due Diligence Manual</span>
                      </div>
                      <span className="text-sm font-bold text-red-400">280h</span>
                    </div>
                    <div className="h-8 rounded-md bg-muted/50 overflow-hidden relative">
                      <div
                        className="h-full rounded-md bg-gradient-to-r from-red-600 to-red-500"
                        style={{ width: "100%" }}
                      />
                      <div className="absolute inset-0 flex items-center px-3">
                        <span className="text-[10px] font-medium text-white">35 dias uteis — 2-3 analistas — sem cadeia de custodia</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-medium">AuraLOA Digital</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">7h</span>
                    </div>
                    <div className="h-8 rounded-md bg-muted/50 overflow-hidden relative">
                      <div
                        className="h-full rounded-md bg-gradient-to-r from-emerald-600 to-emerald-500"
                        style={{ width: "2.5%" }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 ml-1">1 dia util — automatizado — SHA-256 em cada payload</p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex-1 h-px bg-border" />
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      <span className="text-sm font-bold text-primary">40x mais rapido</span>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <div className="space-y-2">
                    {etapas.map((e) => (
                      <div key={e.etapa} className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground w-[70px] shrink-0 text-right">{e.etapa}</span>
                        <div className="flex-1 flex items-center gap-1">
                          <div className="h-3 rounded-sm bg-red-500/60" style={{ width: `${(e.manual / 120) * 100}%` }} />
                          <span className="text-[9px] font-mono text-red-400/70 shrink-0">{e.manual}h</span>
                        </div>
                        <div className="flex-1 flex items-center gap-1">
                          <div className="h-3 rounded-sm bg-emerald-500/60" style={{ width: `${Math.max((e.digital / 120) * 100, 1)}%` }} />
                          <span className="text-[9px] font-mono text-emerald-400/70 shrink-0">{e.digital}h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2 flex flex-col justify-center gap-3">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Reducao de Tempo</p>
                      <p className="text-4xl font-bold text-primary">97.5%</p>
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Manual</p>
                        <p className="text-lg font-bold text-red-400">R$ 84K</p>
                        <p className="text-[9px] text-muted-foreground">custo total</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">AuraLOA</p>
                        <p className="text-lg font-bold text-emerald-400">R$ 2.1K</p>
                        <p className="text-[9px] text-muted-foreground">custo total</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Economia por DD</p>
                      <p className="text-xl font-bold text-emerald-400">~R$ 82K</p>
                      <p className="text-[9px] text-muted-foreground">baseado em R$ 300/h analista senior</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="my-12 border-t border-border/50 pt-8">
        <h1 className="text-xl font-bold mb-1">Preview: Hero / Banner da Landing Page</h1>
        <p className="text-sm text-muted-foreground mb-8">3 opcoes de hero/banner — escolha a que preferir</p>

        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-primary text-primary-foreground">Opcao D</Badge>
              <h2 className="text-sm font-semibold">Split Layout — Texto + Dashboard Preview</h2>
            </div>
            <Card className="overflow-hidden">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-950/80 via-slate-950 to-purple-950/60" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-500/8 via-transparent to-transparent" />
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 p-8 md:p-12">
                  <div className="flex flex-col justify-center">
                    <Badge variant="secondary" className="w-fit mb-4 text-[10px] bg-blue-500/15 text-blue-300 border-blue-500/20">
                      <Shield className="w-3 h-3 mr-1" />
                      Due Diligence Digital
                    </Badge>
                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3 leading-tight">
                      Aura<span className="text-blue-400">LOA</span>
                    </h1>
                    <p className="text-sm text-blue-100/70 leading-relaxed mb-6 max-w-md">
                      Pesquisa e validacao de precatorios inscritos na LOA com cadeia de custodia SHA-256. Cruzamento automatico de 4 camadas orcamentarias.
                    </p>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">R$ 300B+</p>
                        <p className="text-[9px] text-blue-200/50 uppercase tracking-wider">Mercado total</p>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-400">40x</p>
                        <p className="text-[9px] text-blue-200/50 uppercase tracking-wider">Mais rapido</p>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">10+</p>
                        <p className="text-[9px] text-blue-200/50 uppercase tracking-wider">Tribunais</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Button className="bg-blue-600 hover:bg-blue-500 border-blue-500">
                        Acessar Plataforma
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline" className="text-blue-200 border-blue-400/30 bg-white/5">
                        Ver Dashboard
                      </Button>
                    </div>
                  </div>
                  <div className="hidden lg:flex flex-col gap-2.5 justify-center">
                    <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="p-1.5 rounded bg-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] text-white/90 font-medium">Dotacao LOA 2025</p>
                          <p className="text-[10px] text-white/40">7 acoes orcamentarias verificadas</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-400">R$ 44.5B</span>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="p-1.5 rounded bg-blue-500/20">
                          <Database className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] text-white/90 font-medium">Execucao Orcamentaria</p>
                          <p className="text-[10px] text-white/40">Portal da Transparencia API</p>
                        </div>
                        <span className="text-xs font-bold text-blue-400">R$ 38.2B</span>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="p-1.5 rounded bg-amber-500/20">
                          <Scale className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] text-white/90 font-medium">Estoque CNJ DataJud</p>
                          <p className="text-[10px] text-white/40">TRF1-TRF6 | 300K+ processos</p>
                        </div>
                        <Badge className="text-[9px] bg-amber-500/20 text-amber-300 border-amber-500/20">Live</Badge>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="p-1.5 rounded bg-purple-500/20">
                          <Hash className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] text-white/90 font-medium">Evidencia SHA-256</p>
                          <p className="text-[10px] text-white/40 font-mono">a3f2b1c8d4e5...7e9f</p>
                        </div>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-primary text-primary-foreground">Opcao E</Badge>
              <h2 className="text-sm font-semibold">Banner Fintech — Gradiente + Contadores</h2>
            </div>
            <Card className="overflow-hidden">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-blue-950/90 to-slate-950" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-blue-500/8 blur-3xl" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[200px] rounded-full bg-purple-500/5 blur-3xl" />
                <div className="relative z-10 px-8 md:px-12 py-12 md:py-16 text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-blue-200 font-medium">Plataforma ativa — dados em tempo real</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3">
                    Aura<span className="text-blue-400">LOA</span>
                  </h1>
                  <p className="text-sm md:text-base text-blue-100/60 max-w-xl mx-auto leading-relaxed mb-8">
                    Due diligence digital de precatorios com cadeia de custodia criptografica.
                    4 camadas de cruzamento orcamentario. Anti-alucinacao. Dados reais.
                  </p>

                  <div className="flex items-center justify-center gap-6 md:gap-10 mb-8">
                    <div>
                      <p className="text-3xl md:text-4xl font-bold text-white">R$ 300B<span className="text-lg text-blue-400">+</span></p>
                      <p className="text-[10px] text-blue-200/40 uppercase tracking-widest mt-1">Mercado de precatorios</p>
                    </div>
                    <div className="w-px h-12 bg-white/10" />
                    <div>
                      <p className="text-3xl md:text-4xl font-bold text-emerald-400">40<span className="text-lg">x</span></p>
                      <p className="text-[10px] text-blue-200/40 uppercase tracking-widest mt-1">Mais rapido que manual</p>
                    </div>
                    <div className="w-px h-12 bg-white/10" />
                    <div>
                      <p className="text-3xl md:text-4xl font-bold text-white">97<span className="text-lg text-blue-400">%</span></p>
                      <p className="text-[10px] text-blue-200/40 uppercase tracking-widest mt-1">Economia de tempo</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2.5 mb-8">
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-500 border-blue-500">
                      Acessar Plataforma
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                    <Button size="lg" variant="outline" className="text-blue-200 border-blue-400/25 bg-white/5 backdrop-blur-sm">
                      Ver Dashboard Publico
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {["Portal da Transparencia", "SIOP", "CNJ DataJud", "TRF1-6", "TJSP"].map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 text-[9px] text-blue-200/40 px-2 py-0.5 rounded border border-blue-400/10 bg-blue-500/5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/60" />
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-primary text-primary-foreground">Opcao F</Badge>
              <h2 className="text-sm font-semibold">Card Central — Glow + Pipeline Integrado</h2>
            </div>
            <Card className="overflow-hidden">
              <div className="relative bg-background">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/3 via-transparent to-transparent" />
                <div className="relative z-10 px-8 md:px-12 py-12 md:py-16 max-w-4xl mx-auto">
                  <div className="text-center mb-8">
                    <Badge variant="secondary" className="mb-4 text-[10px]">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Pesquisa Orcamentaria
                    </Badge>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                      Aura<span className="text-primary">LOA</span>
                    </h1>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed mb-5">
                      Pesquisa e validacao de precatorios com cadeia de custodia SHA-256.
                      Dados reais. 4 camadas orcamentarias. Anti-alucinacao.
                    </p>
                    <div className="flex items-center justify-center gap-2.5 mb-8">
                      <Button>
                        Acessar Plataforma
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline">
                        Ver Dashboard
                      </Button>
                    </div>
                  </div>

                  <Card className="relative overflow-hidden" style={{ boxShadow: "0 0 60px -12px hsla(217, 91%, 50%, 0.15)" }}>
                    <CardContent className="p-0">
                      <div className="grid grid-cols-5 border-b border-border/50">
                        {[
                          { icon: Database, label: "Coleta", color: "text-blue-400", desc: "APIs oficiais" },
                          { icon: Layers, label: "Cruzamento", color: "text-purple-400", desc: "4 camadas" },
                          { icon: Search, label: "Validacao", color: "text-amber-400", desc: "Anti-mock" },
                          { icon: Hash, label: "Evidencia", color: "text-emerald-400", desc: "SHA-256" },
                          { icon: FileCheck, label: "Entrega", color: "text-primary", desc: "Auditavel" },
                        ].map((step, idx) => (
                          <div key={step.label} className={`p-3 text-center ${idx < 4 ? "border-r border-border/50" : ""}`}>
                            <step.icon className={`w-4 h-4 mx-auto mb-1.5 ${step.color}`} />
                            <p className="text-[10px] font-medium mb-0.5">{step.label}</p>
                            <p className="text-[9px] text-muted-foreground">{step.desc}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 divide-x divide-border/50">
                        <div className="p-4 text-center">
                          <p className="text-xl font-bold text-emerald-400">R$ 300B+</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">Mercado total</p>
                        </div>
                        <div className="p-4 text-center">
                          <p className="text-xl font-bold">1.2M</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">Processos</p>
                        </div>
                        <div className="p-4 text-center">
                          <p className="text-xl font-bold text-primary">10+</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">Tribunais</p>
                        </div>
                        <div className="p-4 text-center">
                          <p className="text-xl font-bold text-emerald-400">40x</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">Mais rapido</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 rounded-md bg-muted/30 border border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          Pagina de preview temporaria — escolha as opcoes preferidas (graficos: A/B/C, hero: D/E/F) e elas serao aplicadas na landing page.
        </p>
      </div>
    </div>
  );
}
