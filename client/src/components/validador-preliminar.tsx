import { useState, useRef } from "react";
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
  AlertTriangle,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";

type InputMode = "numero" | "upload";
type ScanStatus = "idle" | "scanning" | "found" | "not_found" | "error";
type ParseStatus = "idle" | "parsing" | "ready" | "partial" | "failed";

// ─── Extração de texto e regex ────────────────────────────────────────────────

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).href;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => item.str).join(" "));
  }
  return pages.join("\n");
}

function extractFieldsFromText(text: string): { cnj: string | null; oficio: string | null } {
  // CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
  const cnjMatch = text.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);

  // Ofício — múltiplos formatos:
  // AUT.2024.008667 | 2024.008667 | 666/2021 | Ofício nº 2024.08671/OFREQ
  const oficioPatterns = [
    /(?:Ofício|Oficio|OFREQ|nº|n\.\s*º)\s+(?:DEPRE\/\S+\s+nº\s+)?(AUT\.\d{4}\.\d+)/i,
    /\bAUT\.\d{4}\.\d+\b/,
    /Ofício\s+(?:\S+\s+)?nº?\s+([\d.]+\/\w+)/i,
    /(?:Ofício|Oficio)\s+(?:nº|n\.º)?\s*(\d{4}\.\d{5,}(?:\/\w+)?)/i,
    /\b(\d{3,6}\/\d{4})\b/,
    /(?:nº?|número)\s+([\w./-]{5,25})/i,
  ];

  let oficio: string | null = null;
  for (const pattern of oficioPatterns) {
    const m = text.match(pattern);
    if (m) {
      oficio = (m[1] || m[0]).trim();
      break;
    }
  }

  return { cnj: cnjMatch ? cnjMatch[0] : null, oficio };
}

interface ValidacaoResult {
  encontrado: boolean;
  numero_cnj: string;
  numero_oficio: string;
  tribunal: string;
  tipo: "PRECATORIO" | "RPV" | "DESCONHECIDO";
  situacao: string;
  grau: string | null;
  data_ajuizamento_ano: string | null;
  pagamento_pendente: boolean;
  url_consulta: string | null;
  sha256_evidencia: string;
  consultado_em: string;
}

const SCAN_MESSAGES = [
  "Consultando fontes oficiais...",
  "Verificando integridade do processo...",
  "Cruzando dados com a LOA 2026...",
  "Validando cadeia de custódia...",
];

const SITUACAO_LABELS: Record<string, string> = {
  em_tramitacao: "Em tramitação",
  baixado: "Baixado",
  pagamento_parcial: "Pagamento parcial registrado",
  desconhecido: "Situação desconhecida",
  nao_localizado: "Não localizado",
};

export function ValidadorPreliminarLOA() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<InputMode>("numero");
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanStep, setScanStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [oficio, setOficio] = useState("");
  const [processoCNJ, setProcessoCNJ] = useState("");
  const [resultado, setResultado] = useState<ValidacaoResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [parseStatus, setParseStatus] = useState<ParseStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmitNumero = oficio.trim().length > 0 && processoCNJ.trim().length > 0;
  const canSubmitUpload = uploadedFile !== null && (parseStatus === "ready" || parseStatus === "partial") && oficio.trim().length > 0 && processoCNJ.trim().length > 0;

  const handleStartScan = async () => {
    setScanStatus("scanning");
    setScanStep(0);
    setResultado(null);
    setErrorMsg("");

    // Animação de progresso enquanto aguarda API
    const interval = setInterval(() => {
      setScanStep((prev) => (prev < SCAN_MESSAGES.length - 1 ? prev + 1 : prev));
    }, 700);

    try {
      const res = await fetch("/api/validador/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_oficio: oficio.trim(),
          numero_processo: processoCNJ.trim(),
        }),
      });

      clearInterval(interval);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Não foi possível completar a consulta nas bases oficiais.");
        setScanStatus("error");
        return;
      }

      const data: ValidacaoResult = await res.json();
      setResultado(data);
      setScanStatus(data.encontrado ? "found" : "not_found");
    } catch (err: any) {
      clearInterval(interval);
      setErrorMsg("Falha de conexão. Verifique sua internet e tente novamente.");
      setScanStatus("error");
    }
  };

  const handleReset = () => {
    setScanStatus("idle");
    setScanStep(0);
    setUploadedFile(null);
    setOficio("");
    setProcessoCNJ("");
    setResultado(null);
    setErrorMsg("");
    setParseStatus("idle");
  };

  const handleFileChange = async (file: File | null) => {
    if (!file || file.type !== "application/pdf") return;
    setUploadedFile(file);
    setParseStatus("parsing");
    setOficio("");
    setProcessoCNJ("");

    try {
      const text = await extractTextFromPdf(file);
      const { cnj, oficio: oficioDetectado } = extractFieldsFromText(text);

      if (cnj) setProcessoCNJ(cnj);
      if (oficioDetectado) setOficio(oficioDetectado);

      const found = !!cnj || !!oficioDetectado;
      setParseStatus(cnj && oficioDetectado ? "ready" : found ? "partial" : "failed");
    } catch {
      setParseStatus("failed");
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
                          value={oficio}
                          onChange={(e) => setOficio(e.target.value)}
                          placeholder="Nº do Ofício Requisitório  —  Ex: 666/2021 ou AUT.2024.008667"
                          className="w-full bg-[#0b1120] border-2 border-slate-700 focus:border-blue-500 text-white text-base rounded-xl pl-14 pr-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600 font-mono shadow-inner"
                          data-testid="input-oficio"
                        />
                      </div>
                      {/* Campo processo CNJ */}
                      <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                          type="text"
                          value={processoCNJ}
                          onChange={(e) => setProcessoCNJ(e.target.value)}
                          placeholder="Nº CNJ do Processo  —  Ex: 1931-10.1990.4.01.3400"
                          className="w-full bg-[#0b1120] border-2 border-slate-700 focus:border-blue-500 text-white text-base rounded-xl pl-14 pr-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600 font-mono shadow-inner"
                          data-testid="input-cnj"
                        />
                      </div>
                      <p className="text-xs text-slate-600 text-center">
                        Ambos os campos são obrigatórios para cruzar as bases oficiais
                      </p>
                    </div>

                    <button
                      onClick={handleStartScan}
                      disabled={!canSubmitNumero}
                      className="w-full bg-gradient-to-r from-blue-400 to-cyan-300 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-slate-900 font-bold py-4 text-base rounded-xl transition-opacity flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(96,165,250,0.3)]"
                      data-testid="button-iniciar-varredura"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      {canSubmitNumero ? "Verificar Precatório Agora" : "Preencha os dois campos para continuar"}
                    </button>
                  </div>
                )}

                {/* MODO 2: Upload do Ofício Requisitório */}
                {mode === "upload" && (
                  <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-right-2 duration-200">

                    {/* Dropzone — só quando nenhum arquivo selecionado */}
                    {!uploadedFile && (
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
                    )}

                    {/* Arquivo selecionado — cabeçalho do arquivo */}
                    {uploadedFile && (
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4 mb-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                          {parseStatus === "parsing"
                            ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                            : <FileText className="w-4 h-4 text-blue-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{uploadedFile.name}</p>
                          <p className="text-slate-500 text-xs font-mono mt-0.5">
                            {parseStatus === "parsing" && "Lendo PDF..."}
                            {parseStatus === "ready" && <span className="text-emerald-400">✓ Campos detectados automaticamente</span>}
                            {parseStatus === "partial" && <span className="text-amber-400">⚠ Detecção parcial — revise os campos</span>}
                            {parseStatus === "failed" && <span className="text-red-400">Não foi possível detectar automaticamente — preencha manualmente</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => { setUploadedFile(null); setParseStatus("idle"); setOficio(""); setProcessoCNJ(""); }}
                          className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
                          data-testid="button-remover-arquivo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Campos extraídos (editáveis) — aparecem após parsing */}
                    {uploadedFile && parseStatus !== "parsing" && parseStatus !== "idle" && (
                      <div className="space-y-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {parseStatus === "ready" && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400/80 mb-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            Campos extraídos do documento — confirme antes de verificar
                          </div>
                        )}
                        <div className="relative">
                          <FileText className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          <input
                            type="text"
                            value={oficio}
                            onChange={(e) => setOficio(e.target.value)}
                            placeholder="Nº do Ofício Requisitório  —  Ex: AUT.2024.008667"
                            className="w-full bg-[#0b1120] border-2 border-slate-700 focus:border-blue-500 text-white text-base rounded-xl pl-14 pr-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600 font-mono shadow-inner"
                            data-testid="input-oficio-upload"
                          />
                        </div>
                        <div className="relative">
                          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          <input
                            type="text"
                            value={processoCNJ}
                            onChange={(e) => setProcessoCNJ(e.target.value)}
                            placeholder="Nº CNJ do Processo  —  Ex: 0041645-56.2007.8.19.0001"
                            className="w-full bg-[#0b1120] border-2 border-slate-700 focus:border-blue-500 text-white text-base rounded-xl pl-14 pr-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600 font-mono shadow-inner"
                            data-testid="input-cnj-upload"
                          />
                        </div>
                        {(parseStatus === "partial" || parseStatus === "failed") && (
                          <p className="text-xs text-slate-600 text-center">
                            PDF digital funciona melhor · documentos escaneados requerem análise completa
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      onClick={handleStartScan}
                      disabled={parseStatus === "parsing" || !canSubmitUpload}
                      className="w-full bg-gradient-to-r from-blue-400 to-cyan-300 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-slate-900 font-bold py-4 text-base rounded-xl transition-opacity flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(96,165,250,0.3)]"
                      data-testid="button-iniciar-varredura-upload"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      {!uploadedFile && "Selecione um arquivo PDF"}
                      {uploadedFile && parseStatus === "parsing" && "Lendo documento..."}
                      {uploadedFile && parseStatus !== "parsing" && !canSubmitUpload && "Preencha os campos para continuar"}
                      {uploadedFile && parseStatus !== "parsing" && canSubmitUpload && "Verificar Ofício Agora"}
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
                    &gt; {SCAN_MESSAGES[scanStep]}
                  </p>
                </div>
                <div className="w-full max-w-md bg-slate-800 h-2 rounded-full mt-8 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full animate-[scan_6s_ease-out_forwards]" />
                </div>
                <style>{`@keyframes scan { from { width: 0% } to { width: 95% } }`}</style>
              </div>
            )}

            {/* Estado 3a: Encontrado — dados reais + seção bloqueada */}
            {scanStatus === "found" && resultado && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-5 border-b border-emerald-900/40 pb-5">
                  <div className="bg-emerald-500/15 p-2.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-emerald-400 font-bold text-lg">
                      {resultado.tipo === "PRECATORIO" ? "Precatório" : resultado.tipo === "RPV" ? "RPV" : "Processo"} Localizado nas Bases Oficiais
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">
                      Fontes oficiais confirmaram · {resultado.tribunal.toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Dados liberados gratuitamente */}
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 divide-y divide-slate-800/60 mb-4">
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Nº do Processo</span>
                    <span className="text-sm font-mono text-slate-200">{resultado.numero_cnj || processoCNJ}</span>
                  </div>
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Ofício Requisitório</span>
                    <span className="text-sm font-mono text-slate-200">{resultado.numero_oficio || oficio}</span>
                  </div>
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Tribunal</span>
                    <span className="text-sm text-slate-200">{resultado.tribunal.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Tipo</span>
                    <span className={`text-sm font-medium ${resultado.tipo === "PRECATORIO" ? "text-blue-400" : resultado.tipo === "RPV" ? "text-cyan-400" : "text-slate-400"}`}>
                      {resultado.tipo === "PRECATORIO" ? "Precatório" : resultado.tipo === "RPV" ? "RPV" : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Situação</span>
                    <span className={`text-sm font-medium ${resultado.pagamento_pendente ? "text-amber-400" : "text-emerald-400"}`}>
                      {SITUACAO_LABELS[resultado.situacao] || resultado.situacao}
                    </span>
                  </div>
                  {resultado.data_ajuizamento_ano && (
                    <div className="flex justify-between items-center px-5 py-3">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Ano de Ajuizamento</span>
                      <span className="text-sm text-slate-200 font-mono">{resultado.data_ajuizamento_ano}</span>
                    </div>
                  )}
                  {resultado.url_consulta && (
                    <div className="flex justify-between items-center px-5 py-3">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Consulta Tribunal</span>
                      <a href={resultado.url_consulta} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                        Acessar <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Seção bloqueada */}
                <div className="relative rounded-xl border border-slate-800 bg-slate-900/50 p-5 mb-4 overflow-hidden">
                  <div className="absolute inset-0 backdrop-blur-[3px] bg-[#0B0F19]/70 z-10 flex flex-col items-center justify-center gap-1.5 px-6 text-center rounded-xl">
                    <Lock className="w-5 h-5 text-slate-400 mb-0.5" />
                    <span className="text-sm font-semibold text-slate-200">Acesso completo requer login</span>
                    <span className="text-xs text-slate-500">Valor atualizado, credor, status na LOA e cadeia de custódia</span>
                  </div>
                  <div className="space-y-2.5 opacity-20 select-none pointer-events-none">
                    <div className="flex justify-between"><span className="text-xs text-slate-500">Valor Atualizado:</span><span className="text-sm font-mono text-white">R$ ●●●.●●●,00</span></div>
                    <div className="flex justify-between"><span className="text-xs text-slate-500">Status LOA 2026:</span><span className="text-sm text-white">Inscrito</span></div>
                    <div className="flex justify-between"><span className="text-xs text-slate-500">Credor:</span><span className="text-sm text-white">●●● (CPF: ***.***.**-**)</span></div>
                  </div>
                </div>

                {/* Aviso de aprofundamento */}
                <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-4 py-3 mb-4 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    Esta é uma verificação preliminar. Recomendamos aprofundar e ampliar a busca para confirmação completa do precatório, valores e status na LOA.
                  </p>
                </div>

                {/* SHA-256 evidência */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex items-center gap-2 mb-4">
                  <Hash className="w-3.5 h-3.5 text-emerald-500/60 shrink-0" />
                  <span className="font-mono text-[10px] text-emerald-400/60 truncate">SHA-256: {resultado.sha256_evidencia}</span>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleReset} className="px-4 py-3 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" data-testid="button-reset-scan">
                    <Search className="w-5 h-5" />
                  </button>
                  <button onClick={() => navigate("/login")}
                    className="flex-1 bg-gradient-to-r from-blue-400 to-cyan-300 hover:opacity-90 text-slate-900 font-bold py-3 rounded-xl transition-opacity text-sm shadow-[0_0_20px_rgba(96,165,250,0.3)]"
                    data-testid="button-login-resultado">
                    Ver Análise Completa →
                  </button>
                </div>
              </div>
            )}

            {/* Estado 3b: Não encontrado */}
            {scanStatus === "not_found" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto text-center">
                <div className="flex flex-col items-center gap-3 mb-5">
                  <div className="bg-amber-500/10 p-3 rounded-full border border-amber-500/20">
                    <AlertTriangle className="w-8 h-8 text-amber-400" />
                  </div>
                  <h4 className="text-amber-400 font-bold text-xl">Fontes Oficiais Não Confirmaram</h4>
                  <p className="text-slate-400 text-sm max-w-md">
                    O processo <span className="font-mono text-slate-300">{processoCNJ}</span> não foi localizado nas bases consultadas. Verifique se os números estão corretos. Isso não descarta a existência do processo — recomendamos ampliar a busca.
                  </p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl px-5 py-3 mb-5 text-left">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <span className="text-slate-400 font-medium">Recomendação:</span> Esta verificação preliminar não esgota as fontes disponíveis. Para confirmação definitiva, acesse a plataforma completa com busca estendida em múltiplas bases.
                  </p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={handleReset} className="px-5 py-3 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm flex items-center gap-2" data-testid="button-reset-scan">
                    <Search className="w-4 h-4" /> Tentar novamente
                  </button>
                  <button onClick={() => navigate("/login")}
                    className="px-5 py-3 bg-gradient-to-r from-blue-400 to-cyan-300 hover:opacity-90 text-slate-900 font-bold rounded-xl transition-opacity text-sm"
                    data-testid="button-login-nao-encontrado">
                    Busca avançada →
                  </button>
                </div>
              </div>
            )}

            {/* Estado 3c: Erro */}
            {scanStatus === "error" && (
              <div className="animate-in fade-in duration-300 max-w-2xl mx-auto text-center">
                <div className="flex flex-col items-center gap-3 mb-5">
                  <div className="bg-red-500/10 p-3 rounded-full border border-red-500/20">
                    <AlertTriangle className="w-7 h-7 text-red-400" />
                  </div>
                  <h4 className="text-red-400 font-semibold">Falha ao Consultar as Bases Oficiais</h4>
                  <p className="text-slate-500 text-sm">{errorMsg || "Não foi possível completar a consulta. Verifique sua conexão e tente novamente."}</p>
                </div>
                <p className="text-xs text-slate-600 mb-4">Esta verificação preliminar pode ser repetida. Para buscas mais robustas, acesse a plataforma completa.</p>
                <button onClick={handleReset} className="px-6 py-3 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm flex items-center gap-2 mx-auto" data-testid="button-reset-error">
                  <Search className="w-4 h-4" /> Tentar novamente
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

    </section>
  );
}
