import { MarketOverview } from "@/components/market-overview";
import { MarketOverviewV2 } from "@/components/market-overview-v2";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Layers } from "lucide-react";

export default function MarketPreview() {
  return (
    <div className="min-h-screen bg-[hsl(225_10%_6%)] text-foreground">

      {/* Barra de preview */}
      <div className="sticky top-0 z-50 border-b border-slate-700/50 bg-[hsl(222_9%_9%)/95] backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-mono text-slate-300 font-semibold">PREVIEW — Comparação do Dashboard</span>
            <span className="text-[9px] font-mono text-slate-600 border border-slate-700 px-1.5 py-0.5 rounded">Apenas visualização — nenhuma mudança aplicada</span>
          </div>
          <Link href="/">
            <button className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 hover:text-slate-200 transition-colors">
              <ArrowLeft className="w-3 h-3" />
              Voltar ao site
            </button>
          </Link>
        </div>
      </div>

      {/* Versão ATUAL */}
      <div>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-8 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/40 border border-slate-600/50">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-[10px] font-mono text-slate-300 font-semibold tracking-wider uppercase">Versão Atual (produção)</span>
            </div>
            <span className="text-[9px] font-mono text-slate-600">Recharts + shadcn Cards + fundo slate</span>
          </div>
        </div>
        <div className="border-b border-slate-700/30 mb-2">
          <MarketOverview />
        </div>
      </div>

      {/* Separador */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/20 bg-blue-500/5">
            <ArrowRight className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-mono text-blue-300 tracking-wider uppercase font-semibold">Proposta de atualização</span>
            <ArrowRight className="w-3 h-3 text-blue-400" />
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        </div>
      </div>

      {/* Versão NOVA */}
      <div>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-2 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[10px] font-mono text-blue-300 font-semibold tracking-wider uppercase">Versão Nova (proposta)</span>
            </div>
            <span className="text-[9px] font-mono text-slate-600">SVG nativo + gradiente navy + grid overlay + animações</span>
          </div>
        </div>
        <MarketOverviewV2 />
      </div>

      {/* Botões de decisão */}
      <div className="border-t border-slate-700/30 bg-[hsl(222_9%_9%)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-xs font-mono text-slate-400">Qual versão prefere aplicar?</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 bg-slate-800/40">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-[10px] font-mono text-slate-300">Manter atual — diga "manter"</span>
            </div>
            <span className="text-[10px] font-mono text-slate-600">ou</span>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[10px] font-mono text-blue-300">Aplicar nova versão — diga "aplicar"</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
