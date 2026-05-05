import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, FileSearch, Hash, Send, CheckCircle2, Lock } from "lucide-react";
import { PublicTopbar } from "@/components/public-topbar";
import { PublicFooter } from "@/components/public-footer";

const FONT_DISPLAY = "'Playfair Display', Georgia, serif";
const FONT_BODY = "'Lora', Georgia, serif";
const WA_VENDER = "https://wa.me/5511995300144?text=Ol%C3%A1%2C%20sou%20credor%20de%20precat%C3%B3rio%20e%20gostaria%20de%20cadastrar%20oferta%20no%20Marketplace%20AuraLOA";
const WA_COMPRAR = "https://wa.me/5511995300144?text=Ol%C3%A1%2C%20sou%20investidor%20institucional%20e%20gostaria%20de%20acessar%20o%20pipeline%20do%20Marketplace%20AuraLOA";

const steps = [
  {
    icon: FileSearch,
    title: "Validação prévia",
    description: "Cada precatório passa pela due diligence AuraLOA antes de entrar no pipeline — origem, valor presente e status orçamentário verificados.",
  },
  {
    icon: Hash,
    title: "Cadeia de custódia SHA-256",
    description: "Toda evidência é hasheada e timestampada. Investidores recebem o pacote auditável; credores mantêm rastreabilidade jurídica.",
  },
  {
    icon: ShieldCheck,
    title: "KYC institucional",
    description: "Investidores cadastrados passam por verificação de origem de capital e qualificação. Negociações sob NDA.",
  },
  {
    icon: Send,
    title: "Conexão direta",
    description: "Sem intermediários ocultos. Originador AuraLOA aproxima as partes, com proposta formal em até 72h após cadastro.",
  },
];

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-[hsl(225_25%_5%)] text-foreground">
      <PublicTopbar />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/[0.05]" data-testid="section-marketplace-hero">
        {/* atmosfera */}
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(225_30%_4%)] via-[hsl(220_35%_6%)] to-[hsl(225_25%_5%)]" />
        <div className="absolute top-[-15%] left-1/3 w-[820px] h-[460px] rounded-full bg-indigo-600/[0.10] blur-[140px]" />
        <div className="absolute top-[10%] right-[5%] w-[480px] h-[360px] rounded-full bg-amber-500/[0.04] blur-[120px]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03] mix-blend-overlay pointer-events-none" aria-hidden="true">
          <filter id="mkt-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.7 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#mkt-noise)" />
        </svg>

        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-20 md:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            <div className="inline-flex items-center gap-3">
              <span className="w-8 h-px bg-indigo-400/40" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span
                className="uppercase text-indigo-300/80"
                style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.32em", fontWeight: 500 }}
              >
                Marketplace AuraLOA · Liquidez institucional
              </span>
              <span className="w-8 h-px bg-indigo-400/40" />
            </div>
          </motion.div>

          <motion.h1
            className="text-white mb-6 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: "clamp(2.25rem, 5vw, 4.25rem)",
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
            }}
          >
            Onde precatórios{" "}
            <span className="italic text-indigo-300">encontram</span>{" "}
            liquidez.
          </motion.h1>

          <motion.p
            className="text-white/55 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            style={{ fontFamily: FONT_BODY, fontSize: 17, lineHeight: 1.6, fontStyle: "italic" }}
          >
            Aproximamos credores qualificados e investidores institucionais com cadeia de custódia auditável e due diligence pronta antes de cada negociação.
          </motion.p>

          {/* Disclosure honesto — fase beta institucional */}
          <motion.div
            className="mt-10 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-amber-400/[0.06] border border-amber-400/25"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.55 }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span
              className="uppercase text-amber-300"
              style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.22em", fontWeight: 600 }}
            >
              Onboarding institucional aberto · Acesso por convite
            </span>
          </motion.div>
        </div>
      </section>

      {/* DUAL-SIDE: VENDER | COMPRAR */}
      <section className="py-20 md:py-24 border-b border-white/[0.05] bg-[hsl(220_8%_7%)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <span
              className="block text-white/40 uppercase mb-3"
              style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.30em", fontWeight: 500 }}
            >
              Dois lados · Uma infraestrutura
            </span>
            <h2
              className="text-white mb-3"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Como você quer operar?
            </h2>
            <p
              className="text-white/55 italic max-w-xl mx-auto"
              style={{ fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.55 }}
            >
              O AuraLOA conecta os dois lados sob a mesma cadeia de custódia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* VENDER */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
              data-testid="card-vender"
            >
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-amber-400/30 via-indigo-500/10 to-amber-400/30 blur-[2px]" />
              <div className="relative h-full bg-[#080e1c] border border-amber-400/25 rounded-2xl p-8 md:p-10 flex flex-col">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span
                    className="uppercase text-amber-300/85"
                    style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.28em", fontWeight: 600 }}
                  >
                    Sou credor
                  </span>
                </div>

                <h3
                  className="text-white mb-3"
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 28,
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                  }}
                >
                  Quero vender meu precatório.
                </h3>

                <p
                  className="text-white/60 mb-6"
                  style={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6 }}
                >
                  Antecipe o recebimento sem esperar o ciclo orçamentário. Conectamos você a fundos e family offices com critério de compra publicado.
                </p>

                <ul className="space-y-3 mb-8 flex-grow">
                  {[
                    "Federal, estadual e municipal — todas as esferas",
                    "Análise de valor presente e cessibilidade incluída",
                    "Proposta formal em até 72h após cadastro",
                    "Sem custo prévio · comissão apenas em fechamento",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-amber-300/80" />
                      <span
                        className="text-white/70"
                        style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.55 }}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>

                <a href={WA_VENDER} target="_blank" rel="noopener noreferrer">
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-amber-400 text-[#0a0e1a] hover:bg-amber-300 transition-all shadow-[0_0_24px_rgba(251,191,36,0.25)] hover:shadow-[0_0_32px_rgba(251,191,36,0.40)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080e1c]"
                    style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 600, letterSpacing: "0.04em" }}
                    data-testid="button-cadastrar-credor"
                  >
                    Cadastrar oferta de precatório
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </a>
              </div>
            </motion.div>

            {/* COMPRAR */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
              data-testid="card-comprar"
            >
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-indigo-500/40 via-amber-400/10 to-indigo-500/40 blur-[2px]" />
              <div className="relative h-full bg-[#080e1c] border border-indigo-500/30 rounded-2xl p-8 md:p-10 flex flex-col">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span
                    className="uppercase text-indigo-300/85"
                    style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.28em", fontWeight: 600 }}
                  >
                    Sou investidor
                  </span>
                </div>

                <h3
                  className="text-white mb-3"
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 28,
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                  }}
                >
                  Quero acessar pipeline curado.
                </h3>

                <p
                  className="text-white/60 mb-6"
                  style={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6 }}
                >
                  Receba oportunidades pré-validadas com due diligence AuraLOA — valor presente, status orçamentário e cadeia de custódia SHA-256 em cada payload.
                </p>

                <ul className="space-y-3 mb-8 flex-grow">
                  {[
                    "Acesso restrito a fundos, family offices e gestoras",
                    "Pipeline atualizado por exercício orçamentário",
                    "Pacote de evidências auditável por operação",
                    "KYC institucional · NDA padrão antes do data room",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-indigo-300/80" />
                      <span
                        className="text-white/70"
                        style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.55 }}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>

                <a href={WA_COMPRAR} target="_blank" rel="noopener noreferrer">
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-[0_0_24px_rgba(129,140,248,0.30)] hover:shadow-[0_0_32px_rgba(129,140,248,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080e1c]"
                    style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 600, letterSpacing: "0.04em" }}
                    data-testid="button-cadastrar-investidor"
                  >
                    Solicitar acesso ao pipeline
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-20 md:py-24 border-b border-white/[0.05] bg-[hsl(225_25%_5%)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <span
              className="block text-white/40 uppercase mb-3"
              style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.30em", fontWeight: 500 }}
            >
              Trust layer
            </span>
            <h2
              className="text-white mb-3"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Como o Marketplace funciona.
            </h2>
            <p
              className="text-white/55 italic max-w-2xl mx-auto"
              style={{ fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.55 }}
            >
              Cada operação atravessa quatro camadas de verificação antes de virar negociação.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="relative bg-[#0b1018] border border-white/[0.08] rounded-xl p-6 hover:border-indigo-400/40 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="text-amber-400/80 tabular-nums"
                    style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.18em", fontWeight: 500 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 h-px bg-gradient-to-r from-amber-400/30 via-white/[0.06] to-transparent" />
                  <step.icon className="w-4 h-4 text-white/55" />
                </div>
                <h4
                  className="text-white mb-2"
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 18,
                    fontWeight: 500,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {step.title}
                </h4>
                <p
                  className="text-white/55"
                  style={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.55 }}
                >
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* GARANTIAS TÉCNICAS */}
      <section className="py-20 border-b border-white/[0.05] bg-[hsl(220_8%_7%)]">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 text-center">
          <Lock className="w-5 h-5 text-white/40 mx-auto mb-4" />
          <h2
            className="text-white mb-4"
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            Garantias técnicas.
          </h2>
          <p
            className="text-white/55 italic mb-8 max-w-2xl mx-auto"
            style={{ fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.6 }}
          >
            Nenhuma análise pode ser refutada por falta de evidência. Toda operação fica auditável fora da plataforma.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              "SHA-256 em cada payload",
              "Lei 13.964/2019 compliant",
              "LGPD · dados sob NDA",
              "Auditoria AuraTECH",
            ].map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.02] text-white/60"
                style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1 }}
              >
                <span className="w-1 h-1 rounded-full bg-emerald-400/80" />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 bg-[hsl(225_25%_5%)]">
        <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
          <h2
            className="text-white mb-4"
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            Quer validar um precatório antes de negociar?
          </h2>
          <p
            className="text-white/55 italic mb-7"
            style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6 }}
          >
            Use o validador gratuito do AuraLOA. Confere existência, integridade documental e cadeia de custódia em segundos.
          </p>
          <Link href="/">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full border border-white/[0.10] text-white/80 hover:text-white hover:border-indigo-400/40 hover:bg-white/[0.03] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e1a]"
              style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500, letterSpacing: "0.03em" }}
              data-testid="button-back-validador"
            >
              Validar precatório agora
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-6">
        <PublicFooter />
      </div>
    </div>
  );
}
