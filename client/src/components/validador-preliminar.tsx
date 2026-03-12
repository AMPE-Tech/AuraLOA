import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Search, FileUp, Lock, CheckCircle2, Zap, Users, TrendingUp } from "lucide-react";

export function ValidadorPreliminarLOA() {
  const [, navigate] = useLocation();
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "result">("idle");
  const [scanStep, setScanStep] = useState(0);

  const scanMessages = [
    "Conectando ao DataJud CNJ...",
    "Verificando integridade do processo...",
    "Cruzando dados com a LOA 2026...",
    "Validando cadeia de custódia...",
  ];

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;
    if (scanStatus === "scanning") {
      interval = setInterval(() => {
        setScanStep((prev) => (prev < scanMessages.length - 1 ? prev + 1 : prev));
      }, 800);
      timeout = setTimeout(() => {
        setScanStatus("result");
      }, 3500);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [scanStatus]);

  const handleStartScan = () => {
    setScanStatus("scanning");
    setScanStep(0);
  };

  const handleReset = () => {
    setScanStatus("idle");
    setScanStep(0);
  };

  return (
    <section className="w-full max-w-[1400px] mx-auto py-10 relative z-20 -mt-10 px-4 sm:px-6">

      {/* Faixa de prova social */}
      <div className="flex items-center justify-center gap-3 mb-5 flex-wrap">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400 text-xs">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          Ferramenta gratuita · usada por advogados, investidores e gestores públicos
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <TrendingUp className="w-3 h-3" />
          +2.300 consultas realizadas este mês
        </div>
      </div>

      {/* Card principal com glow */}
      <div className="relative">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500/40 via-cyan-400/20 to-blue-500/40 blur-[2px]" />
        <div className="relative bg-[#080e1c] border border-blue-500/25 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(37,99,235,0.12)] overflow-hidden">

          {/* Linha topo gradiente */}
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-70" />

          {/* Badge FREE TOOL */}
          <div className="absolute top-5 right-5 z-10">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gradient-to-r from-blue-400/20 to-cyan-300/20 border border-blue-400/30 text-[10px] font-bold text-blue-300 uppercase tracking-widest">
              <Zap className="w-3 h-3 text-cyan-300" />
              Free Tool
            </span>
          </div>

          <div className="p-7 md:p-10">
            <div className="flex flex-col md:flex-row gap-10 items-start">

              {/* Lado esquerdo — proposta de valor */}
              <div className="flex-[1.1] w-full">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verificação Gratuita
                </div>

                <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
                  Verificação Gratuita de{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                    Precatórios
                  </span>{" "}
                  em Bases Oficiais
                </h3>

                <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-md">
                  Confirme em segundos se um precatório realmente existe nas bases do Judiciário e da Lei Orçamentária.{" "}
                  <span className="text-slate-300">Proteja-se contra fraudes e documentos falsos.</span>
                </p>

                <ul className="space-y-3">
                  {[
                    "Detecta documentos falsos e adulterados",
                    "Consulta tribunais automaticamente (TRFs e TJs)",
                    "Verificação em menos de 10 segundos",
                    "Nenhum cadastro necessário",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 pt-6 border-t border-slate-800/60 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {["A", "B", "C"].map((l) => (
                      <div key={l} className="w-7 h-7 rounded-full bg-slate-700 border-2 border-[#080e1c] flex items-center justify-center text-[9px] text-slate-300 font-bold">
                        {l}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Usado por{" "}
                    <span className="text-slate-300 font-medium">advogados e investidores</span>{" "}
                    em todo o Brasil
                  </p>
                </div>
              </div>

              {/* Lado direito — formulário dinâmico */}
              <div className="flex-1 w-full bg-[#0b1120] border border-slate-800/80 rounded-xl p-6 relative min-h-[260px] flex flex-col justify-center">

                {/* Estado 1: Idle */}
                {scanStatus === "idle" && (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex gap-4 mb-5 border-b border-slate-800 pb-3">
                      <button className="text-blue-400 text-sm font-medium flex items-center gap-2 border-b-2 border-blue-400 pb-3 -mb-[14px]" data-testid="tab-cnj">
                        <Search className="w-4 h-4" /> CNJ / Processo
                      </button>
                      <button className="text-slate-500 hover:text-slate-300 text-sm font-medium flex items-center gap-2 transition-colors" data-testid="tab-upload">
                        <FileUp className="w-4 h-4" /> Upload de PDF
                      </button>
                    </div>

                    <div className="space-y-3 mt-4">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Ex: CNJ 1002345-67.2023.4.01.0000"
                          className="w-full bg-[#0f172a] border border-slate-700 text-white text-sm rounded-lg pl-4 pr-10 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 font-mono"
                          data-testid="input-cnj"
                        />
                        <Search className="absolute right-3 top-3.5 w-4 h-4 text-slate-500" />
                      </div>

                      <button
                        onClick={handleStartScan}
                        className="w-full bg-gradient-to-r from-blue-400 to-cyan-300 hover:opacity-90 text-slate-900 font-semibold py-3 rounded-lg transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-blue-400/25"
                        data-testid="button-iniciar-varredura"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Verificar Precatório Agora
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Consulta gratuita", "Sem cadastro", "Dados oficiais"].map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 text-[10px] text-slate-500 px-2 py-1 rounded bg-slate-800/50 border border-slate-700/50">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500/70" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Estado 2: Scanning */}
                {scanStatus === "scanning" && (
                  <div className="flex flex-col items-center justify-center py-6 animate-in zoom-in-95 duration-300">
                    <div className="relative mb-6">
                      <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin" />
                      <Search className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-400" />
                    </div>
                    <h4 className="text-white font-medium mb-2">Consultando Bases Oficiais...</h4>
                    <div className="h-5 flex items-center justify-center overflow-hidden">
                      <p className="text-xs font-mono text-cyan-400 animate-pulse">
                        &gt; {scanMessages[scanStep]}
                      </p>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-6 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full"
                        style={{ animation: "fillBar 3.5s forwards ease-out" }}
                      />
                    </div>
                    <style>{`@keyframes fillBar { from { width: 0%; } to { width: 100%; } }`}</style>
                  </div>
                )}

                {/* Estado 3: Resultado */}
                {scanStatus === "result" && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3 mb-4 border-b border-emerald-900/50 pb-4">
                      <div className="bg-emerald-500/20 p-2 rounded-full">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-emerald-400 font-bold">Precatório Autêntico</h4>
                        <p className="text-[10px] text-slate-400 font-mono">Status: Válido · Fonte: TRF / DataJud</p>
                      </div>
                    </div>

                    <div className="relative rounded-lg border border-slate-800 bg-slate-900/50 p-4 mb-4 overflow-hidden">
                      <div className="absolute inset-0 backdrop-blur-md bg-[#0B0F19]/60 z-10 flex flex-col items-center justify-center gap-1.5 px-4 text-center">
                        <Lock className="w-5 h-5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-200">Quer ver valores, credor e análise completa?</span>
                        <span className="text-[10px] text-slate-500">Crie sua conta gratuita para desbloquear</span>
                      </div>
                      <div className="space-y-2 opacity-20 select-none pointer-events-none">
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Valor Atualizado:</span>
                          <span className="text-xs font-mono text-white">R$ 1.254.300,00</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Status LOA:</span>
                          <span className="text-xs text-white">Inscrito (2025)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Credor:</span>
                          <span className="text-xs text-white">João S. M. (CPF: ***.456.***-**)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleReset}
                        className="px-3 py-2.5 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
                        data-testid="button-reset-scan"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate("/login")}
                        className="flex-1 bg-gradient-to-r from-blue-400 to-cyan-300 hover:opacity-90 text-slate-900 font-bold py-2.5 rounded-lg transition-opacity text-sm shadow-[0_0_20px_rgba(96,165,250,0.3)]"
                        data-testid="button-login-resultado"
                      >
                        Criar Conta Gratuita →
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
