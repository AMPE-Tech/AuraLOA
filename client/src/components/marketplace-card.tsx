import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const FONT_DISPLAY = "'Playfair Display', Georgia, serif";
const FONT_BODY = "'Lora', Georgia, serif";

export function MarketplaceCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative h-full"
      data-testid="marketplace-card"
    >
      {/* Glow externo (espelha o validador esquerdo) */}
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-indigo-500/40 via-amber-400/15 to-indigo-500/40 blur-[2px]" />
      <div className="relative h-full bg-[#080e1c] border border-indigo-500/25 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(129,140,248,0.12)] overflow-hidden flex flex-col">
        {/* Hairline superior */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-70" />

        <div className="p-8 md:p-12 flex flex-col h-full">
          {/* Eyebrow com pulse dot */}
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
            <span
              className="uppercase text-indigo-300/75"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 11,
                letterSpacing: "0.30em",
                fontWeight: 500,
              }}
            >
              Marketplace AuraLOA · Liquidez institucional
            </span>
          </div>

          {/* Headline */}
          <h3
            className="text-white mb-3"
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: "clamp(1.5rem, 2.4vw, 1.875rem)",
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
            }}
          >
            Da validação à liquidez —<br />
            em uma única infraestrutura.
          </h3>

          {/* Sub-headline italic narrative */}
          <p
            className="text-white/55 italic max-w-md"
            style={{
              fontFamily: FONT_BODY,
              fontSize: 14.5,
              lineHeight: 1.55,
              fontWeight: 400,
            }}
          >
            Conectamos credores e investidores institucionais com cadeia de custódia auditável e due diligence pronta antes da negociação.
          </p>

          {/* Hairline divider */}
          <div className="my-7 h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />

          {/* Dual-side: VENDER | COMPRAR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-7 relative">
            {/* Divisória vertical com dot central (apenas em md+) */}
            <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-[80%] bg-gradient-to-b from-transparent via-white/10 to-transparent" aria-hidden="true">
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)]" />
            </div>

            {/* Quero Vender */}
            <div className="md:pr-3">
              <div
                className="uppercase mb-3"
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  fontWeight: 600,
                  color: "rgba(251,191,36,0.85)",
                }}
              >
                Quero Vender
              </div>
              <p
                className="text-white/65 mb-2"
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  lineHeight: 1.55,
                  fontWeight: 400,
                }}
              >
                Tem precatório federal ou estadual e quer antecipar o recebimento sem esperar o ciclo orçamentário?
              </p>
              <p
                className="text-white/50"
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  lineHeight: 1.55,
                  fontStyle: "italic",
                }}
              >
                Conectamos você a fundos e family offices com critério de compra publicado. Proposta em até 72h.
              </p>
            </div>

            {/* Quero Comprar */}
            <div className="md:pl-3">
              <div
                className="uppercase mb-3"
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  fontWeight: 600,
                  color: "rgba(251,191,36,0.85)",
                }}
              >
                Quero Comprar
              </div>
              <p
                className="text-white/65 mb-2"
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  lineHeight: 1.55,
                  fontWeight: 400,
                }}
              >
                É investidor institucional ou family office em busca de pipeline curado de precatórios federais?
              </p>
              <p
                className="text-white/50"
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  lineHeight: 1.55,
                  fontStyle: "italic",
                }}
              >
                Acesse oportunidades com valor presente, status orçamentário e SHA-256 em cada payload.
              </p>
            </div>
          </div>

          {/* Spacer flexível pra empurrar CTAs ao rodapé */}
          <div className="flex-grow min-h-[16px]" />

          {/* Hairline antes dos CTAs */}
          <div className="my-6 h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />

          {/* CTA único */}
          <Link href="/marketplace">
            <button
              type="button"
              className="w-full inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-[0_0_24px_rgba(129,140,248,0.30)] hover:shadow-[0_0_32px_rgba(129,140,248,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080e1c]"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.03em",
              }}
              data-testid="button-marketplace-primary"
            >
              Acessar Marketplace
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>

          {/* Prova social/garantia (1 linha) */}
          <div className="mt-5 flex items-center gap-2.5">
            <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
            <span
              className="text-white/40 italic"
              style={{
                fontFamily: FONT_BODY,
                fontSize: 11.5,
                letterSpacing: "0.02em",
                lineHeight: 1.4,
              }}
            >
              Cadeia de custódia SHA-256 em cada negociação · Lei 13.964/2019 compliant
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
