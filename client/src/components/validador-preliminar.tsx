import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  ShieldCheck,
  Search,
  Lock,
  CheckCircle2,
  Users,
  TrendingUp,
  Upload,
  FileText,
  Hash,
  X,
} from "lucide-react";

type InputMode = "numero" | "upload";

export function ValidadorPreliminarLOA() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<InputMode>("numero");
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "result">("idle");
  const [scanStep, setScanStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setUploadedFile(null);
  };

  const handleFileChange = (file: File | null) => {
    if (file && file.type === "application/pdf") {
      setUploadedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <section className="w-full max-w-[1400px] mx-auto py-10 relative z-20 -mt-10 px-4 sm:px-6">

      {/* Faixa de prova social */}
      <div className="flex items-center justify-center gap-3 mb-5 flex-wrap">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400 text-sm">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          Ferramenta utilizada por advogados, investidores e gestores públicos
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
          <TrendingUp className="w-3.5 h-3.5" />
          +2.300 consultas realizadas este mês
        </div>
      </div>

      {/* Card unificado com glow */}
      <div className="relative">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500/40 via-cyan-400/20 to-blue-500/40 blur-[2px]" />
        <div className="relative bg-[#080e1c] border border-blue-500/25 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(37,99,235,0.12)] overflow-hidden">

          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-70" />

          <div className="p-8 md:p-12">

            {/* Estado 1: Idle */}
            {scanStatus === "idle" && (
              <div className="animate-in fade-in duration-300">

                {/* Badge */}
                <div className="flex justify-center mb-5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" />
                    Verificação Gratuita
                  </div>
                </div>

                {/* Título */}
                <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 text-center leading-tight">
                  Valide Seu{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                    Precatório ou Processo
                  </span>
                </h3>

                {/* Subtexto */}
                <p className="text-base text-slate-400 mb-8 leading-relaxed text-center max-w-2xl mx-auto">
                  Confirme se o processo ou precatório existe nas bases do Judiciário e da Lei Orçamentária.{" "}
                  <span className="text-slate-300">Proteja-se contra fraudes e documentos falsos.</span>
                </p>

                {/* Toggle de modo */}
                <div className="flex justify-center mb-8">
                  <div className="inline-flex rounded-xl bg-[#0b1120] border border-slate-700/60 p-1 gap-1">
                    <button
                      onClick={() => setMode("numero")}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        mode === "numero"
                          ? "bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      data-testid="tab-modo-numero"
                    >
                      <Hash className="w-4 h-4" />
                      Número do Processo
                    </button>
                    <button
                      onClick={() => setMode("upload")}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        mode === "upload"
                          ? "bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      data-testid="tab-modo-upload"
                    >
                      <Upload className="w-4 h-4" />
                      Upload do Ofício
                    </button>
                  </div>
                </div>

                {/* MODO 1: Número do Ofício + Número do Processo */}
                {mode === "numero" && (
                  <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className="space-y-3 mb-4">
                      {/* Campo Ofício Requisitório — vem primeiro, como no documento */}
                      <div className="relative">
                        <FileText className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Nº do Ofício Requisitório  —  Ex: 666 / 2021"
                          className="w-full bg-[#0b1120] border-2 border-slate-700 focus:border-blue-500 text-white text-base rounded-xl pl-14 pr-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600 font-mono shadow-inner"
                          data-testid="input-oficio"
                        />
                      </div>
                      {/* Campo processo CNJ */}
                      <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Nº CNJ do Processo  —  Ex: 1931-10.1990.4.01.3400"
                          className="w-full bg-[#0b1120] border-2 border-slate-700 focus:border-blue-500 text-white text-base rounded-xl pl-14 pr-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600 font-mono shadow-inner"
                          data-testid="input-cnj"
                        />
                      </div>
                      <p className="text-xs text-slate-600 text-center">
                        Informe um ou ambos os campos para cruzar as bases oficiais
                      </p>
                    </div>

                    <button
                      onClick={handleStartScan}
                      className="w-full bg-gradient-to-r from-blue-400 to-cyan-300 hover:opacity-90 text-slate-900 font-bold py-4 text-base rounded-xl transition-opacity flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(96,165,250,0.3)]"
                      data-testid="button-iniciar-varredura"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      Verificar Precatório Agora
                    </button>
                  </div>
                )}

                {/* MODO 2: Upload do Ofício Requisitório */}
                {mode === "upload" && (
                  <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-right-2 duration-200">
                    {!uploadedFile ? (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all mb-4 ${
                          isDragging
                            ? "border-blue-400 bg-blue-500/10 shadow-[0_0_30px_rgba(96,165,250,0.15)]"
                            : "border-slate-700 bg-[#0b1120] hover:border-blue-500/50 hover:bg-blue-500/[0.04]"
                        }`}
                        data-testid="dropzone-oficio"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                          data-testid="input-file-oficio"
                        />
                        <div className="flex flex-col items-center gap-3">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? "bg-blue-500/20 border border-blue-500/30" : "bg-slate-800 border border-slate-700"}`}>
                            <Upload className={`w-6 h-6 transition-colors ${isDragging ? "text-blue-400" : "text-slate-500"}`} />
                          </div>
                          <div>
                            <p className="text-white font-medium mb-1">
                              {isDragging ? "Solte o arquivo aqui" : "Arraste o Ofício Requisitório"}
                            </p>
                            <p className="text-slate-500 text-sm">
                              ou <span className="text-blue-400 hover:underline">clique para selecionar</span> um arquivo PDF
                            </p>
                          </div>
                          <p className="text-xs text-slate-600 font-mono mt-1">
                            Formato aceito: PDF · Máx. 10 MB
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-5 mb-4 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{uploadedFile.name}</p>
                          <p className="text-emerald-400/70 text-xs font-mono mt-0.5">{formatFileSize(uploadedFile.size)} · PDF</p>
                        </div>
                        <button
                          onClick={() => setUploadedFile(null)}
                          className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
                          data-testid="button-remover-arquivo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handleStartScan}
                      disabled={!uploadedFile}
                      className="w-full bg-gradient-to-r from-blue-400 to-cyan-300 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-slate-900 font-bold py-4 text-base rounded-xl transition-opacity flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(96,165,250,0.3)]"
                      data-testid="button-iniciar-varredura-upload"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      {uploadedFile ? "Verificar Ofício Agora" : "Selecione um arquivo PDF"}
                    </button>
                  </div>
                )}

                {/* Checklist */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 pt-8 mt-8 border-t border-slate-800/60">
                  {[
                    "Detecta documentos falsos e adulterados",
                    "Consulta tribunais automaticamente (TRFs e TJs)",
                    "Verificação em menos de 10 segundos",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-slate-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>

              </div>
            )}

            {/* Estado 2: Scanning */}
            {scanStatus === "scanning" && (
              <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in-95 duration-300">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin" />
                  <Search className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 text-blue-400" />
                </div>
                <h4 className="text-white text-lg font-semibold mb-2">Consultando Bases Oficiais...</h4>
                <div className="h-6 flex items-center justify-center overflow-hidden">
                  <p className="text-sm font-mono text-cyan-400 animate-pulse">
                    &gt; {scanMessages[scanStep]}
                  </p>
                </div>
                <div className="w-full max-w-md bg-slate-800 h-2 rounded-full mt-8 overflow-hidden">
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
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-6 border-b border-emerald-900/50 pb-5">
                  <div className="bg-emerald-500/20 p-2.5 rounded-full">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-emerald-400 font-bold text-lg">Precatório Autêntico</h4>
                    <p className="text-xs text-slate-400 font-mono">Status: Válido · Fonte: TRF / DataJud CNJ</p>
                  </div>
                </div>

                <div className="relative rounded-xl border border-slate-800 bg-slate-900/50 p-6 mb-5 overflow-hidden">
                  <div className="absolute inset-0 backdrop-blur-md bg-[#0B0F19]/60 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center">
                    <Lock className="w-6 h-6 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-200">Quer ver valores, credor e análise completa?</span>
                    <span className="text-xs text-slate-500">Crie sua conta gratuita para desbloquear</span>
                  </div>
                  <div className="space-y-3 opacity-20 select-none pointer-events-none">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Valor Atualizado:</span>
                      <span className="text-sm font-mono text-white">R$ 1.254.300,00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Status LOA:</span>
                      <span className="text-sm text-white">Inscrito (2025)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Credor:</span>
                      <span className="text-sm text-white">João S. M. (CPF: ***.456.***-**)</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="px-4 py-3 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
                    data-testid="button-reset-scan"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => navigate("/login")}
                    className="flex-1 bg-gradient-to-r from-blue-400 to-cyan-300 hover:opacity-90 text-slate-900 font-bold py-3 rounded-xl transition-opacity text-sm shadow-[0_0_20px_rgba(96,165,250,0.3)]"
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

    </section>
  );
}
