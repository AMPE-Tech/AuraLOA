import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Search, FileUp, Lock, AlertCircle, CheckCircle2 } from "lucide-react";

export function ValidadorPreliminarLOA() {
  const [, navigate] = useLocation();
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "result">("idle");
  const [scanStep, setScanStep] = useState(0);

  const scanMessages = [
    "Conectando ao DataJud...",
    "Verificando integridade do CNJ...",
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
    <section className="w-full max-w-[1400px] mx-auto py-8 relative z-20 -mt-10 px-4 sm:px-6">
      <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-3xl pointer-events-none" />

      <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden transition-all duration-500 min-h-[380px] flex flex-col justify-center">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />

        <div className="flex flex-col md:flex-row gap-8 items-start">

          {/* Lado esquerdo — fixo */}
          <div className="flex-1 w-full">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verificação Gratuita
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Valide a existência do Precatório
            </h3>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              Proteja-se contra fraudes e falsos representantes. Utilize nosso motor de extração para confirmar se o ofício requisitório ou processo é válido nas bases oficiais.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-xs text-slate-500">
                <Lock className="w-3.5 h-3.5 text-slate-600" />
                Detecção de documentos adulterados
              </li>
              <li className="flex items-center gap-2 text-xs text-slate-500">
                <Lock className="w-3.5 h-3.5 text-slate-600" />
                Consulta em tempo real (TRFs e TJs)
              </li>
            </ul>
          </div>

          {/* Lado direito — dinâmico */}
          <div className="flex-1 w-full bg-[#0B0F19] border border-slate-800 rounded-xl p-5 relative min-h-[250px] flex flex-col justify-center">

            {/* Estado 1: Ocioso */}
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

                <div className="space-y-3">
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
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                    data-testid="button-iniciar-varredura"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Iniciar Varredura
                  </button>
                </div>

                <div className="mt-4 flex items-start gap-2 bg-slate-800/30 rounded p-2.5 border border-slate-700/50">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Esta é uma validação básica. Valores atualizados, gravames e contato do credor exigem acesso autenticado à plataforma.
                  </p>
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
                <h4 className="text-white font-medium mb-2">Analisando Evidências...</h4>
                <div className="h-5 flex items-center justify-center overflow-hidden">
                  <p className="text-xs font-mono text-cyan-400 animate-pulse">
                    &gt; {scanMessages[scanStep]}
                  </p>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-6 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
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
                    <p className="text-[10px] text-slate-400 font-mono">Status: Válido • Fonte: TRF / DataJud</p>
                  </div>
                </div>

                <div className="relative rounded-lg border border-slate-800 bg-slate-900/50 p-4 mb-4 overflow-hidden">
                  <div className="absolute inset-0 backdrop-blur-md bg-[#0B0F19]/60 z-10 flex flex-col items-center justify-center">
                    <Lock className="w-6 h-6 text-slate-400 mb-2" />
                    <span className="text-xs font-medium text-slate-300">Dados restritos a usuários logados</span>
                  </div>
                  <div className="space-y-2 opacity-30 select-none pointer-events-none">
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
                    className="px-3 py-2 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
                    data-testid="button-reset-scan"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate("/login")}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)] text-sm"
                    data-testid="button-login-resultado"
                  >
                    Fazer Login para ver tudo
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
}
