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
import { Bar, BarChart, XAxis, YAxis, Area, AreaChart, CartesianGrid } from "recharts";
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
  PackageCheck,
  Send,
  ChevronRight,
} from "lucide-react";

const loaProjectionData = [
  { year: "2025", federal: 48.2, estadual: 55.1, municipal: 28.3 },
  { year: "2026", federal: 52.7, estadual: 60.5, municipal: 31.2 },
  { year: "2027", federal: 57.1, estadual: 66.3, municipal: 34.8 },
  { year: "2028", federal: 62.4, estadual: 72.0, municipal: 38.5 },
];

const esferaBreakdownData = [
  { esfera: "Federal", valor: 100, color: "hsl(217, 91%, 50%)" },
  { esfera: "Estadual", valor: 130, color: "hsl(142, 76%, 40%)" },
  { esfera: "Municipal", valor: 70, color: "hsl(24, 90%, 50%)" },
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
    description: "Dados oficiais de Portal da Transparencia, SIOP, CNJ DataJud e Tribunais",
    hash: "a3f2b1c8d4e5...",
  },
  {
    icon: FileSearch,
    title: "Validacao",
    description: "Verificacao cruzada de dotacao, execucao e estoque orcamentario",
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
    description: "SHA-256 de cada payload, timestamps ISO e raw payloads preservados",
    hash: "c9e2d5f8a1b4...",
  },
  {
    icon: Send,
    title: "Entrega",
    description: "Pacote de evidencia auditavel com cadeia de custodia completa",
    hash: "f1a4d7e0b3c6...",
  },
];

const features = [
  {
    icon: Search,
    title: "Pesquisa e Validacao LOA",
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

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(1)}B`;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-visible py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-purple-950 dark:from-blue-950/80 dark:via-slate-950 dark:to-purple-950/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-purple-500/10" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <Badge variant="secondary" className="mb-6 bg-blue-500/20 text-blue-200 border-blue-500/30" data-testid="badge-beta">
            <PackageCheck className="w-3 h-3 mr-1" />
            Plataforma de Pesquisa Orcamentaria
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight" data-testid="text-hero-title">
            Aura<span className="text-blue-400">LOA</span>
          </h1>
          <p className="text-lg md:text-xl text-blue-100/80 max-w-2xl mx-auto mb-8 leading-relaxed">
            Pesquisa e validacao de precatorios com cadeia de custodia SHA-256.
            Dados reais de fontes oficiais. Cruzamento de 4 camadas orcamentarias.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/login">
              <Button size="lg" className="bg-blue-600 border-blue-500" data-testid="button-cta-hero">
                Acessar Plataforma
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="#overview">
              <Button size="lg" variant="outline" className="text-blue-100 border-blue-400/40 bg-white/5 backdrop-blur-sm" data-testid="button-view-dashboard">
                Ver Dashboard Publico
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3" data-testid="text-features-title">
            Funcionalidades Principais
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Ferramenta completa para pesquisa, validacao e auditoria de precatorios no orcamento publico.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <Card key={feature.title} className="hover-elevate" data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardContent className="p-5">
                <div className="p-2 rounded-md bg-primary/10 w-fit mb-3">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="overview" className="py-16 md:py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3" data-testid="text-overview-title">
              Visao Geral do Mercado
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Dados agregados do mercado de precatorios no Brasil. Acesso publico.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card data-testid="kpi-total-precatorios">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Estoque Total Estimado</p>
                <p className="text-2xl font-bold">R$ 300B+</p>
                <p className="text-xs text-muted-foreground mt-1">Em precatorios no Brasil</p>
              </CardContent>
            </Card>
            <Card data-testid="kpi-processos-ativos">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Processos Ativos</p>
                <p className="text-2xl font-bold">~1.2M</p>
                <p className="text-xs text-muted-foreground mt-1">Precatorios e RPVs</p>
              </CardContent>
            </Card>
            <Card data-testid="kpi-loa-2026">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">LOA 2026 (Projecao)</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">R$ 144B</p>
                <p className="text-xs text-muted-foreground mt-1">Federal + Estadual + Municipal</p>
              </CardContent>
            </Card>
            <Card data-testid="kpi-tribunais">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Tribunais Cobertos</p>
                <p className="text-2xl font-bold">10+</p>
                <p className="text-xs text-muted-foreground mt-1">TRF1-6, TJSP e mais</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-1" data-testid="text-chart-breakdown">Estoque por Esfera</h3>
                <p className="text-xs text-muted-foreground mb-4">Distribuicao estimada em bilhoes (R$)</p>
                <ChartContainer config={barChartConfig} className="h-[220px] w-full">
                  <BarChart data={esferaBreakdownData} accessibilityLayer>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="esfera" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}B`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="valor" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-1" data-testid="text-chart-projection">Projecao LOA 2025-2028</h3>
                <p className="text-xs text-muted-foreground mb-4">Valores aproximados por esfera em bilhoes (R$)</p>
                <ChartContainer config={areaChartConfig} className="h-[220px] w-full">
                  <AreaChart data={loaProjectionData} accessibilityLayer>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="year" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}B`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="federal" stackId="1" fill="hsl(var(--chart-1))" stroke="hsl(var(--chart-1))" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="estadual" stackId="1" fill="hsl(var(--chart-2))" stroke="hsl(var(--chart-2))" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="municipal" stackId="1" fill="hsl(var(--chart-3))" stroke="hsl(var(--chart-3))" fillOpacity={0.3} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3" data-testid="text-custody-title">
            Cadeia de Custodia
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Cada etapa do pipeline gera evidencias com hash SHA-256, garantindo rastreabilidade total.
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-stretch gap-3">
          {pipelineSteps.map((step, idx) => (
            <div key={step.title} className="flex-1 flex flex-col md:flex-row items-center gap-3">
              <Card className="flex-1 w-full hover-elevate" data-testid={`card-pipeline-${step.title.toLowerCase()}`}>
                <CardContent className="p-5 text-center">
                  <div className="p-2 rounded-md bg-primary/10 w-fit mx-auto mb-3">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-sm">{step.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{step.description}</p>
                  <div className="flex items-center justify-center gap-1 text-[10px] font-mono text-muted-foreground">
                    <Hash className="w-3 h-3" />
                    {step.hash}
                  </div>
                </CardContent>
              </Card>
              {idx < pipelineSteps.length - 1 && (
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 hidden md:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 md:py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3" data-testid="text-sources-title">
            Fontes de Dados Oficiais
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Dados coletados exclusivamente de fontes governamentais e judiciais oficiais.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {dataSources.map((source) => (
              <Badge key={source} variant="outline" className="text-sm py-1.5 px-3" data-testid={`badge-source-${source.toLowerCase().replace(/\s+/g, '-')}`}>
                <CheckCircle2 className="w-3 h-3 mr-1.5 text-emerald-500" />
                {source}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="relative overflow-visible rounded-md p-10 md:p-16">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-purple-950 rounded-md" />
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3" data-testid="text-cta-title">
                Comece Agora
              </h2>
              <p className="text-blue-100/80 mb-6 max-w-md mx-auto">
                Acesse a plataforma e pesquise precatorios com cadeia de custodia completa.
              </p>
              <Link href="/login">
                <Button size="lg" className="bg-blue-600 border-blue-500" data-testid="button-cta-footer">
                  Acessar Plataforma
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-sm text-muted-foreground">
          <p data-testid="text-footer">AuraLOA - Plataforma de Pesquisa Orcamentaria de Precatorios</p>
        </div>
      </footer>
    </div>
  );
}
