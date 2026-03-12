import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicTopbar } from "@/components/public-topbar";
import { PublicFooter } from "@/components/public-footer";
import heroBgPath from "@assets/hero-dashboard-bg.png";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, Area, AreaChart, CartesianGrid, Cell, PieChart, Pie, ResponsiveContainer, LabelList, Tooltip, Legend, RadialBarChart, RadialBar } from "recharts";
import {
  Search,
  Shield,
  Layers,
  Phone,
  Globe,
  FileCheck,
  ArrowRight,
  Hash,
  Database,
  CheckCircle2,
  FileSearch,
  Send,
  Zap,
  TrendingUp,
  BarChart3,
  Clock,
  Users,
  FileSpreadsheet,
  Scale,
  Sparkles,
  Lock,
  Activity,
} from "lucide-react";

const loaProjectionData = [
  { year: "2025", federal: 48.2, estadual: 55.1, municipal: 28.3 },
  { year: "2026", federal: 52.7, estadual: 60.5, municipal: 31.2 },
  { year: "2027", federal: 57.1, estadual: 66.3, municipal: 34.8 },
  { year: "2028", federal: 62.4, estadual: 72.0, municipal: 38.5 },
];

const esferaBreakdownData = [
  { esfera: "Federal", valor: 100, fill: "hsl(217 80% 58%)" },
  { esfera: "Estadual", valor: 130, fill: "hsl(155 55% 48%)" },
  { esfera: "Municipal", valor: 70, fill: "hsl(220 20% 52%)" },
];

const donutData = [
  { name: "Federal", value: 100, fill: "hsl(217 80% 58%)" },
  { name: "Estadual", value: 130, fill: "hsl(155 55% 48%)" },
  { name: "Municipal", value: 70, fill: "hsl(220 20% 52%)" },
];

const tribunaisData = [
  { tribunal: "TRF3", processos: 9250, valor: 42.1, fill: "hsl(217 80% 58%)" },
  { tribunal: "TRF4", processos: 8900, valor: 38.7, fill: "hsl(210 65% 52%)" },
  { tribunal: "TRF6", processos: 7200, valor: 31.2, fill: "hsl(200 55% 48%)" },
  { tribunal: "TRF1", processos: 5100, valor: 22.8, fill: "hsl(220 40% 55%)" },
  { tribunal: "TRF5", processos: 4300, valor: 18.9, fill: "hsl(230 35% 52%)" },
  { tribunal: "TRF2", processos: 3800, valor: 15.6, fill: "hsl(155 55% 48%)" },
];

const timelineCompareData = [
  { etapa: "Coleta de dados", manual: 120, digital: 3 },
  { etapa: "Cruzamento", manual: 80, digital: 2 },
  { etapa: "Validacao", manual: 40, digital: 1 },
  { etapa: "Evidencia", manual: 24, digital: 0.5 },
  { etapa: "Relatorio", manual: 16, digital: 0.5 },
];

const timelineChartConfig = {
  manual: { label: "Manual", color: "hsl(0 70% 50%)" },
  digital: { label: "AuraLOA", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const manualSteps = [
  {
    icon: Users,
    title: "Coleta Manual de Dados",
    duration: "~120 horas",
    description: "Acesso individual a cada tribunal (TRF1-6, TJSP), Portal da Transparencia, SIOP. Consulta processo por processo.",
  },
  {
    icon: FileSpreadsheet,
    title: "Cruzamento em Planilhas",
    duration: "~80 horas",
    description: "Montagem manual de planilhas cruzando dotacao x execucao x estoque. Copiar/colar dados de fontes distintas.",
  },
  {
    icon: Search,
    title: "Validacao Individual",
    duration: "~40 horas",
    description: "Conferencia manual de cada valor. Busca de PDF oficial nos sites dos tribunais. Comparacao valor a valor.",
  },
  {
    icon: FileCheck,
    title: "Montagem de Evidencia",
    duration: "~24 horas",
    description: "Print screens, download de documentos, organizacao em pastas. Sem hash, sem garantia de integridade.",
  },
  {
    icon: Scale,
    title: "Relatorio Final",
    duration: "~16 horas",
    description: "Compilacao dos dados em relatorio. Revisao. Sem cadeia de custodia digital auditavel.",
  },
];

const digitalSteps = [
  {
    icon: Zap,
    title: "Coleta Automatizada",
    duration: "~3 horas",
    description: "APIs oficiais (Portal da Transparencia, DataJud, SIOP) consultadas automaticamente. 10.000+ processos/consulta.",
  },
  {
    icon: Layers,
    title: "Cruzamento 4 Camadas",
    duration: "~2 horas",
    description: "Dotacao x Execucao x Estoque x Valores PDF cruzados automaticamente com matching por acao orcamentaria.",
  },
  {
    icon: Shield,
    title: "Validacao com Anti-Alucinacao",
    duration: "~1 hora",
    description: "Guards automaticos verificam cada dado. Zero mock. Fonte oficial validada. DPO locks ativos.",
  },
  {
    icon: Hash,
    title: "Evidencia SHA-256",
    duration: "~30 min",
    description: "Hash automatico de cada payload. Raw preservado. Timestamps ISO. Cadeia de custodia integra.",
  },
  {
    icon: Sparkles,
    title: "Relatorio Instantaneo",
    duration: "~30 min",
    description: "CSV completo com 4 camadas, pendentes, valores e metadados. Exportacao em 1 clique.",
  },
];

const areaChartConfig = {
  federal: { label: "Federal", color: "hsl(var(--chart-1))" },
  estadual: { label: "Estadual", color: "hsl(var(--chart-2))" },
  municipal: { label: "Municipal", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const barChartConfig = {
  valor: { label: "R$ Bilhoes", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const tribunaisChartConfig = {
  valor: { label: "R$ Bilhoes", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const donutChartConfig = {
  Federal: { label: "Federal", color: "hsl(217 80% 58%)" },
  Estadual: { label: "Estadual", color: "hsl(155 55% 48%)" },
  Municipal: { label: "Municipal", color: "hsl(220 20% 52%)" },
} satisfies ChartConfig;

const pipelineSteps = [
  {
    icon: Database,
    title: "Coleta",
    description: "Portal da Transparencia, SIOP, CNJ DataJud e Tribunais",
    hash: "a3f2b1c8d4e5...",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: FileSearch,
    title: "Validacao",
    description: "Cruzamento de dotacao, execucao e estoque orcamentario",
    hash: "7e9f0a2b3c4d...",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    icon: Layers,
    title: "Cruzamento",
    description: "4 camadas: Dotacao x Execucao x Estoque x Valores PDF",
    hash: "b5d8e1f4a7c0...",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  {
    icon: Shield,
    title: "Evidencia",
    description: "SHA-256 de cada payload, timestamps e raw payloads preservados",
    hash: "c9e2d5f8a1b4...",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    icon: Send,
    title: "Entrega",
    description: "Pacote auditavel com cadeia de custodia completa",
    hash: "f1a4d7e0b3c6...",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
];

const features = [
  {
    icon: Search,
    title: "Pesquisa LOA",
    description: "Pesquisa e validacao de precatorios inscritos na Lei Orcamentaria Anual com dados reais.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Shield,
    title: "Cadeia de Custodia",
    description: "SHA-256 e evidencias rastreaveis para cada dado coletado. Auditoria completa.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Layers,
    title: "Cruzamento 4 Camadas",
    description: "Dotacao x Execucao x Estoque x Valores. Visao integrada do ciclo orcamentario.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: Phone,
    title: "Contato do Credor",
    description: "Email, telefone, dados comerciais/pessoais, OAB, CPF e CNPJ do credor.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: Globe,
    title: "Cobertura Nacional",
    description: "Federal (TRF1-6), Estadual e Municipal. Todas as esferas do poder judiciario.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: FileCheck,
    title: "Anti-Alucinacao",
    description: "Dados reais de fontes oficiais. Zero mock. Zero fabricacao. Evidencia verificavel.",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
];

const dataSources = [
  "Portal da Transparencia",
  "SIOP",
  "CNJ DataJud",
  "TRF1",
  "TRF2",
  "TRF3",
  "TRF4",
  "TRF5",
  "TRF6",
  "TJSP",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicTopbar />

      <section className="relative overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0">
          <img
            src={heroBgPath}
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: 0.12, filter: "blur(1px) saturate(0.6)" }}
            aria-hidden="true"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(225_15%_6%/0.75)] via-[hsl(220_30%_8%/0.88)] to-[hsl(225_15%_6%)]" />
        <div className="absolute top-0 left-1/3 w-[700px] h-[400px] rounded-full bg-blue-600/[0.06] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] rounded-full bg-indigo-500/[0.04] blur-[100px]" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-400/15 bg-blue-500/[0.08] mb-6" data-testid="badge-beta">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-blue-200/80 font-medium tracking-wide">Plataforma ativa — dados em tempo real</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-4 leading-[1.1]" data-testid="text-hero-title">
              Inteligência orçamentária para{" "}
              <span className="relative">
                <span className="text-blue-400">análise profissional</span>
                <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500/0 via-blue-400/60 to-blue-500/0" />
              </span>
              <br />
              <span className="text-white/90">de precatórios.</span>
            </h1>

            <p className="text-sm md:text-base text-white/60 max-w-lg mx-auto leading-relaxed mb-10">
              O AuraLOA transforma dados da LOA, tribunais e execução orçamentária em evidências estruturadas para decisões seguras.
            </p>

            <div className="flex items-center justify-center gap-3 mb-12">
              <Link href="/login">
                <Button size="lg" className="h-10 px-6 text-sm" data-testid="button-cta-hero">
                  Acessar Plataforma
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <a href="#overview">
                <Button size="lg" variant="outline" className="h-10 px-6 text-sm" data-testid="button-view-dashboard">
                  Ver Dashboard
                </Button>
              </a>
            </div>

            <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-white/[0.06] max-w-lg mx-auto bg-white/[0.03]">
              <div className="p-4 bg-white/[0.02]">
                <p className="text-2xl md:text-3xl font-bold text-white">R$ 300B<span className="text-sm text-blue-400">+</span></p>
                <p className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Mercado Total</p>
              </div>
              <div className="p-4 bg-white/[0.02] border-x border-white/[0.06]">
                <p className="text-2xl md:text-3xl font-bold text-emerald-400">40<span className="text-sm">x</span></p>
                <p className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Mais rapido</p>
              </div>
              <div className="p-4 bg-white/[0.02]">
                <p className="text-2xl md:text-3xl font-bold text-white">97<span className="text-sm text-blue-400">%</span></p>
                <p className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Economia</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap mt-8" data-testid="badges-data-sources">
            {["Portal da Transparencia", "SIOP", "CNJ DataJud", "TRF1-6", "TJSP"].map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-[9px] text-white/40 px-2 py-1 rounded-md border border-white/[0.06] bg-white/[0.02]">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/60" />
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(222_9%_9%)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-lg font-semibold mb-1.5 text-white/90" data-testid="text-features-title">
              Funcionalidades
            </h2>
            <p className="text-sm text-white/50 max-w-md mx-auto">
              Ferramenta completa para pesquisa, validacao e auditoria de precatorios.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-white/[0.02] border-white/[0.06] hover-elevate" data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${feature.bg} shrink-0 mt-0.5`}>
                      <feature.icon className={`w-4 h-4 ${feature.color}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-1 text-white/85">{feature.title}</h3>
                      <p className="text-xs text-white/50 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(220_7%_16%)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="w-4 h-4 text-blue-400" />
                <h2 className="text-lg font-semibold text-white/90" data-testid="text-timeline-title">
                  Due Diligence: Manual vs Digital
                </h2>
              </div>
              <p className="text-xs text-white/45">
                Comparativo de tempo entre due diligence tradicional e a plataforma AuraLOA
              </p>
            </div>
            <div className="flex items-center gap-4 text-[10px] mt-3 md:mt-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500/70 inline-block" />
                <span className="text-white/50">Manual (~280h)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70 inline-block" />
                <span className="text-white/50">AuraLOA (~7h)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6">
            <div className="lg:col-span-3">
              <Card className="bg-white/[0.02] border-white/[0.06]">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-white/40" data-testid="text-chart-timeline">Tempo por Etapa (horas)</h3>
                    <Badge variant="outline" className="text-[9px] font-mono text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.06]">
                      40x mais rapido
                    </Badge>
                  </div>
                  <ChartContainer config={timelineChartConfig} className="h-[220px] w-full">
                    <BarChart data={timelineCompareData} layout="vertical" accessibilityLayer barGap={2} barSize={14}>
                      <CartesianGrid horizontal={false} stroke="hsl(220 10% 18%)" strokeDasharray="3 3" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(220 10% 50%)" }} tickFormatter={(v) => `${v}h`} />
                      <YAxis type="category" dataKey="etapa" tickLine={false} axisLine={false} width={100} tick={{ fontSize: 11, fill: "hsl(220 10% 50%)" }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="manual" fill="hsl(0 65% 42%)" radius={[0, 3, 3, 0]} name="Manual" />
                      <Bar dataKey="digital" fill="hsl(142 72% 42%)" radius={[0, 3, 3, 0]} name="AuraLOA" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 gap-3">
              <Card className="bg-white/[0.02] border-white/[0.06]" data-testid="kpi-manual-total">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Due Diligence Manual</p>
                  <div>
                    <p className="text-2xl font-bold text-red-400">280h</p>
                    <p className="text-[10px] text-white/40 mt-0.5">~35 dias uteis</p>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-red-400/60">
                    <Users className="w-3 h-3" />
                    2-3 analistas
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.02] border-emerald-500/15" data-testid="kpi-digital-total">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">AuraLOA Digital</p>
                  <div>
                    <p className="text-2xl font-bold text-emerald-400">7h</p>
                    <p className="text-[10px] text-white/40 mt-0.5">~1 dia util</p>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-400/60">
                    <Zap className="w-3 h-3" />
                    Automatizado
                  </div>
                </CardContent>
              </Card>
              <Card className="col-span-2 bg-white/[0.02] border-white/[0.06]" data-testid="kpi-economia">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Economia de Tempo</p>
                      <p className="text-2xl font-bold text-blue-400">97.5%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Reducao de Custo</p>
                      <p className="text-2xl font-bold text-blue-400">~R$ 85K</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/35 mt-2">Baseado em custo/hora de analista senior de compliance (R$ 300/h)</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="bg-white/[0.02] border-white/[0.06]">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-red-500/70 inline-block" />
                  <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">Processo Manual</h3>
                  <Badge variant="outline" className="text-[9px] ml-auto text-red-400/80 border-red-500/20 bg-red-500/[0.05]">~280 horas</Badge>
                </div>
                <div className="space-y-3">
                  {manualSteps.map((step, idx) => (
                    <div key={step.title} className="flex items-start gap-3" data-testid={`timeline-manual-step-${idx}`}>
                      <div className="flex flex-col items-center shrink-0">
                        <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/10">
                          <step.icon className="w-3 h-3 text-red-400/70" />
                        </div>
                        {idx < manualSteps.length - 1 && (
                          <div className="w-px h-full min-h-[24px] bg-red-500/10 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white/70">{step.title}</span>
                          <span className="text-[9px] font-mono text-red-400/50">{step.duration}</span>
                        </div>
                        <p className="text-[10px] text-white/40 leading-relaxed mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.02] border-emerald-500/15">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-500/70 inline-block" />
                  <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">AuraLOA Digital</h3>
                  <Badge variant="outline" className="text-[9px] ml-auto text-emerald-400/80 border-emerald-500/20 bg-emerald-500/[0.05]">~7 horas</Badge>
                </div>
                <div className="space-y-3">
                  {digitalSteps.map((step, idx) => (
                    <div key={step.title} className="flex items-start gap-3" data-testid={`timeline-digital-step-${idx}`}>
                      <div className="flex flex-col items-center shrink-0">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/10">
                          <step.icon className="w-3 h-3 text-emerald-400/70" />
                        </div>
                        {idx < digitalSteps.length - 1 && (
                          <div className="w-px h-full min-h-[24px] bg-emerald-500/10 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white/70">{step.title}</span>
                          <span className="text-[9px] font-mono text-emerald-400/50">{step.duration}</span>
                        </div>
                        <p className="text-[10px] text-white/40 leading-relaxed mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="overview" className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(222_9%_9%)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="bg-white/[0.02] border-white/[0.06]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-white/40" data-testid="text-chart-breakdown">Estoque por Esfera</h3>
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
                      { label: "Federal", color: "hsl(217 80% 58%)" },
                      { label: "Estadual", color: "hsl(155 55% 48%)" },
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
                        <stop offset="5%" stopColor="hsl(217 80% 58%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(217 80% 58%)" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="gradEstadual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(155 55% 48%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(155 55% 48%)" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="gradMunicipal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(220 20% 52%)" stopOpacity={0.3} />
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
                    <Area type="monotone" dataKey="federal" stackId="1" fill="url(#gradFederal)" stroke="hsl(217 80% 58%)" strokeWidth={2} />
                    <Area type="monotone" dataKey="estadual" stackId="1" fill="url(#gradEstadual)" stroke="hsl(155 55% 48%)" strokeWidth={2} />
                    <Area type="monotone" dataKey="municipal" stackId="1" fill="url(#gradMunicipal)" stroke="hsl(220 20% 52%)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="pipeline" className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(220_7%_16%)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <Lock className="w-4 h-4 text-blue-400" />
              <h2 className="text-lg font-semibold text-white/90" data-testid="text-custody-title">
                Cadeia de Custodia
              </h2>
            </div>
            <p className="text-xs text-white/45 max-w-md mx-auto">
              Cada etapa gera evidencias com hash SHA-256, garantindo rastreabilidade total.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {pipelineSteps.map((step, idx) => (
              <div key={step.title} className="flex items-center gap-2">
                <Card className={`flex-1 bg-white/[0.02] ${step.border} hover:bg-white/[0.04] transition-colors`} data-testid={`card-pipeline-${step.title.toLowerCase()}`}>
                  <CardContent className="p-4 text-center">
                    <div className={`p-2 rounded-lg ${step.bg} w-fit mx-auto mb-3`}>
                      <step.icon className={`w-4 h-4 ${step.color}`} />
                    </div>
                    <h3 className="text-xs font-medium mb-1 text-white/80">{step.title}</h3>
                    <p className="text-[10px] text-white/40 leading-relaxed mb-3">{step.description}</p>
                    <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-white/30 px-2 py-1 rounded bg-white/[0.03] border border-white/[0.04]">
                      <Hash className="w-2.5 h-2.5" />
                      {step.hash}
                    </div>
                  </CardContent>
                </Card>
                {idx < pipelineSteps.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-white/30 shrink-0 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(222_9%_9%)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-lg font-semibold mb-1.5 text-white/90" data-testid="text-sources-title">
            Fontes Oficiais
          </h2>
          <p className="text-xs text-white/45 mb-8 max-w-md mx-auto">
            Dados exclusivamente de fontes governamentais e judiciais.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {dataSources.map((source) => (
              <Badge key={source} variant="outline" className="text-[11px] py-1.5 px-3 font-normal text-white/55 border-white/[0.08] bg-white/[0.02]" data-testid={`badge-source-${source.toLowerCase().replace(/\s+/g, '-')}`}>
                <CheckCircle2 className="w-3 h-3 mr-1.5 text-emerald-500/60" />
                {source}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(220_7%_16%)]">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <Card className="bg-white/[0.02] border-blue-500/15 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/[0.04] via-transparent to-purple-600/[0.03]" />
            <CardContent className="p-8 md:p-10 text-center relative z-10">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/15 w-fit mx-auto mb-4">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold mb-2 text-white/90" data-testid="text-cta-title">
                Comece Agora
              </h2>
              <p className="text-sm text-white/50 mb-6 max-w-sm mx-auto">
                Acesse a plataforma e pesquise precatorios com cadeia de custodia completa.
              </p>
              <Link href="/login">
                <Button className="h-10 px-6" data-testid="button-cta-footer">
                  Acessar Plataforma
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-6">
        <PublicFooter />
      </div>
    </div>
  );
}
