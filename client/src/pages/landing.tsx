import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicTopbar } from "@/components/public-topbar";
import { PublicFooter } from "@/components/public-footer";
import { ValidadorPreliminarLOA } from "@/components/validador-preliminar";
import { MarketOverview } from "@/components/market-overview";
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
  Building2,
  Landmark,
} from "lucide-react";


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
    title: "Validacao de Fontes Oficiais",
    duration: "~1 hora",
    description: "Cada dado e verificado contra a fonte primaria (LOA, DataJud, Transparencia). Origem rastreavel e certificada.",
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
    description: "O motor central do AuraLOA. Cruzamento automatico de 4 camadas orcamentarias com dados reais do Portal da Transparencia, SIOP e CNJ DataJud.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    featured: true,
  },
  {
    icon: Shield,
    title: "Cadeia de Custódia",
    description: "Hash SHA-256 gerado automaticamente em cada etapa — da coleta ao relatório. Cada dado tem origem, timestamp e evidência verificável. Rastreabilidade jurídica completa.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40 hover:border-emerald-400/60",
    glow: "rgba(16,185,129,0.06)",
  },
  {
    icon: Layers,
    title: "Cruzamento 4 Camadas",
    description: "Cruza automaticamente Dotação × Execução × Estoque × Valores PDF. Detecta divergências, identifica recursos não utilizados e revela o status real de cada precatório.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/40 hover:border-purple-400/60",
    glow: "rgba(168,85,247,0.06)",
  },
  {
    icon: Phone,
    title: "Contato do Credor",
    description: "Localiza o titular do precatório com precisão: e-mail, telefone, OAB, CPF e CNPJ. Facilita negociações diretas, elimina intermediários e acelera a due diligence.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40 hover:border-amber-400/60",
    glow: "rgba(245,158,11,0.06)",
  },
  {
    icon: Globe,
    title: "Cobertura Nacional",
    description: "Abrange todos os tribunais federais (TRF1 a TRF6), estaduais e municipais. Do precatório federal ao estadual de São Paulo — uma única consulta, todas as esferas.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/40 hover:border-cyan-400/60",
    glow: "rgba(6,182,212,0.06)",
  },
  {
    icon: Landmark,
    title: "LOA 2024 a 2028",
    description: "Série histórica de 5 anos de LOA. Identifica precatórios inscritos no orçamento mas ainda não quitados — mapeando oportunidades reais de liquidez e risco de inadimplência.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40 hover:border-emerald-400/60",
    glow: "rgba(16,185,129,0.06)",
    highlight: true,
  },
  {
    icon: FileSpreadsheet,
    title: "Exportação e Relatórios",
    description: "Gera relatórios prontos para uso jurídico e compliance: CSV com 4 camadas cruzadas, valores atualizados, pendentes identificados e hashes SHA-256. Um clique, evidência completa.",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/40 hover:border-rose-400/60",
    glow: "rgba(244,63,94,0.06)",
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

        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 py-24 md:py-36">

          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-400/20 bg-blue-500/[0.08]" data-testid="badge-beta">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-blue-200/80 font-medium tracking-wide">Plataforma ativa — dados em tempo real</span>
            </div>
          </div>

          {/* Título — sem max-w restritivo */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight mb-6 leading-[1.08] text-center" data-testid="text-hero-title">
            Inteligência orçamentária para{" "}
            <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              análise profissional
            </span>{" "}
            de precatórios.
          </h1>

          {/* Subtexto + pipeline ciclo de vida */}
          <p className="text-lg md:text-xl text-white/55 max-w-3xl mx-auto leading-relaxed mb-8 text-center">
            O AuraLOA identifica e monitora todo ciclo de vida de um precatório desde
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-12 max-w-4xl mx-auto">
            {[
              "Processo Judicial",
              "Trânsito em Julgado",
              "Liquidação do Valor",
              "Expedição do Precatório",
              "Inclusão na LOA",
              "Pagamento",
            ].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                  <span className="text-[10px] font-bold text-blue-400/70 font-mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-xs font-medium text-slate-300">{step}</span>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Botões */}
          <div className="flex items-center justify-center gap-4 mb-16">
            <Link href="/login">
              <button
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full border border-slate-600 bg-slate-600 text-sm font-medium text-white hover:bg-slate-500 hover:border-slate-500 transition-colors"
                data-testid="button-cta-hero"
              >
                Acessar Plataforma
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <a href="#overview">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base" data-testid="button-view-dashboard">
                Ver Dashboard
              </Button>
            </a>
          </div>

          {/* KPI cards — largura total */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-[#0f172a]/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-8 text-left flex flex-col hover:border-blue-500/30 transition-colors" data-testid="kpi-hero-mercado">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-3">Mercado Total</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">R$ 300B</span>
                <span className="text-2xl font-bold text-blue-500">+</span>
              </div>
              <span className="text-slate-500 text-sm mt-2">Em precatórios no Brasil</span>
            </div>
            <div className="bg-[#0f172a]/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-8 text-left flex flex-col hover:border-cyan-500/30 transition-colors" data-testid="kpi-hero-performance">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-3">Performance</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-cyan-400">40x</span>
                <span className="text-lg font-medium text-slate-400">Mais rápido</span>
              </div>
              <span className="text-slate-500 text-sm mt-2">Que o processo manual</span>
            </div>
            <div className="bg-[#0f172a]/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-8 text-left flex flex-col hover:border-blue-500/30 transition-colors" data-testid="kpi-hero-impacto">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-3">Impacto</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">97%</span>
                <span className="text-lg font-medium text-slate-400">Economia</span>
              </div>
              <span className="text-slate-500 text-sm mt-2">De tempo e custo operacional</span>
            </div>
          </div>

          {/* Badges fontes */}
          <div className="flex items-center justify-center gap-2 flex-wrap" data-testid="badges-data-sources">
            {["Portal da Transparencia", "SIOP", "CNJ DataJud", "TRF1-6", "TJSP"].map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-xs text-white/40 px-3 py-1.5 rounded-md border border-white/[0.06] bg-white/[0.02]">
                <CheckCircle2 className="w-3 h-3 text-emerald-500/60" />
                {s}
              </span>
            ))}
          </div>

        </div>
      </section>

      <div className="max-w-[1400px] mx-auto">
        <ValidadorPreliminarLOA />
      </div>

      <section className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(222_9%_9%)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2" data-testid="text-features-title">
              <Layers className="text-blue-500 w-6 h-6" />
              Módulos de Inteligência
            </h2>
            <p className="text-slate-400">Ferramenta completa para pesquisa, validação e auditoria de precatórios.</p>
          </div>
          {/* Card destaque: Pesquisa LOA — coração do sistema */}
          {(() => {
            const featured = features.find((f) => (f as any).featured);
            const rest = features.filter((f) => !(f as any).featured);
            return (
              <>
                {featured && (
                  <div className="relative rounded-2xl overflow-hidden mb-6 border border-blue-500/30 bg-gradient-to-br from-[#080e1c] to-[#0c1628] shadow-[0_0_60px_rgba(37,99,235,0.12)]" data-testid="card-feature-pesquisa-loa">
                    <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-60" />
                    <div className="p-8 md:p-10 flex flex-col md:flex-row gap-10">

                      {/* Esquerda: identidade do card */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                            <Search className="w-6 h-6 text-blue-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="text-xl font-bold text-white">Pesquisa LOA</h3>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-[10px] font-bold text-blue-300 uppercase tracking-widest">
                                Motor Principal
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">O coração do AuraLOA</p>
                          </div>
                        </div>

                        <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-md">
                          {featured.description}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-blue-400 font-medium">
                          <Zap className="w-3.5 h-3.5" />
                          Cruzamento automático: Dotação × Execução × Estoque × Valores
                        </div>
                      </div>

                      {/* Direita: o que a pesquisa revela */}
                      <div className="flex-1 bg-[#060b16] border border-slate-800/60 rounded-xl p-6">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Uma pesquisa na LOA revela:</p>
                        <ul className="space-y-3">
                          {[
                            { text: "Se o precatório existe, pertence ao credor e se foi transferido", icon: CheckCircle2, color: "text-blue-400" },
                            { text: "Se está inscrito no orçamento público", icon: CheckCircle2, color: "text-blue-400" },
                            { text: "Se há previsão de pagamento no exercício", icon: CheckCircle2, color: "text-blue-400" },
                            { text: "Se há valor reservado para quitação", icon: CheckCircle2, color: "text-blue-400" },
                            { text: "Qual órgão público é responsável pelo pagamento", icon: CheckCircle2, color: "text-blue-400" },
                            { text: "Execução financeira — quanto já foi pago e quanto resta", icon: CheckCircle2, color: "text-blue-400" },
                          ].map((item) => (
                            <li key={item.text} className="flex items-start gap-2.5">
                              <item.icon className={`w-4 h-4 mt-0.5 shrink-0 ${item.color}`} />
                              <span className="text-sm text-slate-300 leading-snug">{item.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map((feature) => {
                    const f = feature as any;
                    return (
                      <div
                        key={feature.title}
                        className={`relative rounded-xl p-6 transition-all group border bg-[#0b1018] ${f.border ?? "border-slate-800/80 hover:border-slate-600/60"}`}
                        style={{ boxShadow: f.glow ? `0 0 28px ${f.glow}` : undefined }}
                        data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {f.highlight && (
                          <div className="absolute top-3 right-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                              2024–2028
                            </span>
                          </div>
                        )}
                        <div className={`w-10 h-10 rounded-lg ${feature.bg} flex items-center justify-center mb-4 border ${feature.bg.replace('bg-', 'border-').replace('/10', '/20')} group-hover:scale-110 transition-transform`}>
                          <feature.icon className={`w-5 h-5 ${feature.color}`} />
                        </div>
                        <h3 className={`text-lg font-semibold mb-2 ${f.highlight ? "text-emerald-300" : "text-slate-200"}`}>{feature.title}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
                        {f.highlight && (
                          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-500 font-medium">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Precatórios pendentes de pagamento rastreados
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      </section>

      <section className="py-20 border-t border-white/[0.05] bg-[hsl(220_7%_16%)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">

          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-timeline-title">
              Due Diligence:{" "}
              <span className="text-slate-500 line-through decoration-red-500/50">Manual</span>{" "}
              vs{" "}
              <span className="text-cyan-400">Digital</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Transforme <span className="font-mono text-slate-300">35 dias úteis</span> em{" "}
              <span className="font-mono text-cyan-400">1 dia útil</span>. Redução drástica de tempo com precisão forense e auditoria em tempo real.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 opacity-90 flex flex-col" data-testid="card-manual-process">
              <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
                <h3 className="text-2xl font-semibold text-slate-400">Processo Tradicional</h3>
                <div className="text-right">
                  <span className="block text-red-400 font-mono text-2xl font-bold">~280h</span>
                  <span className="text-slate-500 text-sm">Custo: ~R$ 85K</span>
                </div>
              </div>
              <ul className="space-y-6 flex-grow">
                <li className="border-l-2 border-slate-700 pl-4" data-testid="timeline-manual-step-0">
                  <p className="font-semibold text-slate-300">Coleta Manual <span className="text-slate-500 font-mono text-sm ml-2">120h</span></p>
                  <p className="text-sm text-slate-500 mt-1">Acesso individual a cada tribunal (TRF1-6, TJSP). Consulta processo por processo.</p>
                </li>
                <li className="border-l-2 border-slate-700 pl-4" data-testid="timeline-manual-step-1">
                  <p className="font-semibold text-slate-300">Cruzamento em Planilhas <span className="text-slate-500 font-mono text-sm ml-2">80h</span></p>
                  <p className="text-sm text-slate-500 mt-1">Montagem manual cruzando dotação x execução. Copiar/colar suscetível a erro humano.</p>
                </li>
                <li className="border-l-2 border-slate-700 pl-4" data-testid="timeline-manual-step-2">
                  <p className="font-semibold text-slate-300">Validação Individual <span className="text-slate-500 font-mono text-sm ml-2">40h</span></p>
                  <p className="text-sm text-slate-500 mt-1">Conferência manual de cada valor e busca de PDFs oficiais.</p>
                </li>
              </ul>
            </div>

            <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-8 shadow-[0_0_40px_rgba(6,182,212,0.1)] relative flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(6,182,212,0.2)]" data-testid="card-digital-process">
              <div className="absolute -top-4 -right-4 bg-cyan-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-full shadow-lg rotate-3">
                40x MAIS RÁPIDO
              </div>
              <div className="flex items-center justify-between mb-8 border-b border-cyan-900 pb-4">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Zap className="w-6 h-6 text-cyan-400" />
                  AuraLOA
                </h3>
                <div className="text-right">
                  <span className="block text-cyan-400 font-mono text-3xl font-bold">~7h</span>
                  <span className="text-cyan-600 text-sm">Economia de 97.5%</span>
                </div>
              </div>
              <ul className="space-y-6 flex-grow">
                <li className="border-l-2 border-cyan-400 pl-4" data-testid="timeline-digital-step-0">
                  <p className="font-semibold text-white">Coleta Automatizada <span className="text-cyan-500 font-mono text-sm ml-2">3h</span></p>
                  <p className="text-sm text-slate-400 mt-1">APIs oficiais (Portal da Transparência, DataJud, SIOP). 10.000+ processos/consulta.</p>
                </li>
                <li className="border-l-2 border-cyan-400 pl-4" data-testid="timeline-digital-step-1">
                  <p className="font-semibold text-white">Cruzamento 4 Camadas <span className="text-cyan-500 font-mono text-sm ml-2">2h</span></p>
                  <p className="text-sm text-slate-400 mt-1">Dotação, Execução, Estoque e Valores PDF cruzados com matching automático.</p>
                </li>
                <li className="border-l-2 border-cyan-400 pl-4" data-testid="timeline-digital-step-2">
                  <p className="font-semibold text-white">Validação & Evidência SHA-256 <span className="text-cyan-500 font-mono text-sm ml-2">1.5h</span></p>
                  <p className="text-sm text-slate-400 mt-1">Cada dado validado contra a fonte oficial. Hash SHA-256 automático de cada payload. Cadeia de custódia íntegra.</p>
                </li>
              </ul>
              <Link href="/login">
                <button className="mt-8 w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-lg transition-colors" data-testid="button-iniciar-automacao">
                  Iniciar Automação
                </button>
              </Link>
            </div>

          </div>
        </div>
      </section>

      <MarketOverview />

      <section id="pipeline" className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(220_7%_16%)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="bg-[#0f172a]/60 border border-slate-800/80 rounded-2xl p-8">
            <div className="mb-10 flex flex-col md:flex-row justify-between md:items-end gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2" data-testid="text-custody-title">
                  <Lock className="text-emerald-500 w-6 h-6" />
                  Cadeia de Custódia Digital
                </h2>
                <p className="text-slate-400 text-sm">Cada etapa gera evidências com hash SHA-256 encadeado, garantindo rastreabilidade total.</p>
              </div>
              <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-xs font-mono font-bold shrink-0">
                Lei 13.964/2019 COMPLIANT
              </div>
            </div>

            <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-2">
              <div className="hidden md:block absolute top-6 left-[5%] right-[5%] h-[2px] bg-slate-800 z-0" />
              {pipelineSteps.map((step, idx) => (
                <div key={step.title} className="relative z-10 flex flex-col items-center flex-1 w-full text-center" data-testid={`card-pipeline-${step.title.toLowerCase()}`}>
                  <div className={`w-12 h-12 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                    <step.icon className={`w-5 h-5 ${step.color}`} />
                  </div>
                  <h4 className="text-white font-semibold mb-1 text-sm">{step.title}</h4>
                  <p className="text-xs text-slate-500 mb-3 px-2 min-h-[2.5rem] leading-relaxed">{step.description}</p>
                  <div className="bg-slate-950 border border-slate-800 rounded px-2 py-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="font-mono text-[10px] text-emerald-400/80">SHA-{step.hash}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(222_9%_9%)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 text-center">
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
                <button
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-slate-600 bg-slate-600 text-sm font-medium text-white hover:bg-slate-500 hover:border-slate-500 transition-colors"
                  data-testid="button-cta-footer"
                >
                  Acessar Plataforma
                  <ArrowRight className="w-4 h-4" />
                </button>
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
