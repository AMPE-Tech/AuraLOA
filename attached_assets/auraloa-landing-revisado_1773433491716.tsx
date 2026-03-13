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
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
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
    title: "Cadeia de Custodia",
    description: "Hash SHA-256 gerado automaticamente em cada etapa — da coleta ao relatorio. Cada dado tem origem, timestamp e evidencia verificavel. Rastreabilidade juridica completa.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40 hover:border-emerald-400/60",
    glow: "rgba(16,185,129,0.06)",
  },
  {
    icon: Layers,
    title: "Cruzamento 4 Camadas",
    description: "Cruza automaticamente Dotacao x Execucao x Estoque x Valores PDF. Detecta divergencias, identifica recursos nao utilizados e revela o status real de cada precatorio.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/40 hover:border-purple-400/60",
    glow: "rgba(168,85,247,0.06)",
  },
  {
    icon: Phone,
    title: "Contato do Credor",
    description: "Localiza o titular do precatorio com precisao: e-mail, telefone, OAB, CPF e CNPJ. Facilita negociacoes diretas, elimina intermediarios e acelera a due diligence.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40 hover:border-amber-400/60",
    glow: "rgba(245,158,11,0.06)",
  },
  {
    icon: Globe,
    title: "Cobertura Nacional",
    description: "Abrange todos os tribunais federais (TRF1 a TRF6), estaduais e municipais. Do precatorio federal ao estadual de Sao Paulo — uma unica consulta, todas as esferas.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/40 hover:border-cyan-400/60",
    glow: "rgba(6,182,212,0.06)",
  },
  {
    icon: Landmark,
    title: "LOA 2024 a 2028",
    description: "Serie historica de 5 anos de LOA. Identifica precatorios inscritos no orcamento mas ainda nao quitados — mapeando oportunidades reais de liquidez e risco de inadimplencia.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40 hover:border-emerald-400/60",
    glow: "rgba(16,185,129,0.06)",
    highlight: true,
  },
  {
    icon: FileSpreadsheet,
    title: "Exportacao e Relatorios",
    description: "Gera relatorios prontos para uso juridico e compliance: CSV com 4 camadas cruzadas, valores atualizados, pendentes identificados e hashes SHA-256. Um clique, evidencia completa.",
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
            style={{ opacity: 0.08, filter: "blur(1px) saturate(0.5)" }}
            aria-hidden="true"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628]/90 via-[#0d1f3c]/95 to-[#0a1628]" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(59,130,246,0.4) 29px, rgba(59,130,246,0.4) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(59,130,246,0.4) 29px, rgba(59,130,246,0.4) 30px)' }} />
        <div className="absolute top-0 left-1/3 w-[500px] h-[300px] rounded-full bg-blue-600/[0.06] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[250px] rounded-full bg-cyan-500/[0.04] blur-[100px]" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 py-16 md:py-24">

          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-400/20 bg-blue-500/[0.08]" data-testid="badge-beta">
              <div className="relative">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span className="absolute inset-0 w-3 h-3 animate-ping opacity-30"><Activity className="w-3 h-3 text-emerald-400" /></span>
              </div>
              <span className="text-[10px] font-mono text-blue-200/80 font-medium tracking-wider uppercase">Plataforma ativa — dados em tempo real</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-4 leading-[1.12] text-center" data-testid="text-hero-title">
            Inteligencia orcamentaria para{" "}
            <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              analise profissional
            </span>{" "}
            de precatorios.
          </h1>

          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed mb-6 text-center font-mono">
            O AuraLOA identifica e monitora todo ciclo de vida de um precatorio desde
          </p>

          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-10 max-w-4xl mx-auto">
            {[
              "Processo Judicial",
              "Transito em Julgado",
              "Liquidacao do Valor",
              "Expedicao do Precatorio",
              "Inclusao na LOA",
              "Pagamento",
            ].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/40 border border-slate-700/30">
                  <span className="text-[8px] font-bold text-blue-400/70 font-mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[10px] font-medium text-slate-300">{step}</span>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 mb-12">
            <Link href="/login">
              <button
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
                data-testid="button-cta-hero"
              >
                Acessar Plataforma
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
            <a href="#overview">
              <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-slate-600 bg-transparent text-xs font-semibold text-slate-300 hover:bg-slate-800/50 transition-colors" data-testid="button-view-dashboard">
                Ver Dashboard
              </button>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628] p-5 hover:border-blue-500/30 transition-colors" data-testid="kpi-hero-mercado">
              <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(59,130,246,0.3) 19px, rgba(59,130,246,0.3) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(59,130,246,0.3) 19px, rgba(59,130,246,0.3) 20px)' }} />
              <div className="relative">
                <span className="text-[8px] font-mono text-blue-400 uppercase tracking-widest">Mercado Total</span>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="text-2xl font-bold text-slate-100 font-mono">R$ 300B</span>
                  <span className="text-lg font-bold text-blue-500">+</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 mt-1 block">Em precatorios no Brasil</span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628] p-5 hover:border-cyan-500/30 transition-colors" data-testid="kpi-hero-performance">
              <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(6,182,212,0.3) 19px, rgba(6,182,212,0.3) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(6,182,212,0.3) 19px, rgba(6,182,212,0.3) 20px)' }} />
              <div className="relative">
                <span className="text-[8px] font-mono text-cyan-400 uppercase tracking-widest">Performance</span>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-bold text-cyan-400 font-mono">40x</span>
                  <span className="text-xs font-medium text-slate-400">Mais rapido</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 mt-1 block">Que o processo manual</span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628] p-5 hover:border-emerald-500/30 transition-colors" data-testid="kpi-hero-impacto">
              <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(16,185,129,0.3) 19px, rgba(16,185,129,0.3) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(16,185,129,0.3) 19px, rgba(16,185,129,0.3) 20px)' }} />
              <div className="relative">
                <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">Impacto</span>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-bold text-slate-100 font-mono">97%</span>
                  <span className="text-xs font-medium text-slate-400">Economia</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 mt-1 block">De tempo e custo operacional</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap" data-testid="badges-data-sources">
            {["Portal da Transparencia", "SIOP", "CNJ DataJud", "TRF1-6", "TJSP"].map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-[10px] font-mono text-slate-400 px-2.5 py-1 rounded-md border border-slate-700/30 bg-slate-800/20">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/60" />
                {s}
              </span>
            ))}
          </div>

        </div>
      </section>

      <div className="max-w-[1400px] mx-auto">
        <ValidadorPreliminarLOA />
      </div>

      <section className="py-10 md:py-16 border-t border-slate-700/30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="text-blue-400 w-4 h-4" />
              <h2 className="text-sm font-semibold text-slate-100" data-testid="text-features-title">Modulos de Inteligencia</h2>
            </div>
            <p className="text-xs text-slate-500">Ferramenta completa para pesquisa, validacao e auditoria de precatorios.</p>
          </div>

          {(() => {
            const featured = features.find((f) => (f as any).featured);
            const rest = features.filter((f) => !(f as any).featured);
            return (
              <>
                {featured && (
                  <div className="relative overflow-hidden rounded-xl mb-4 border border-blue-500/30 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]" data-testid="card-feature-pesquisa-loa">
                    <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(59,130,246,0.4) 29px, rgba(59,130,246,0.4) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(59,130,246,0.4) 29px, rgba(59,130,246,0.4) 30px)' }} />
                    <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-60" />
                    <div className="relative p-5 md:p-6 flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2.5 mb-4">
                          <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                            <Search className="w-4 h-4 text-blue-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="text-sm font-bold text-slate-100">Pesquisa LOA</h3>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-[8px] font-bold text-blue-300 uppercase tracking-widest font-mono">
                                Motor Principal
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono">O coracao do AuraLOA</p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed mb-4 max-w-md">
                          {featured.description}
                        </p>

                        <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-mono font-medium">
                          <Zap className="w-3 h-3" />
                          Cruzamento automatico: Dotacao x Execucao x Estoque x Valores
                        </div>
                      </div>

                      <div className="flex-1 rounded-lg bg-[#060e1f] border border-slate-700/30 p-4">
                        <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-3">Uma pesquisa na LOA revela:</p>
                        <ul className="space-y-2">
                          {[
                            "Se o precatorio existe, pertence ao credor e se foi transferido",
                            "Se esta inscrito no orcamento publico",
                            "Se ha previsao de pagamento no exercicio",
                            "Se ha valor reservado para quitacao",
                            "Qual orgao publico e responsavel pelo pagamento",
                            "Execucao financeira — quanto ja foi pago e quanto resta",
                          ].map((text) => (
                            <li key={text} className="flex items-start gap-2">
                              <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-blue-400" />
                              <span className="text-[10px] text-slate-300 leading-snug font-mono">{text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rest.map((feature) => {
                    const f = feature as any;
                    return (
                      <div
                        key={feature.title}
                        className="relative overflow-hidden rounded-xl p-4 transition-all group border bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628] border-slate-700/30 hover:border-slate-600/50"
                        style={{ boxShadow: f.glow ? `0 0 28px ${f.glow}` : undefined }}
                        data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(148,163,184,0.3) 24px, rgba(148,163,184,0.3) 25px), repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(148,163,184,0.3) 24px, rgba(148,163,184,0.3) 25px)' }} />
                        {f.highlight && (
                          <div className="absolute top-3 right-3">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[8px] font-bold text-emerald-400 uppercase tracking-widest font-mono">
                              2024-2028
                            </span>
                          </div>
                        )}
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-lg ${feature.bg} flex items-center justify-center mb-3 border ${feature.bg.replace('bg-', 'border-').replace('/10', '/20')} group-hover:scale-110 transition-transform`}>
                            <feature.icon className={`w-4 h-4 ${feature.color}`} />
                          </div>
                          <h3 className={`text-xs font-semibold mb-1.5 ${f.highlight ? "text-emerald-300" : "text-slate-200"}`}>{feature.title}</h3>
                          <p className="text-[10px] text-slate-500 leading-relaxed">{feature.description}</p>
                          {f.highlight && (
                            <div className="mt-3 flex items-center gap-1.5 text-[9px] text-emerald-500 font-mono font-medium">
                              <TrendingUp className="w-3 h-3" />
                              Precatorios pendentes de pagamento rastreados
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      </section>

      <section className="py-10 md:py-16 border-t border-slate-700/30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">

          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-100" data-testid="text-timeline-title">
                Due Diligence: Manual vs Digital
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-xl mx-auto font-mono">
              Transforme <span className="text-slate-300">35 dias uteis</span> em{" "}
              <span className="text-cyan-400">1 dia util</span>. Reducao drastica com precisao forense.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 items-stretch">

            <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]" data-testid="card-manual-process">
              <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(239,68,68,0.3) 29px, rgba(239,68,68,0.3) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(239,68,68,0.3) 29px, rgba(239,68,68,0.3) 30px)' }} />
              <div className="relative p-5 flex flex-col h-full">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-700/30">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-400">Processo Tradicional</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-red-400 font-mono text-lg font-bold">~280h</span>
                    <span className="text-[8px] font-mono text-slate-500">Custo: ~R$ 85K</span>
                  </div>
                </div>
                <div className="space-y-3 flex-grow">
                  {manualSteps.map((step, i) => {
                    const barWidth = [43, 29, 14, 9, 6][i];
                    return (
                      <div key={step.title} className="rounded-lg bg-slate-800/30 border border-slate-700/20 p-3" data-testid={`timeline-manual-step-${i}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <step.icon className="w-3 h-3 text-slate-500" />
                            <span className="text-[10px] font-mono font-bold text-slate-300">{step.title}</span>
                          </div>
                          <span className="text-[9px] font-mono text-red-400/80">{step.duration}</span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-slate-700/50 overflow-hidden mb-1.5">
                          <div className="h-full rounded-full bg-red-500/40" style={{ width: `${barWidth}%` }} />
                        </div>
                        <p className="text-[8px] font-mono text-slate-500">{step.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]" data-testid="card-digital-process">
              <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(6,182,212,0.4) 29px, rgba(6,182,212,0.4) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(6,182,212,0.4) 29px, rgba(6,182,212,0.4) 30px)' }} />
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60" />
              <div className="relative p-5 flex flex-col h-full">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs font-bold text-slate-100">AuraLOA</span>
                    <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[8px] font-mono">40x MAIS RAPIDO</Badge>
                  </div>
                  <div className="text-right">
                    <span className="block text-cyan-400 font-mono text-lg font-bold">~7h</span>
                    <span className="text-[8px] font-mono text-cyan-600">Economia de 97.5%</span>
                  </div>
                </div>
                <div className="space-y-3 flex-grow">
                  {digitalSteps.map((step, i) => {
                    const barWidth = [43, 29, 14, 7, 7][i];
                    return (
                      <div key={step.title} className="rounded-lg bg-slate-800/30 border border-slate-700/20 p-3 hover:border-cyan-500/20 transition-colors" data-testid={`timeline-digital-step-${i}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <step.icon className="w-3 h-3 text-cyan-400" />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-200">{step.title}</span>
                          </div>
                          <span className="text-[9px] font-mono text-cyan-400/80">{step.duration}</span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-slate-700/50 overflow-hidden mb-1.5">
                          <div className="h-full rounded-full bg-cyan-500/60" style={{ width: `${barWidth}%` }} />
                        </div>
                        <p className="text-[8px] font-mono text-slate-500">{step.description}</p>
                      </div>
                    );
                  })}
                </div>
                <Link href="/login">
                  <button className="mt-4 w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold py-2.5 rounded-lg transition-colors font-mono" data-testid="button-iniciar-automacao">
                    Iniciar Automacao
                  </button>
                </Link>
              </div>
            </div>

          </div>

          <div className="mt-6 relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628] p-5">
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(59,130,246,0.3) 29px, rgba(59,130,246,0.3) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(59,130,246,0.3) 29px, rgba(59,130,246,0.3) 30px)' }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Comparativo Horas por Etapa</span>
              </div>
              <div className="relative h-[200px] rounded-lg bg-[#060e1f] border border-slate-700/30 overflow-hidden p-4">
                <svg viewBox="0 0 500 180" className="w-full h-full">
                  <line x1="60" y1="160" x2="480" y2="160" stroke="#1e293b" strokeWidth="1" />
                  <line x1="60" y1="160" x2="60" y2="10" stroke="#1e293b" strokeWidth="1" />
                  {[0, 30, 60, 90, 120].map((v, i) => (
                    <g key={i}>
                      <line x1="60" y1={160 - (v / 120) * 140} x2="480" y2={160 - (v / 120) * 140} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3,3" />
                      <text x="55" y={164 - (v / 120) * 140} textAnchor="end" fill="#64748b" fontSize="7" fontFamily="monospace">{v}h</text>
                    </g>
                  ))}
                  {timelineCompareData.map((d, i) => {
                    const x = 100 + i * 85;
                    const manualH = (d.manual / 120) * 140;
                    const digitalH = (d.digital / 120) * 140;
                    return (
                      <g key={d.etapa}>
                        <rect x={x - 12} y={160 - manualH} width="10" height={manualH} fill="#ef4444" opacity="0.3" rx="2" />
                        <rect x={x + 2} y={160 - digitalH} width="10" height={Math.max(digitalH, 2)} fill="#06b6d4" opacity="0.6" rx="2" />
                        <text x={x} y={174} textAnchor="middle" fill="#64748b" fontSize="6" fontFamily="monospace">{d.etapa.split(' ')[0]}</text>
                        <text x={x - 7} y={155 - manualH} textAnchor="middle" fill="#ef4444" fontSize="6" fontFamily="monospace">{d.manual}h</text>
                        <text x={x + 7} y={155 - digitalH} textAnchor="middle" fill="#06b6d4" fontSize="6" fontFamily="monospace">{d.digital}h</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[8px] font-mono text-slate-500"><span className="w-2 h-1 rounded-sm bg-red-500/40 inline-block" /> Manual</span>
                <span className="flex items-center gap-1.5 text-[8px] font-mono text-slate-500"><span className="w-2 h-1 rounded-sm bg-cyan-500/60 inline-block" /> AuraLOA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketOverview />

      <section id="pipeline" className="py-10 md:py-16 border-t border-slate-700/30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628] p-5">
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(16,185,129,0.4) 29px, rgba(16,185,129,0.4) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(16,185,129,0.4) 29px, rgba(16,185,129,0.4) 30px)' }} />
            <div className="relative">
              <div className="mb-6 flex flex-col md:flex-row justify-between md:items-end gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="text-emerald-400 w-4 h-4" />
                    <h2 className="text-sm font-semibold text-slate-100" data-testid="text-custody-title">Cadeia de Custodia Digital</h2>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">Cada etapa gera evidencias com hash SHA-256 encadeado, garantindo rastreabilidade total.</p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px] font-mono shrink-0">
                  Lei 13.964/2019 COMPLIANT
                </Badge>
              </div>

              <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-2">
                <div className="hidden md:block absolute top-6 left-[5%] right-[5%] h-[1px] bg-slate-700/50 z-0" />
                {pipelineSteps.map((step) => (
                  <div key={step.title} className="relative z-10 flex flex-col items-center flex-1 w-full text-center" data-testid={`card-pipeline-${step.title.toLowerCase()}`}>
                    <div className={`w-10 h-10 rounded-full bg-[#060e1f] border border-slate-700/50 flex items-center justify-center mb-3`}>
                      <step.icon className={`w-4 h-4 ${step.color}`} />
                    </div>
                    <h4 className="text-slate-200 font-semibold mb-1 text-[10px] font-mono">{step.title}</h4>
                    <p className="text-[8px] text-slate-500 font-mono mb-2 px-2 min-h-[2rem] leading-relaxed">{step.description}</p>
                    <div className="bg-[#060e1f] border border-slate-700/30 rounded px-2 py-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="font-mono text-[8px] text-emerald-400/80">SHA-{step.hash}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 md:py-12 border-t border-slate-700/30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <h2 className="text-xs font-semibold text-slate-200" data-testid="text-sources-title">Fontes Oficiais</h2>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mb-5 max-w-md mx-auto">
            Dados exclusivamente de fontes governamentais e judiciais.
          </p>
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {dataSources.map((source) => (
              <span key={source} className="inline-flex items-center gap-1.5 text-[9px] font-mono py-1 px-2.5 text-slate-400 border border-slate-700/30 bg-slate-800/20 rounded-md" data-testid={`badge-source-${source.toLowerCase().replace(/\s+/g, '-')}`}>
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/60" />
                {source}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 md:py-16 border-t border-slate-700/30">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-xl border border-blue-500/20 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]">
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(59,130,246,0.4) 29px, rgba(59,130,246,0.4) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(59,130,246,0.4) 29px, rgba(59,130,246,0.4) 30px)' }} />
            <div className="relative p-6 md:p-8 text-center">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/15 w-fit mx-auto mb-3">
                <Zap className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-sm font-semibold mb-1.5 text-slate-100" data-testid="text-cta-title">
                Comece Agora
              </h2>
              <p className="text-[10px] text-slate-500 font-mono mb-5 max-w-sm mx-auto">
                Acesse a plataforma e pesquise precatorios com cadeia de custodia completa.
              </p>
              <Link href="/login">
                <button
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
                  data-testid="button-cta-footer"
                >
                  Acessar Plataforma
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-6">
        <PublicFooter />
      </div>
    </div>
  );
}
