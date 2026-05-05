import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicTopbar } from "@/components/public-topbar";
import { PublicFooter } from "@/components/public-footer";
import { ValidadorPreliminarLOA } from "@/components/validador-preliminar";
import { MarketplaceCard } from "@/components/marketplace-card";
import { MarketOverview } from "@/components/market-overview";
import { EditorialGauge, EditorialComparison } from "@/components/editorial-gauge";
import { motion } from "framer-motion";
import heroBgPath from "@assets/hero-dashboard-bg.png";
import {
  Search,
  Shield,
  Layers,
  Phone,
  Globe,
  ArrowRight,
  Hash,
  Database,
  CheckCircle2,
  FileSearch,
  Send,
  Zap,
  TrendingUp,
  FileSpreadsheet,
  Sparkles,
  Lock,
  Landmark,
} from "lucide-react";

/* Brand-coherent: tudo neutro/indigo. Indigo = AuraLOA. Sem rainbow. */
const NEUTRAL_ICON = "text-white/55";
const NEUTRAL_BG = "bg-white/[0.03]";
const NEUTRAL_BORDER = "border-white/[0.08] hover:border-indigo-400/40";

const pipelineSteps = [
  {
    icon: Database,
    title: "Coleta",
    description: "Portal da Transparência, SIOP, CNJ DataJud e Tribunais",
    hash: "a3f2b1c8d4e5...",
    color: NEUTRAL_ICON,
  },
  {
    icon: FileSearch,
    title: "Validação",
    description: "Cruzamento de dotação, execução e estoque orçamentário",
    hash: "7e9f0a2b3c4d...",
    color: NEUTRAL_ICON,
  },
  {
    icon: Layers,
    title: "Cruzamento",
    description: "4 camadas: Dotação × Execução × Estoque × Valores PDF",
    hash: "b5d8e1f4a7c0...",
    color: NEUTRAL_ICON,
  },
  {
    icon: Shield,
    title: "Evidência",
    description: "SHA-256 de cada payload, timestamps e raw preservados",
    hash: "c9e2d5f8a1b4...",
    color: NEUTRAL_ICON,
  },
  {
    icon: Send,
    title: "Entrega",
    description: "Pacote auditável com cadeia de custódia completa",
    hash: "f1a4d7e0b3c6...",
    color: "text-indigo-300",
  },
];

const features = [
  {
    icon: Search,
    title: "Pesquisa LOA",
    description: "O motor central do AuraLOA. Cruzamento automático de 4 camadas orçamentárias com dados reais do Portal da Transparência, SIOP e CNJ DataJud.",
    color: "text-indigo-300",
    bg: "bg-indigo-500/12",
    featured: true,
  },
  {
    icon: Shield,
    title: "Cadeia de Custódia",
    description: "Hash SHA-256 gerado automaticamente em cada etapa — da coleta ao relatório. Cada dado tem origem, timestamp e evidência verificável. Rastreabilidade jurídica completa.",
    color: NEUTRAL_ICON,
    bg: NEUTRAL_BG,
    border: NEUTRAL_BORDER,
  },
  {
    icon: Layers,
    title: "Cruzamento 4 Camadas",
    description: "Cruza automaticamente Dotação × Execução × Estoque × Valores PDF. Detecta divergências, identifica recursos não utilizados e revela o status real de cada precatório.",
    color: NEUTRAL_ICON,
    bg: NEUTRAL_BG,
    border: NEUTRAL_BORDER,
  },
  {
    icon: Phone,
    title: "Contato do Credor",
    description: "Localiza o titular do precatório com precisão: e-mail, telefone, OAB, CPF e CNPJ. Facilita negociações diretas, elimina intermediários e acelera a due diligence.",
    color: NEUTRAL_ICON,
    bg: NEUTRAL_BG,
    border: NEUTRAL_BORDER,
  },
  {
    icon: Globe,
    title: "Cobertura Nacional",
    description: "Abrange todos os tribunais federais (TRF1 a TRF6), estaduais e municipais. Do precatório federal ao estadual de São Paulo — uma única consulta, todas as esferas.",
    color: NEUTRAL_ICON,
    bg: NEUTRAL_BG,
    border: NEUTRAL_BORDER,
  },
  {
    icon: Landmark,
    title: "LOA 2024 a 2028",
    description: "Série histórica de 5 anos de LOA. Identifica precatórios inscritos no orçamento mas ainda não quitados — mapeando oportunidades reais de liquidez e risco de inadimplência.",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30 hover:border-emerald-400/50",
    highlight: true,
  },
  {
    icon: FileSpreadsheet,
    title: "Exportação e Relatórios",
    description: "Gera relatórios prontos para uso jurídico e compliance: CSV com 4 camadas cruzadas, valores atualizados, pendentes identificados e hashes SHA-256. Um clique, evidência completa.",
    color: NEUTRAL_ICON,
    bg: NEUTRAL_BG,
    border: NEUTRAL_BORDER,
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
            style={{ opacity: 0.10, filter: "blur(1px) saturate(0.55)" }}
            aria-hidden="true"
          />
        </div>
        {/* atmosfera noir-financial: gradient base + meshes + grain SVG */}
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(225_30%_4%/0.88)] via-[hsl(220_35%_6%/0.92)] to-[hsl(225_25%_5%)]" />
        <div className="absolute top-[-10%] left-1/3 w-[820px] h-[460px] rounded-full bg-indigo-600/[0.10] blur-[140px]" />
        <div className="absolute top-[20%] right-[5%] w-[480px] h-[360px] rounded-full bg-blue-700/[0.08] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[10%] w-[600px] h-[320px] rounded-full bg-amber-500/[0.025] blur-[140px]" />
        {/* hairline horizontal de topo */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
        {/* noise grain overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.035] mix-blend-overlay pointer-events-none" aria-hidden="true">
          <filter id="hero-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.7 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#hero-noise)" />
        </svg>

        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 py-24 md:py-36">

          {/* Badge — eyebrow editorial */}
          <motion.div
            className="flex justify-center mb-10"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-3" data-testid="badge-beta">
              <span className="w-8 h-px bg-indigo-400/40" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span
                className="uppercase text-emerald-300/90"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 10,
                  letterSpacing: "0.32em",
                  fontWeight: 500,
                }}
              >
                Live · Dados em tempo real
              </span>
              <span className="w-8 h-px bg-indigo-400/40" />
            </div>
          </motion.div>

          {/* Título — Lora editorial display serif */}
          <motion.h1
            className="text-white tracking-tight mb-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            data-testid="text-hero-title"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(2.5rem, 5.6vw, 5rem)",
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
            }}
          >
            Inteligência orçamentária<br className="hidden md:block" />
            {" "}para{" "}
            <span
              className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-blue-300 to-indigo-200"
              style={{ fontStyle: "italic", fontWeight: 500 }}
            >
              análise forense
            </span>
            <br className="hidden md:block" />
            {" "}de precatórios.
          </motion.h1>

          {/* Subtexto — frase completa (Lora body) */}
          <p
            className="text-lg md:text-xl text-white/60 max-w-3xl mx-auto leading-relaxed mb-8 text-center"
            style={{ fontFamily: "'Lora', Georgia, serif" }}
          >
            O AuraLOA monitora todo o ciclo de vida do precatório — do trânsito em julgado ao pagamento — com cadeia de custódia auditável.
          </p>

          {/* Pipeline ciclo de vida — eyebrow numerals em Playfair indigo, padrão único da página */}
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
                  <span
                    className="text-indigo-300/70 tabular-nums"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      fontWeight: 500,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-medium text-slate-300">{step}</span>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* CTAs — primary indigo solid, secondary ghost; padrão único reutilizado na página */}
          <div className="flex items-center justify-center gap-4 mb-16">
            <Link href="/login">
              <button
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-indigo-500 text-sm font-semibold text-white hover:bg-indigo-400 transition-all shadow-[0_0_24px_rgba(129,140,248,0.30)] hover:shadow-[0_0_32px_rgba(129,140,248,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e1a]"
                data-testid="button-cta-hero"
              >
                Acessar Plataforma
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <a href="#overview">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base border-white/[0.10] text-white/80 hover:bg-white/[0.04] hover:text-white" data-testid="button-view-dashboard">
                Ver Dashboard
              </Button>
            </a>
          </div>

          {/* KPI cards — Editorial Forensic Terminal · gauges SVG custom + Lora display + JetBrains Mono */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.04] border border-white/[0.06] rounded-2xl overflow-hidden mb-10 backdrop-blur-md">
            {[
              {
                idx: "01",
                label: "Mercado",
                kicker: "Federal · 2024–2026",
                kind: "gauge" as const,
                value: 80,
                prefix: "R$ ",
                suffix: "B",
                gaugeLabel: "Média anual",
                caption: "Volume médio de precatórios federais inscritos por exercício",
                delay: 0.4,
              },
              {
                idx: "02",
                label: "Performance",
                kicker: "Revisão · Manual vs AuraLOA",
                kind: "compare" as const,
                delay: 0.55,
              },
              {
                idx: "03",
                label: "Impacto",
                kicker: "Custo operacional",
                kind: "gauge" as const,
                value: 88,
                prefix: "",
                suffix: "%",
                gaugeLabel: "Economia",
                caption: "Redução do custo total comparado à due diligence manual",
                delay: 0.7,
              },
            ].map((card) => (
              <motion.div
                key={card.idx}
                className="relative bg-[#0a0e1a]/80 px-7 pt-6 pb-7 flex flex-col"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: card.delay, ease: [0.16, 1, 0.3, 1] }}
                data-testid={`kpi-hero-${card.label.toLowerCase()}`}
              >
                {/* eyebrow numerado */}
                <div className="flex items-center gap-3 mb-1">
                  <span
                    className="text-amber-400/80 tabular-nums"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      fontWeight: 500,
                    }}
                  >
                    {card.idx}
                  </span>
                  <span className="flex-1 h-px bg-gradient-to-r from-amber-400/30 via-white/[0.06] to-transparent" />
                </div>
                <div
                  className="text-white uppercase mb-0.5"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 14,
                    letterSpacing: "0.18em",
                    fontWeight: 500,
                  }}
                >
                  {card.label}
                </div>
                <div
                  className="text-white/40 mb-6"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 10,
                    letterSpacing: "0.10em",
                  }}
                >
                  {card.kicker}
                </div>

                {/* visual */}
                <div className="flex-1 flex items-center justify-center my-2">
                  {card.kind === "gauge" ? (
                    <EditorialGauge
                      value={card.value!}
                      max={100}
                      size={180}
                      prefix={card.prefix}
                      suffix={card.suffix}
                      label={card.gaugeLabel!}
                      accent="#818cf8"
                    />
                  ) : (
                    <EditorialComparison
                      manualLabel="Manual"
                      manualValue="44h"
                      digitalLabel="AuraLOA"
                      digitalValue="82s"
                      ratioLabel="≈ 1.900× mais rápido"
                    />
                  )}
                </div>

                {/* caption rodapé */}
                {card.caption && (
                  <div className="mt-auto pt-5 border-t border-white/[0.05]">
                    <p
                      className="text-white/55 text-center"
                      style={{
                        fontFamily: "'Lora', Georgia, serif",
                        fontSize: 13,
                        lineHeight: 1.55,
                        fontStyle: "italic",
                        fontWeight: 400,
                      }}
                    >
                      {card.caption}
                    </p>
                  </div>
                )}
                {!card.caption && (
                  <div className="mt-auto pt-5 border-t border-white/[0.05] h-[55px]" />
                )}
              </motion.div>
            ))}
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

      {/* Bloco Validador + Marketplace — dual side */}
      <div className="w-full max-w-[1400px] mx-auto py-10 relative z-20 -mt-10 px-4 sm:px-6">

        {/* Faixa de prova social (acima dos dois cards) */}
        <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60"
            style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 13, fontStyle: "italic" }}
          >
            <span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
            Ferramenta utilizada por advogados, investidores e gestores públicos
          </div>
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300"
            style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 13, fontWeight: 500 }}
          >
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            +2.300 consultas realizadas este mês
          </div>
        </div>

        {/* Grid 2 colunas: Validador (esquerda) | Marketplace (direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <ValidadorPreliminarLOA embedded />
          <MarketplaceCard />
        </div>
      </div>

      <section id="pipeline" className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(220_7%_16%)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="bg-[#0f172a]/60 border border-slate-800/80 rounded-2xl p-8">
            <div className="mb-8">
              <p
                className="italic text-white/55 text-base md:text-lg leading-relaxed mb-6 max-w-2xl"
                style={{ fontFamily: "'Lora', Georgia, serif" }}
              >
                Cada dado tem origem rastreável. Nenhuma análise pode ser refutada por falta de evidência.
              </p>
            </div>
            <div className="mb-10 flex flex-col md:flex-row justify-between md:items-end gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Lock className="w-4 h-4 text-white/40" />
                  <span
                    className="text-white/40 uppercase"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 11,
                      letterSpacing: "0.30em",
                      fontWeight: 500,
                    }}
                  >
                    Trust layer
                  </span>
                </div>
                <h2
                  className="text-white mb-3"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                  data-testid="text-custody-title"
                >
                  Cadeia de Custódia Digital
                </h2>
                <p
                  className="text-white/55 text-sm md:text-base leading-relaxed max-w-xl"
                  style={{ fontFamily: "'Lora', Georgia, serif" }}
                >
                  Cada etapa gera evidências com hash SHA-256 encadeado, garantindo rastreabilidade total.
                </p>
              </div>
              <div
                className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 shrink-0 uppercase tabular-nums"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 12,
                  letterSpacing: "0.16em",
                  fontWeight: 600,
                }}
              >
                Lei 13.964/2019 Compliant
              </div>
            </div>

            <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-2">
              <div className="hidden md:block absolute top-6 left-[5%] right-[5%] h-[2px] bg-slate-800 z-0" />
              {pipelineSteps.map((step) => (
                <div key={step.title} className="relative z-10 flex flex-col items-center flex-1 w-full text-center" data-testid={`card-pipeline-${step.title.toLowerCase()}`}>
                  <div className={`w-12 h-12 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                    <step.icon className={`w-5 h-5 ${step.color}`} />
                  </div>
                  <h4 className="text-white font-semibold mb-1 text-sm">{step.title}</h4>
                  <p className="text-xs text-slate-500 mb-3 px-2 min-h-[2.5rem] leading-relaxed">{step.description}</p>
                  <div className="bg-slate-950 border border-slate-800 rounded px-2 py-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="text-[10px] text-emerald-400/80" style={{ fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "0.04em" }}>SHA-{step.hash}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(222_9%_9%)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <Layers className="w-4 h-4 text-white/40" />
              <span
                className="text-white/40 uppercase"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 11,
                  letterSpacing: "0.30em",
                  fontWeight: 500,
                }}
              >
                Plataforma
              </span>
            </div>
            <h2
              className="text-white mb-3"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
              data-testid="text-features-title"
            >
              Módulos de Inteligência
            </h2>
            <p
              className="text-white/55 text-sm md:text-base leading-relaxed max-w-2xl"
              style={{ fontFamily: "'Lora', Georgia, serif" }}
            >
              Ferramenta completa para pesquisa, validação e auditoria de precatórios.
            </p>
          </div>
          {/* Card destaque: Pesquisa LOA — coração do sistema */}
          {(() => {
            const featured = features.find((f) => (f as any).featured);
            const rest = features.filter((f) => !(f as any).featured);
            return (
              <>
                {featured && (
                  <div className="relative rounded-2xl overflow-hidden mb-6 border border-indigo-500/30 bg-gradient-to-br from-[#080e1c] to-[#0c1628] shadow-[0_0_60px_rgba(129,140,248,0.10)]" data-testid="card-feature-pesquisa-loa">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />
                    <div className="p-8 md:p-10 flex flex-col md:flex-row gap-10">

                      {/* Esquerda: identidade do card */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-12 h-12 rounded-xl bg-indigo-500/12 border border-indigo-500/25 flex items-center justify-center">
                            <Search className="w-6 h-6 text-indigo-300" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3
                                className="text-white"
                                style={{
                                  fontFamily: "'Playfair Display', Georgia, serif",
                                  fontSize: 22,
                                  fontWeight: 600,
                                  letterSpacing: "-0.02em",
                                }}
                              >
                                Pesquisa LOA
                              </h3>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/12 border border-indigo-500/30 text-indigo-200 uppercase"
                                style={{
                                  fontFamily: "'Playfair Display', Georgia, serif",
                                  fontSize: 10,
                                  letterSpacing: "0.20em",
                                  fontWeight: 600,
                                }}
                              >
                                Motor Principal
                              </span>
                            </div>
                            <p className="text-xs text-slate-500" style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: "italic" }}>O coração do AuraLOA</p>
                          </div>
                        </div>

                        <p
                          className="text-sm text-slate-400 leading-relaxed mb-6 max-w-md"
                          style={{ fontFamily: "'Lora', Georgia, serif" }}
                        >
                          {featured.description}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium">
                          <Zap className="w-3.5 h-3.5" />
                          Cruzamento automático: Dotação × Execução × Estoque × Valores
                        </div>
                      </div>

                      {/* Direita: o que a pesquisa revela */}
                      <div className="flex-1 bg-[#060b16] border border-white/[0.06] rounded-xl p-6">
                        <p
                          className="text-white/45 uppercase mb-4"
                          style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: 11,
                            letterSpacing: "0.22em",
                            fontWeight: 500,
                          }}
                        >
                          Uma pesquisa na LOA revela:
                        </p>
                        <ul className="space-y-3">
                          {[
                            "Se o precatório existe, pertence ao credor e se foi transferido",
                            "Se está inscrito no orçamento público",
                            "Se há previsão de pagamento no exercício",
                            "Se há valor reservado para quitação",
                            "Qual órgão público é responsável pelo pagamento",
                            "Execução financeira — quanto já foi pago e quanto resta",
                          ].map((text) => (
                            <li key={text} className="flex items-start gap-2.5">
                              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-indigo-300/80" />
                              <span
                                className="text-sm text-slate-300 leading-snug"
                                style={{ fontFamily: "'Lora', Georgia, serif" }}
                              >
                                {text}
                              </span>
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
                        className={`relative rounded-xl p-6 transition-all group border bg-[#0b1018] ${f.border ?? "border-white/[0.08] hover:border-indigo-400/40"}`}
                        data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {f.highlight && (
                          <div className="absolute top-3 right-3">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 uppercase tabular-nums"
                              style={{
                                fontFamily: "'Playfair Display', Georgia, serif",
                                fontSize: 10,
                                letterSpacing: "0.18em",
                                fontWeight: 600,
                              }}
                            >
                              2024–2028
                            </span>
                          </div>
                        )}
                        <div className={`w-10 h-10 rounded-lg ${feature.bg} flex items-center justify-center mb-4 border border-white/[0.08] group-hover:border-indigo-400/40 transition-colors`}>
                          <feature.icon className={`w-5 h-5 ${feature.color}`} />
                        </div>
                        <h3
                          className={`mb-2 ${f.highlight ? "text-emerald-200" : "text-white"}`}
                          style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: 19,
                            fontWeight: 500,
                            letterSpacing: "-0.015em",
                          }}
                        >
                          {feature.title}
                        </h3>
                        <p
                          className="text-sm text-slate-400 leading-relaxed"
                          style={{ fontFamily: "'Lora', Georgia, serif" }}
                        >
                          {feature.description}
                        </p>
                        {f.highlight && (
                          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 font-medium">
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
            <div className="flex items-center justify-center gap-3 mb-4">
              <span
                className="text-white/40 uppercase"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 11,
                  letterSpacing: "0.30em",
                  fontWeight: 500,
                }}
              >
                Performance
              </span>
            </div>
            <h2
              className="mb-5"
              data-testid="text-timeline-title"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 500,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
                color: "white",
              }}
            >
              Due Diligence:{" "}
              <span className="text-white/35 line-through decoration-red-500/40">Manual</span>{" "}
              <span className="italic text-white/50">vs</span>{" "}
              <span className="text-indigo-300">Digital</span>
            </h2>
            <p
              className="text-white/55 text-lg max-w-2xl mx-auto leading-relaxed"
              style={{ fontFamily: "'Lora', Georgia, serif" }}
            >
              Transforme <span className="text-white/80 tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>44 horas</span> de revisão em{" "}
              <span className="text-indigo-300 tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>82 segundos</span>. Redução drástica de tempo com precisão forense e auditoria em tempo real.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 opacity-90 flex flex-col" data-testid="card-manual-process">
              <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
                <h3
                  className="text-slate-400"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 26,
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Processo Tradicional
                </h3>
                <div className="text-right">
                  <span
                    className="block text-red-400 tabular-nums"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 32,
                      fontWeight: 600,
                      letterSpacing: "-0.025em",
                    }}
                  >
                    ~44h
                  </span>
                  <span className="text-slate-500 text-sm" style={{ fontFamily: "'Lora', Georgia, serif" }}>Revisão manual média</span>
                </div>
              </div>
              <ul className="space-y-6 flex-grow">
                <li className="border-l-2 border-slate-700 pl-4" data-testid="timeline-manual-step-0">
                  <p className="font-semibold text-slate-300">Coleta Manual <span className="text-slate-500 font-serif tabular-nums text-sm ml-2">22h</span></p>
                  <p className="text-sm text-slate-500 mt-1">Acesso individual a cada tribunal (TRF1-6, TJSP). Consulta processo por processo.</p>
                </li>
                <li className="border-l-2 border-slate-700 pl-4" data-testid="timeline-manual-step-1">
                  <p className="font-semibold text-slate-300">Cruzamento em Planilhas <span className="text-slate-500 font-serif tabular-nums text-sm ml-2">15h</span></p>
                  <p className="text-sm text-slate-500 mt-1">Montagem manual cruzando dotação x execução. Copiar/colar suscetível a erro humano.</p>
                </li>
                <li className="border-l-2 border-slate-700 pl-4" data-testid="timeline-manual-step-2">
                  <p className="font-semibold text-slate-300">Validação Individual <span className="text-slate-500 font-serif tabular-nums text-sm ml-2">7h</span></p>
                  <p className="text-sm text-slate-500 mt-1">Conferência manual de cada valor e busca de PDFs oficiais.</p>
                </li>
              </ul>
            </div>

            <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-8 shadow-[0_0_40px_rgba(129,140,248,0.10)] relative flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(129,140,248,0.22)]" data-testid="card-digital-process">
              <div
                className="absolute -top-4 right-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/40 backdrop-blur-sm uppercase tabular-nums"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 11,
                  letterSpacing: "0.20em",
                  fontWeight: 600,
                  color: "#fbbf24",
                }}
              >
                <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                ~1.900× mais rápido
              </div>
              <div className="flex items-center justify-between mb-8 border-b border-indigo-900/60 pb-4">
                <h3
                  className="text-white flex items-center gap-2"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 26,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                  }}
                >
                  <Zap className="w-5 h-5 text-indigo-400" />
                  AuraLOA
                </h3>
                <div className="text-right">
                  <span
                    className="block text-indigo-300 tabular-nums"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 32,
                      fontWeight: 600,
                      letterSpacing: "-0.025em",
                    }}
                  >
                    ~82s
                  </span>
                  <span className="text-indigo-300/70 text-sm" style={{ fontFamily: "'Lora', Georgia, serif" }}>Economia de 88%</span>
                </div>
              </div>
              <ul className="space-y-6 flex-grow">
                <li className="border-l-2 border-indigo-400 pl-4" data-testid="timeline-digital-step-0">
                  <p className="font-semibold text-white">Coleta Automatizada <span className="text-indigo-300 font-serif tabular-nums text-sm ml-2 tabular-nums">40s</span></p>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">APIs oficiais (Portal da Transparência, DataJud, SIOP). 10.000+ processos/consulta.</p>
                </li>
                <li className="border-l-2 border-indigo-400 pl-4" data-testid="timeline-digital-step-1">
                  <p className="font-semibold text-white">Cruzamento 4 Camadas <span className="text-indigo-300 font-serif tabular-nums text-sm ml-2 tabular-nums">25s</span></p>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">Dotação, Execução, Estoque e Valores PDF cruzados com matching automático.</p>
                </li>
                <li className="border-l-2 border-indigo-400 pl-4" data-testid="timeline-digital-step-2">
                  <p className="font-semibold text-white">Validação & Evidência SHA-256 <span className="text-indigo-300 font-serif tabular-nums text-sm ml-2 tabular-nums">17s</span></p>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">Cada dado validado contra a fonte oficial. Hash SHA-256 automático de cada payload. Cadeia de custódia íntegra.</p>
                </li>
              </ul>
              <Link href="/login">
                <button className="mt-8 w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-lg transition-colors" data-testid="button-iniciar-automacao">
                  Iniciar Automação
                </button>
              </Link>
            </div>

          </div>
        </div>
      </section>

      <MarketOverview />

      <section className="py-14 md:py-20 border-t border-white/[0.05] bg-[hsl(222_9%_9%)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 text-center">
          <span
            className="block text-white/40 uppercase mb-3"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 11,
              letterSpacing: "0.30em",
              fontWeight: 500,
            }}
          >
            Procedência
          </span>
          <h2
            className="text-white mb-3"
            data-testid="text-sources-title"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Fontes Oficiais
          </h2>
          <p
            className="text-white/55 italic mb-10 max-w-lg mx-auto"
            style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 15 }}
          >
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
          <Card className="bg-white/[0.02] border-indigo-500/20 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/[0.05] via-transparent to-indigo-500/[0.02]" />
            <CardContent className="p-8 md:p-10 text-center relative z-10">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 w-fit mx-auto mb-4">
                <Zap className="w-5 h-5 text-indigo-300" />
              </div>
              <h2
                className="mb-3 text-white"
                data-testid="text-cta-title"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 26,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                Comece agora
              </h2>
              <p
                className="text-white/55 mb-7 max-w-sm mx-auto"
                style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 15, lineHeight: 1.55 }}
              >
                Acesse a plataforma e pesquise precatórios com cadeia de custódia completa.
              </p>
              <Link href="/login">
                <button
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-indigo-500 text-sm font-semibold text-white hover:bg-indigo-400 transition-all shadow-[0_0_24px_rgba(129,140,248,0.30)] hover:shadow-[0_0_32px_rgba(129,140,248,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e1a]"
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
