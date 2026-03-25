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

// Normaliza qualquer variação numérica para o formato CNJ padrão: NNNNNNN-DD.AAAA.J.TT.OOOO
function normalizeCNJ(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // CNJ tem 20 dígitos: 7+2+4+1+2+4
  if (digits.length < 18 || digits.length > 21) return raw;
  // Tenta reconstruir no formato padrão a partir dos dígitos puros
  // Ex: 00414655620078190001 → 0041455-56.2007.8.19.0001
  const n = digits.padStart(20, "0");
  return `${n.slice(0,7)}-${n.slice(7,9)}.${n.slice(9,13)}.${n.slice(13,14)}.${n.slice(14,16)}.${n.slice(16,20)}`;
}

function extractFieldsFromText(text: string): { cnj: string | null; oficio: string | null } {
  // Padrões CNJ em ordem de prioridade (mais específico → mais genérico)
  const cnjPatterns = [
    // Formato padrão: NNNNNNN-DD.AAAA.J.TT.OOOO
    /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/,
    // Todos pontos (sem traço): NNNNNNN.DD.AAAA.J.TT.OOOO
    /\d{7}\.\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/,
    // Com barra no início: NNNNNNN/DD.AAAA.J.TT.OOOO
    /\d{7}\/\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/,
    // Após palavras-chave: "processo n.", "Proc.", "processo nº", etc.
    /(?:processo\s+(?:n\.?º?|originário\s+n\.?|n\.?)\s*)(\d{4,7}[-./]\d{2}[.]\d{4}[.]\d[.]\d{2}[.]\d{4})/i,
    /(?:Proc\.\s*n\.?\s*)(\d{4,7}[-./]\d{2}[.]\d{4}[.]\d[.]\d{2}[.]\d{4})/i,
    // Variação com menos dígitos no início (4-6 dígitos)
    /\d{4,6}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/,
    // Sem separadores — bloco de 18-20 dígitos após palavra-chave
    /(?:processo\s+(?:n\.?º?\s*))(\d{18,20})/i,
  ];

  let cnjRaw: string | null = null;
  for (const pat of cnjPatterns) {
    const m = text.match(pat);
    if (m) {
      cnjRaw = (m[1] || m[0]).trim();
      break;
    }
  }
  const cnj = cnjRaw ? normalizeCNJ(cnjRaw) : null;

  // Ofício — múltiplos formatos reais de documentos judiciais
  const oficioPatterns = [
    // DEPRE/DEPJU/HOLOS nº AUT.2024.008667
    /(?:DEPRE|DEPJU|HOLOS)[/\w]*\s+n[º°\.]\s+(AUT\.\d{4}\.\d+)/i,
    // Ofício DEPRE/... nº AUT.2024.008667
    /Ofício\s+\S+\s+n[º°\.]\s+(AUT\.\d{4}\.\d+)/i,
    // AUT.YYYY.NNNNNN isolado
    /\bAUT\.\d{4}\.\d{3,}\b/,
    // OFREQ 2024.08671/OFREQ
    /(\d{4}\.\d{5,}\/OFREQ)/i,
    // Ofício nº 2024.08671
    /Ofício\s+(?:DEPRE\/\S+\s+)?n[º°\.]\s*(\d{4}\.\d{4,}(?:\/\w+)?)/i,
    // Ofício nº 666/2021 ou 666/2021
    /Ofício\s+n[º°\.]\s*(\d{3,6}\/\d{4})/i,
    /\b(\d{3,6}\/\d{4})\b/,
    // Fallback genérico após "nº"
    /n[º°\.]\s+([\w]{3,6}[\./]\d{4,}(?:[\./]\w+)?)/i,
  ];

  let oficio: string | null = null;
  for (const pattern of oficioPatterns) {
    const m = text.match(pattern);
    if (m) {
      oficio = (m[1] || m[0]).trim();
      break;
    }
  }

  return { cnj, oficio };
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

interface BRAnaliseResult {
  score: number;
  status: "APROVADO" | "VERIFICAR" | "SUSPEITO";
  statusLabel: string;
  statusColor: "green" | "yellow" | "red";
  findings: Array<{ ruleId: string; severity: string; title: string; detail: string; found: boolean }>;
  extracted: { numero_cnj: string | null; numero_oficio: string | null; [key: string]: unknown };
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
  const [consultasUsadas, setConsultasUsadas] = useState<number>(() => {
    const stored = sessionStorage.getItem("auraloa_consultas_gratuitas");
    return stored ? parseInt(stored, 10) : 0;
  });
  const [showLimiteModal, setShowLimiteModal] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [analiseResult, setAnaliseResult] = useState<BRAnaliseResult | null>(null);

  const canSubmitUpload = uploadedFile !== null;

  const handleStartScan = async () => {
    if (consultasUsadas >= 3) {
      setShowLimiteModal(true);
      return;
    }
    const novasConsultas = consultasUsadas + 1;
    setConsultasUsadas(novasConsultas);
    sessionStorage.setItem("auraloa_consultas_gratuitas", String(novasConsultas));

    setScanStatus("scanning");
    setScanStep(0);
    setResultado(null);
    setErrorMsg("");
    setAnaliseResult(null);

    // Animação de progresso enquanto aguarda API
    const interval = setInterval(() => {
      setScanStep((prev) => (prev < SCAN_MESSAGES.length - 1 ? prev + 1 : prev));
    }, 700);

    try {
      // Análise heurística do documento (modo upload)
      if (extractedText) {
        const analiseRes = await fetch("/api/analise/documento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: extractedText }),
        });
        if (analiseRes.ok) {
          const ar: BRAnaliseResult = await analiseRes.json();
          setAnaliseResult(ar);
          console.log("[DEBUG] Resultado análise backend:", JSON.stringify(ar.extracted));
          // Auto-preenche CNJ se vazio
          if (!processoCNJ && ar.extracted.numero_cnj) {
            setProcessoCNJ(ar.extracted.numero_cnj as string);
          }
          // Bloqueia se documento suspeito
          if (ar.status === "SUSPEITO") {
            clearInterval(interval);
            setErrorMsg(ar.statusLabel);
            setScanStatus("error");
            return;
          }
        }
      }

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
    setExtractedText("");
    setAnaliseResult(null);
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setParseStatus("failed");
      setUploadedFile(file);
      return;
    }
    setUploadedFile(file);
    setParseStatus("parsing");
    setOficio("");
    setProcessoCNJ("");

    try {
      // Extrai texto localmente para pré-preencher campos enquanto aguarda o backend
      const text = await extractTextFromPdf(file);
      setExtractedText(text);
      const { cnj, oficio: oficioDetectado } = extractFieldsFromText(text);

      if (cnj) setProcessoCNJ(cnj);
      if (oficioDetectado) setOficio(oficioDetectado);

      const found = !!cnj || !!oficioDetectado;
      setParseStatus(cnj && oficioDetectado ? "ready" : found ? "partial" : "failed");

      // Auto-análise server-side: envia PDF binário para extração completa
      try {
        const formData = new FormData();
        formData.append("file", file);
        const autoAnalise = await fetch("/api/analise/documento-pdf", {
          method: "POST",
          body: formData,
        });
        const autoResult = await autoAnalise.json();
        if (autoResult?.extracted?.numero_cnj && !cnj) {
          setProcessoCNJ(autoResult.extracted.numero_cnj);
        }
        if (autoResult?.extracted?.numero_oficio && !oficioDetectado) {
          setOficio(autoResult.extracted.numero_oficio);
        }
        if (autoResult?.extracted?.numero_cnj || autoResult?.extracted?.numero_oficio) {
          setParseStatus("ready");
        }
        setAnaliseResult(autoResult);
      } catch (e) {
        console.warn("[analise-pdf] falhou:", e);
      }
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

                <div className="max-w-3xl mx-auto">

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
                            {parseStatus === "failed" && (
                              <span className="text-red-400">
                                {uploadedFile && uploadedFile.type !== "application/pdf"
                                  ? "❌ Formato inválido — apenas arquivos PDF são aceitos"
                                  : "Não foi possível detectar automaticamente — preencha manualmente"}
                              </span>
                            )}
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

                    <button
                      onClick={handleStartScan}
                      disabled={!canSubmitUpload}
                      className="w-full bg-gradient-to-r from-blue-400 to-cyan-300 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-slate-900 font-bold py-4 text-base rounded-xl transition-opacity flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(96,165,250,0.3)]"
                      data-testid="button-iniciar-varredura-upload"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      {!uploadedFile && "Selecione um arquivo PDF"}
                      {uploadedFile && "Verificar Ofício Agora"}
                    </button>
                    {consultasUsadas > 0 && (
                      <p className="text-xs text-slate-500 text-center mt-2">
                        {consultasUsadas} de 3 consultas gratuitas utilizadas
                      </p>
                    )}
                </div>

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

                {/* Badge / Banner de autenticidade */}
                {analiseResult && analiseResult.status === "APROVADO" && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs text-emerald-400 font-medium">✓ Documento autenticado — Score: {analiseResult.score}/100</span>
                  </div>
                )}
                {analiseResult && analiseResult.status === "VERIFICAR" && (
                  <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs text-amber-400 font-medium">⚠️ Verificação com restrições — Score: {analiseResult.score}/100</span>
                    </div>
                    <ul className="space-y-0.5">
                      {analiseResult.findings.filter(f => !f.found).map(f => (
                        <li key={f.ruleId} className="text-xs text-amber-300/60 pl-4">• {f.title}</li>
                      ))}
                    </ul>
                  </div>
                )}

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
              <div className="animate-in fade-in duration-300 max-w-2xl mx-auto">
                {analiseResult?.status === "SUSPEITO" ? (
                  <>
                    <div className="flex flex-col items-center gap-3 mb-5 text-center">
                      <div className="bg-red-500/10 p-3 rounded-full border border-red-500/20">
                        <AlertTriangle className="w-7 h-7 text-red-400" />
                      </div>
                      <h4 className="text-red-400 font-bold text-lg">⚠️ Documento suspeito — análise preliminar negada</h4>
                      <p className="text-slate-400 text-sm">{analiseResult.statusLabel}</p>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                        <span className="text-xs text-red-300 font-mono font-bold">Score: {analiseResult.score}/100</span>
                      </div>
                    </div>
                    <div className="bg-slate-900/60 border border-red-500/20 rounded-xl p-4 mb-4">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Campos ausentes ou irregulares:</p>
                      <ul className="space-y-2">
                        {analiseResult.findings.filter(f => !f.found).map(f => (
                          <li key={f.ruleId} className="flex items-start gap-2 text-xs text-slate-300">
                            <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${f.severity === "critical" || f.severity === "high" ? "text-red-400" : "text-amber-400"}`} />
                            <span><span className="font-medium">{f.title}:</span> {f.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-xs text-slate-500 text-center mb-4">Este documento não passou na verificação preliminar de autenticidade. A consulta foi bloqueada.</p>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 mb-5 text-center">
                    <div className="bg-red-500/10 p-3 rounded-full border border-red-500/20">
                      <AlertTriangle className="w-7 h-7 text-red-400" />
                    </div>
                    <h4 className="text-red-400 font-semibold">Falha ao Consultar as Bases Oficiais</h4>
                    <p className="text-slate-500 text-sm">{errorMsg || "Não foi possível completar a consulta. Verifique sua conexão e tente novamente."}</p>
                  </div>
                )}
                <p className="text-xs text-slate-600 mb-4 text-center">Esta verificação preliminar pode ser repetida. Para buscas mais robustas, acesse a plataforma completa.</p>
                <button onClick={handleReset} className="px-6 py-3 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm flex items-center gap-2 mx-auto" data-testid="button-reset-error">
                  <Search className="w-4 h-4" /> Tentar novamente
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Modal de limite de consultas gratuitas */}
      {showLimiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLimiteModal(false)} />
          <div className="relative w-full max-w-md bg-[#080e1c] border border-blue-500/25 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_40px_rgba(37,99,235,0.15)] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-70" />
            <div className="p-8">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg leading-tight">Limite de consultas gratuitas atingido</h3>
                    <p className="text-slate-400 text-sm mt-0.5">Você utilizou suas 3 consultas gratuitas.</p>
                  </div>
                </div>
                <button onClick={() => setShowLimiteModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4 mb-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Com o plano PRO você tem:</p>
                <ul className="space-y-2.5">
                  {[
                    "Consultas ilimitadas",
                    "Pesquisa em lote (até 10 processos)",
                    "Exportação com cadeia de custódia",
                    "Acesso ao dashboard completo",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3">
                <a
                  href="mailto:contato@auratech.com.br"
                  className="w-full bg-gradient-to-r from-blue-400 to-cyan-300 hover:opacity-90 text-slate-900 font-bold py-3.5 rounded-xl transition-opacity text-sm text-center shadow-[0_0_20px_rgba(96,165,250,0.3)]"
                >
                  Assinar AuraLOA
                </a>
                <a
                  href="/login"
                  className="w-full border border-slate-700 hover:border-slate-500 hover:bg-slate-800 text-slate-300 font-medium py-3.5 rounded-xl transition-colors text-sm text-center"
                >
                  Já tenho conta
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
