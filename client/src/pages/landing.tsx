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
import { Bar, BarChart, XAxis, YAxis, Area, AreaChart, CartesianGrid, Cell } from "recharts";
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
} from "lucide-react";

const loaProjectionData = [
  { year: "2025", federal: 48.2, estadual: 55.1, municipal: 28.3 },
  { year: "2026", federal: 52.7, estadual: 60.5, municipal: 31.2 },
  { year: "2027", federal: 57.1, estadual: 66.3, municipal: 34.8 },
  { year: "2028", federal: 62.4, estadual: 72.0, municipal: 38.5 },
];

const esferaBreakdownData = [
  { esfera: "Federal", valor: 100 },
  { esfera: "Estadual", valor: 130 },
  { esfera: "Municipal", valor: 70 },
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

const pipelineSteps = [
  {
    icon: Database,
    title: "Coleta",
    description: "Portal da Transparencia, SIOP, CNJ DataJud e Tribunais",
    hash: "a3f2b1c8d4e5...",
  },
  {
    icon: FileSearch,
    title: "Validacao",
    description: "Cruzamento de dotacao, execucao e estoque orcamentario",
    hash: "7e9f0a2b3c4d...",
  },
  {
    icon: Layers,
    title: "Cruzamento",
    description: "4 camadas: Dotacao x Execucao x Estoque x Valores PDF",
    hash: "b5d8e1f4a7c0...",
  },
  {
    icon: Shield,
    title: "Evidencia",
    description: "SHA-256 de cada payload, timestamps e raw payloads preservados",
    hash: "c9e2d5f8a1b4...",
  },
  {
    icon: Send,
    title: "Entrega",
    description: "Pacote auditavel com cadeia de custodia completa",
    hash: "f1a4d7e0b3c6...",
  },
];

const features = [
  {
    icon: Search,
    title: "Pesquisa LOA",
    description: "Pesquisa e validacao de precatorios inscritos na Lei Orcamentaria Anual com dados reais.",
  },
  {
    icon: Shield,
    title: "Cadeia de Custodia",
    description: "SHA-256 e evidencias rastreaveis para cada dado coletado. Auditoria completa.",
  },
  {
    icon: Layers,
    title: "Cruzamento 4 Camadas",
    description: "Dotacao x Execucao x Estoque x Valores. Visao integrada do ciclo orcamentario.",
  },
  {
    icon: Phone,
    title: "Contato do Credor",
    description: "Email, telefone, dados comerciais/pessoais, OAB, CPF e CNPJ do credor.",
  },
  {
    icon: Globe,
    title: "Cobertura Nacional",
    description: "Federal (TRF1-6), Estadual e Municipal. Todas as esferas do poder judiciario.",
  },
  {
    icon: FileCheck,
    title: "Anti-Alucinacao",
    description: "Dados reais de fontes oficiais. Zero mock. Zero fabricacao. Evidencia verificavel.",
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
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-primary/15">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight">AuraLOA</span>
              <span className="text-[10px] text-muted-foreground ml-2 hidden sm:inline">Pesquisa Orcamentaria de Precatorios</span>
            </div>
          </div>
          <Link href="/login">
            <Button size="sm" data-testid="button-header-login">
              Acessar Plataforma
            </Button>
          </Link>
        </div>
      </header>

      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-4 text-[10px] font-medium" data-testid="badge-beta">
              <TrendingUp className="w-3 h-3 mr-1" />
              Plataforma de Pesquisa
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 leading-tight" data-testid="text-hero-title">
              Aura<span className="text-primary">LOA</span>
            </h1>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-6 max-w-lg">
              Pesquisa e validacao de precatorios com cadeia de custodia SHA-256.
              Dados reais de fontes oficiais. Cruzamento de 4 camadas orcamentarias.
            </p>
            <div className="flex items-center gap-2.5">
              <Link href="/login">
                <Button data-testid="button-cta-hero">
                  Acessar Plataforma
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
              <a href="#overview">
                <Button variant="outline" data-testid="button-view-dashboard">
                  Ver Dashboard
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-1" data-testid="text-features-title">
            Funcionalidades
          </h2>
          <p className="text-sm text-muted-foreground">
            Ferramenta completa para pesquisa, validacao e auditoria de precatorios.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((feature) => (
            <Card key={feature.title} className="hover-elevate" data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">
                    <feature.icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-0.5">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-12 md:py-16 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-semibold" data-testid="text-timeline-title">
                  Due Diligence: Manual vs Digital
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Comparativo de tempo entre due diligence tradicional e a plataforma AuraLOA
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500/80 inline-block" />
                <span className="text-muted-foreground">Manual (~280h)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80 inline-block" />
                <span className="text-muted-foreground">AuraLOA (~7h)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6">
            <div className="lg:col-span-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground" data-testid="text-chart-timeline">Tempo por Etapa (horas)</h3>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      40x mais rapido
                    </Badge>
                  </div>
                  <ChartContainer config={timelineChartConfig} className="h-[220px] w-full">
                    <BarChart data={timelineCompareData} layout="vertical" accessibilityLayer barGap={2} barSize={14}>
                      <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}h`} />
                      <YAxis type="category" dataKey="etapa" tickLine={false} axisLine={false} width={100} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="manual" fill="hsl(0 70% 45%)" radius={[0, 3, 3, 0]} name="Manual" />
                      <Bar dataKey="digital" fill="hsl(var(--chart-2))" radius={[0, 3, 3, 0]} name="AuraLOA" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 gap-3">
              <Card data-testid="kpi-manual-total">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Due Diligence Manual</p>
                  <div>
                    <p className="text-2xl font-bold text-red-400">280h</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">~35 dias uteis</p>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-red-400/70">
                    <Users className="w-3 h-3" />
                    2-3 analistas
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="kpi-digital-total">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">AuraLOA Digital</p>
                  <div>
                    <p className="text-2xl font-bold text-emerald-400">7h</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">~1 dia util</p>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-400/70">
                    <Zap className="w-3 h-3" />
                    Automatizado
                  </div>
                </CardContent>
              </Card>
              <Card className="col-span-2" data-testid="kpi-economia">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Economia de Tempo</p>
                      <p className="text-2xl font-bold text-primary">97.5%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Reducao de Custo</p>
                      <p className="text-2xl font-bold text-primary">~R$ 85K</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Baseado em custo/hora de analista senior de compliance (R$ 300/h)</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-500/80 inline-block" />
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Processo Manual</h3>
                  <Badge variant="outline" className="text-[9px] ml-auto text-red-400 border-red-400/30">~280 horas</Badge>
                </div>
                <div className="space-y-2.5">
                  {manualSteps.map((step, idx) => (
                    <div key={step.title} className="flex items-start gap-2.5" data-testid={`timeline-manual-step-${idx}`}>
                      <div className="flex flex-col items-center shrink-0">
                        <div className="p-1 rounded bg-red-500/10">
                          <step.icon className="w-3 h-3 text-red-400" />
                        </div>
                        {idx < manualSteps.length - 1 && (
                          <div className="w-px h-full min-h-[20px] bg-red-500/20 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{step.title}</span>
                          <span className="text-[9px] font-mono text-red-400/70">{step.duration}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card style={{ borderColor: "rgba(16, 185, 129, 0.2)" }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block" />
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AuraLOA Digital</h3>
                  <Badge variant="outline" className="text-[9px] ml-auto text-emerald-400 border-emerald-400/30">~7 horas</Badge>
                </div>
                <div className="space-y-2.5">
                  {digitalSteps.map((step, idx) => (
                    <div key={step.title} className="flex items-start gap-2.5" data-testid={`timeline-digital-step-${idx}`}>
                      <div className="flex flex-col items-center shrink-0">
                        <div className="p-1 rounded bg-emerald-500/10">
                          <step.icon className="w-3 h-3 text-emerald-400" />
                        </div>
                        {idx < digitalSteps.length - 1 && (
                          <div className="w-px h-full min-h-[20px] bg-emerald-500/20 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{step.title}</span>
                          <span className="text-[9px] font-mono text-emerald-400/70">{step.duration}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="overview" className="py-12 md:py-16 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-semibold" data-testid="text-overview-title">
                  Visao Geral do Mercado
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Dados agregados do mercado de precatorios no Brasil
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
              Dados publicos
            </Badge>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card data-testid="kpi-total-precatorios">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Estoque Total</p>
                <p className="text-xl font-bold text-emerald-400">R$ 300B+</p>
                <p className="text-[10px] text-muted-foreground mt-1">Em precatorios no Brasil</p>
              </CardContent>
            </Card>
            <Card data-testid="kpi-processos-ativos">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Processos Ativos</p>
                <p className="text-xl font-bold text-emerald-400">~1.2M</p>
                <p className="text-[10px] text-muted-foreground mt-1">Precatorios e RPVs</p>
              </CardContent>
            </Card>
            <Card data-testid="kpi-loa-2026">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">LOA 2026</p>
                <p className="text-xl font-bold text-primary">R$ 144B</p>
                <p className="text-[10px] text-muted-foreground mt-1">Projecao consolidada</p>
              </CardContent>
            </Card>
            <Card data-testid="kpi-tribunais">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tribunais</p>
                <p className="text-xl font-bold">10+</p>
                <p className="text-[10px] text-muted-foreground mt-1">TRF1-6, TJSP e mais</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground" data-testid="text-chart-breakdown">Estoque por Esfera</h3>
                  <span className="text-[10px] text-muted-foreground">R$ Bilhoes</span>
                </div>
                <ChartContainer config={barChartConfig} className="h-[200px] w-full">
                  <BarChart data={esferaBreakdownData} accessibilityLayer>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="esfera" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="valor" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground" data-testid="text-chart-projection">Projecao LOA 2025-2028</h3>
                  <span className="text-[10px] text-muted-foreground">R$ Bilhoes</span>
                </div>
                <ChartContainer config={areaChartConfig} className="h-[200px] w-full">
                  <AreaChart data={loaProjectionData} accessibilityLayer>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="federal" stackId="1" fill="hsl(var(--chart-1))" stroke="hsl(var(--chart-1))" fillOpacity={0.15} strokeWidth={1.5} />
                    <Area type="monotone" dataKey="estadual" stackId="1" fill="hsl(var(--chart-2))" stroke="hsl(var(--chart-2))" fillOpacity={0.15} strokeWidth={1.5} />
                    <Area type="monotone" dataKey="municipal" stackId="1" fill="hsl(var(--chart-3))" stroke="hsl(var(--chart-3))" fillOpacity={0.15} strokeWidth={1.5} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold" data-testid="text-custody-title">
              Cadeia de Custodia
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Cada etapa gera evidencias com hash SHA-256, garantindo rastreabilidade total.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {pipelineSteps.map((step, idx) => (
            <div key={step.title} className="flex items-center gap-2">
              <Card className="flex-1 hover-elevate" data-testid={`card-pipeline-${step.title.toLowerCase()}`}>
                <CardContent className="p-3 text-center">
                  <div className="p-1.5 rounded-md bg-primary/10 w-fit mx-auto mb-2">
                    <step.icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="text-xs font-medium mb-0.5">{step.title}</h3>
                  <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{step.description}</p>
                  <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-muted-foreground/60">
                    <Hash className="w-2.5 h-2.5" />
                    {step.hash}
                  </div>
                </CardContent>
              </Card>
              {idx < pipelineSteps.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 hidden md:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="py-12 md:py-16 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-lg font-semibold mb-1" data-testid="text-sources-title">
            Fontes Oficiais
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            Dados exclusivamente de fontes governamentais e judiciais.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {dataSources.map((source) => (
              <Badge key={source} variant="outline" className="text-[11px] py-1 px-2.5 font-normal" data-testid={`badge-source-${source.toLowerCase().replace(/\s+/g, '-')}`}>
                <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-500" />
                {source}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <Card className="border-primary/20">
            <CardContent className="p-8 text-center">
              <h2 className="text-lg font-semibold mb-2" data-testid="text-cta-title">
                Comece Agora
              </h2>
              <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
                Acesse a plataforma e pesquise precatorios com cadeia de custodia completa.
              </p>
              <Link href="/login">
                <Button data-testid="button-cta-footer">
                  Acessar Plataforma
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border/50 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground" data-testid="text-footer">
            AuraLOA - Pesquisa Orcamentaria de Precatorios
          </p>
          <p className="text-[11px] text-muted-foreground">
            Cadeia de custodia com <span className="font-mono">SHA-256</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
