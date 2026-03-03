import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Search,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Hash,
  ExternalLink,
  Loader2,
  FileText,
  Scale,
  Shield,
  Clock,
  ArrowLeft,
  RefreshCw,
  Banknote,
  Filter,
  Download,
  Eye,
  Info,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  LogOut,
} from "lucide-react";
import type {
  PrecatorioPendenteResult,
  EstoqueProcesso,
  EstoqueSummaryByTribunal,
  MovimentoProcesso,
  SourceInfo,
  PDFOrcamentoSummary,
} from "@shared/loa_types";

function StatusBadge({ status }: { status: string }) {
  if (status === "OK") {
    return (
      <Badge variant="default" className="bg-emerald-600 dark:bg-emerald-500 text-white">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        OK
      </Badge>
    );
  }
  if (status === "PARCIAL") {
    return (
      <Badge variant="default" className="bg-amber-500 dark:bg-amber-400 text-white">
        <AlertTriangle className="w-3 h-3 mr-1" />
        PARCIAL
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <XCircle className="w-3 h-3 mr-1" />
      NAO LOCALIZADO
    </Badge>
  );
}

function SituacaoBadge({ situacao }: { situacao: string }) {
  if (situacao === "baixado") {
    return <Badge variant="secondary" className="text-[10px]">Baixado</Badge>;
  }
  if (situacao === "pagamento_parcial") {
    return <Badge variant="default" className="bg-amber-500 text-[10px] text-white">Pag. Parcial</Badge>;
  }
  if (situacao === "em_tramitacao") {
    return <Badge variant="default" className="bg-blue-600 text-[10px] text-white">Em Tramitacao</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">Desconhecido</Badge>;
}

function formatCnj(numero: string): string {
  if (!numero || numero.length < 20) return numero;
  return `${numero.slice(0, 7)}-${numero.slice(7, 9)}.${numero.slice(9, 13)}.${numero.slice(13, 14)}.${numero.slice(14, 16)}.${numero.slice(16, 20)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  if (dateStr.length >= 8 && !dateStr.includes("-")) {
    return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
  }
  if (dateStr.includes("T")) {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  }
  return dateStr;
}

function formatBRL(valor: number | null): string {
  if (valor === null || valor === undefined) return "-";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type SortField = "valor" | "data" | "tribunal";
type SortDir = "asc" | "desc";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportProcessosCSV(processos: EstoqueProcesso[], ano: number) {
  const BOM = "\uFEFF";
  const sep = ";";
  const headers = [
    "Numero CNJ", "Numero Formatado", "Tribunal", "Classe Codigo", "Classe Nome",
    "Situacao", "Valor Causa", "Fonte Valor", "Data Ajuizamento", "Data Ultima Atualizacao",
    "Orgao Julgador", "Assuntos", "Total Movimentos", "Ultima Movimentacao",
    "Data Ultima Movimentacao", "Pagamento Pendente", "Tem Baixa", "Tem Pagamento", "URL Consulta PJe", "URL Consulta eProc",
  ];
  const esc = (v: string) => (v.includes(sep) || v.includes('"') || v.includes("\n")) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const fmtCnj = (n: string) => (!n || n.length < 20) ? n : `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n.slice(13, 14)}.${n.slice(14, 16)}.${n.slice(16, 20)}`;

  const rows = processos.map((p) => [
    esc(p.numero_cnj), esc(fmtCnj(p.numero_cnj)), esc(p.tribunal_alias.toUpperCase()),
    String(p.classe_codigo), esc(p.classe_nome), esc(p.situacao),
    p.valor_causa !== null ? String(p.valor_causa) : "", p.valor_fonte || "",
    p.data_ajuizamento || "", p.data_ultima_atualizacao || "",
    esc(p.orgao_julgador?.nome || ""), esc(p.assuntos.map((a) => a.nome).join(", ")),
    String(p.total_movimentos), esc(p.ultima_movimentacao?.nome || ""),
    p.ultima_movimentacao?.data || "", p.pagamento_pendente ? "Sim" : "Nao",
    p.tem_baixa ? "Sim" : "Nao", p.tem_pagamento ? "Sim" : "Nao",
    p.url_consulta || "", p.url_consulta_eproc || "",
  ].join(sep));

  const csv = BOM + headers.join(sep) + "\n" + rows.join("\n");
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(csv, `precatorios_pendentes_${ano}_${date}.csv`, "text/csv;charset=utf-8");
}

function exportProcessosJSON(processos: EstoqueProcesso[], ano: number, result: PrecatorioPendenteResult) {
  const exportData = {
    exportado_em: new Date().toISOString(),
    ano_exercicio: ano,
    total_pendentes: processos.length,
    total_precatorios: processos.filter((p) => p.classe_codigo === 1265).length,
    total_rpvs: processos.filter((p) => p.classe_codigo === 1266).length,
    process_id_uuid: result.process_id_uuid,
    output_sha256: result.hashes.output_sha256,
    processos,
  };
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(JSON.stringify(exportData, null, 2), `precatorios_pendentes_${ano}_${date}.json`, "application/json;charset=utf-8");
}

function exportProcessosXLSX(processos: EstoqueProcesso[], ano: number) {
  const fmtCnj = (n: string) => (!n || n.length < 20) ? n : `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n.slice(13, 14)}.${n.slice(14, 16)}.${n.slice(16, 20)}`;

  const data = processos.map((p) => ({
    "Numero CNJ": p.numero_cnj,
    "Numero Formatado": fmtCnj(p.numero_cnj),
    "Tribunal": p.tribunal_alias.toUpperCase(),
    "Classe Codigo": p.classe_codigo,
    "Classe Nome": p.classe_nome,
    "Situacao": p.situacao,
    "Valor Causa": p.valor_causa,
    "Fonte Valor": p.valor_fonte || "",
    "Data Ajuizamento": p.data_ajuizamento || "",
    "Data Ultima Atualizacao": p.data_ultima_atualizacao || "",
    "Orgao Julgador": p.orgao_julgador?.nome || "",
    "Assuntos": p.assuntos.map((a) => a.nome).join(", "),
    "Total Movimentos": p.total_movimentos,
    "Ultima Movimentacao": p.ultima_movimentacao?.nome || "",
    "Data Ultima Mov.": p.ultima_movimentacao?.data || "",
    "Pagamento Pendente": p.pagamento_pendente ? "Sim" : "Nao",
    "Tem Baixa": p.tem_baixa ? "Sim" : "Nao",
    "Tem Pagamento": p.tem_pagamento ? "Sim" : "Nao",
    "URL Consulta PJe": p.url_consulta || "",
    "URL Consulta eProc": p.url_consulta_eproc || "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  const colWidths = [
    { wch: 22 }, { wch: 28 }, { wch: 8 }, { wch: 14 }, { wch: 30 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 22 },
    { wch: 40 }, { wch: 40 }, { wch: 16 }, { wch: 30 },
    { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 60 }, { wch: 60 },
  ];
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pendentes");

  const summaryData = [
    { "Info": "Exportado em", "Valor": new Date().toISOString() },
    { "Info": "Ano Exercicio", "Valor": String(ano) },
    { "Info": "Total Pendentes", "Valor": String(processos.length) },
    { "Info": "Precatorios", "Valor": String(processos.filter((p) => p.classe_codigo === 1265).length) },
    { "Info": "RPVs", "Valor": String(processos.filter((p) => p.classe_codigo === 1266).length) },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `precatorios_pendentes_${ano}_${date}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ProcessoCard({ processo, expanded, onToggle }: { processo: EstoqueProcesso; expanded: boolean; onToggle: () => void }) {
  return (
    <Card className="hover-elevate" data-testid={`card-processo-${processo.numero_cnj}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-sm font-semibold" data-testid={`text-cnj-${processo.numero_cnj}`}>
                {formatCnj(processo.numero_cnj)}
              </span>
              <Badge variant={processo.classe_codigo === 1265 ? "default" : "secondary"} className="text-[10px]">
                {processo.classe_nome}
              </Badge>
              <SituacaoBadge situacao={processo.situacao} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="font-mono">{processo.tribunal_alias.toUpperCase()}</span>
              {processo.valor_causa !== null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-semibold text-amber-700 dark:text-amber-400 cursor-help" data-testid={`text-valor-${processo.numero_cnj}`}>
                      {formatBRL(processo.valor_causa)}
                      {processo.valor_fonte && (
                        <span className="text-[9px] ml-1 opacity-70">({processo.valor_fonte === "pdf_oficial" ? "PDF" : processo.valor_fonte})</span>
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Fonte: {processo.valor_fonte === "pdf_oficial" ? "Relacao oficial do tribunal (PDF)" : processo.valor_fonte || "DataJud"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <span>Ajuiz.: {formatDate(processo.data_ajuizamento)}</span>
              <span>Atualiz.: {formatDate(processo.data_ultima_atualizacao)}</span>
              {processo.orgao_julgador && (
                <span className="max-w-[200px] truncate" title={processo.orgao_julgador.nome}>{processo.orgao_julgador.nome}</span>
              )}
            </div>
            {processo.assuntos.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {processo.assuntos.slice(0, 3).map((a: { codigo: number; nome: string }, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{a.nome}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {processo.url_consulta && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={processo.url_consulta}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`link-consulta-${processo.numero_cnj}`}
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      {processo.tribunal_alias === "trf6" ? "PJe (TRF1)" : processo.tribunal_alias === "tjsp" ? "eSAJ (TJSP)" : "Consulta"}
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px]">
                  <p className="text-xs">
                    {processo.tribunal_alias === "trf6"
                      ? "Consulta PJe via TRF1 processual (conforme orientacao oficial TRF6) - acesso ao oficio requisitorio"
                      : processo.tribunal_alias === "tjsp"
                      ? "Consulta publica eSAJ TJSP - acesso ao processo e oficio requisitorio"
                      : `Abrir consulta publica no ${processo.tribunal_alias.toUpperCase()} - acesso ao oficio requisitorio`}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            {processo.url_consulta_eproc && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={processo.url_consulta_eproc}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`link-eproc-${processo.numero_cnj}`}
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      eProc
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px]">
                  <p className="text-xs">Consulta eProc {processo.tribunal_alias.toUpperCase()} - requisicoes transmitidas via eproc</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Button variant="ghost" size="sm" onClick={onToggle} data-testid={`button-expand-${processo.numero_cnj}`}>
              <Eye className="w-3 h-3 mr-1" />
              {expanded ? "Fechar" : "Detalhes"}
            </Button>
          </div>
        </div>

        {processo.ultima_movimentacao && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Ultima mov.: <strong>{processo.ultima_movimentacao.nome}</strong> ({formatDate(processo.ultima_movimentacao.data)})</span>
          </div>
        )}

        {expanded && processo.movimentos.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Historico de Movimentacoes ({processo.movimentos.length})</p>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {processo.movimentos.slice().reverse().map((mov: MovimentoProcesso, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-[11px] py-1 border-b border-dashed last:border-0">
                  <span className="text-muted-foreground w-[80px] shrink-0">{formatDate(mov.data)}</span>
                  <Badge variant="outline" className="text-[9px] font-mono shrink-0">{mov.codigo}</Badge>
                  <span className="truncate" title={mov.nome}>{mov.nome}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PrecatoriosPendentes() {
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedEnte, setSelectedEnte] = useState<"UNIAO" | "SP">("UNIAO");
  const [result, setResult] = useState<PrecatorioPendenteResult | null>(null);
  const [expandedProcessos, setExpandedProcessos] = useState<Set<string>>(new Set());
  const [filtroTribunal, setFiltroTribunal] = useState<string>("todos");
  const [filtroClasse, setFiltroClasse] = useState<string>("todos");
  const [sortField, setSortField] = useState<SortField>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const mutation = useMutation({
    mutationFn: async (ano: number) => {
      const endpoint = selectedEnte === "SP"
        ? "/api/sp/pendentes-datajud"
        : "/api/loa/uniao/precatorios-pendentes";
      const res = await apiRequest("POST", endpoint, {
        ano_exercicio: ano,
        max_por_tribunal: 2000,
      });
      return res.json();
    },
    onSuccess: (data: PrecatorioPendenteResult) => {
      setResult(data);
      setExpandedProcessos(new Set());
      setFiltroTribunal("todos");
      setFiltroClasse("todos");
      toast({
        title: `Pendentes ${selectedEnte === "SP" ? "SP" : "Federal"} atualizados`,
        description: `${data.total_pendentes} processos pendentes (${data.total_precatorios_pendentes} prec., ${data.total_rpvs_pendentes} RPVs)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao buscar pendentes",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConsulta = () => {
    mutation.mutate(parseInt(selectedYear));
  };

  const toggleExpanded = (numeroCnj: string) => {
    setExpandedProcessos((prev) => {
      const next = new Set(prev);
      if (next.has(numeroCnj)) next.delete(numeroCnj);
      else next.add(numeroCnj);
      return next;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredProcessos = (result?.processos.filter((p: EstoqueProcesso) => {
    if (filtroTribunal !== "todos" && p.tribunal_alias !== filtroTribunal) return false;
    if (filtroClasse === "precatorio" && p.classe_codigo !== 1265) return false;
    if (filtroClasse === "rpv" && p.classe_codigo !== 1266) return false;
    return true;
  }) || []).slice().sort((a: EstoqueProcesso, b: EstoqueProcesso) => {
    const dir = sortDir === "desc" ? -1 : 1;
    if (sortField === "valor") {
      const va = a.valor_causa ?? -1;
      const vb = b.valor_causa ?? -1;
      return (va - vb) * dir;
    }
    if (sortField === "data") {
      const da = a.data_ajuizamento || "";
      const db = b.data_ajuizamento || "";
      return da.localeCompare(db) * dir;
    }
    if (sortField === "tribunal") {
      return a.tribunal_alias.localeCompare(b.tribunal_alias) * dir;
    }
    return 0;
  });

  const totalValorPendente = filteredProcessos.reduce((sum: number, p: EstoqueProcesso) => {
    return sum + (p.valor_causa ?? 0);
  }, 0);

  const processosComValor = filteredProcessos.filter((p: EstoqueProcesso) => p.valor_causa !== null && p.valor_causa > 0).length;

  const tribunaisDisponiveis: string[] = result
    ? Array.from(new Set(result.processos.map((p: EstoqueProcesso) => p.tribunal_alias)))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" data-testid="button-voltar">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Dashboard
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-5" />
              <div className="p-1.5 rounded-md bg-amber-500/10">
                <Scale className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight" data-testid="text-page-title">
                  Precatorios Pendentes {selectedEnte === "SP" ? "— SP" : "— Federal"}
                </h1>
                <p className="text-[10px] text-muted-foreground">
                  {selectedEnte === "SP"
                    ? "TJSP — Processos com pagamento pendente via CNJ DataJud"
                    : "TRF1-TRF6 — Processos com pagamento pendente"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/contrato">
                <Button variant="outline" size="sm" data-testid="link-contrato-dpo">
                  <Shield className="w-3.5 h-3.5 mr-1" />
                  Contrato DPO
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-logout"
                onClick={() => {
                  localStorage.removeItem("aura_token");
                  localStorage.removeItem("aura_email");
                  window.location.href = "/";
                }}
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Sair
              </Button>
              {result && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Atualizado: {new Date(result.ultima_atualizacao_iso).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="min-w-[140px]">
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                  Ente
                </label>
                <Select value={selectedEnte} onValueChange={(v) => { setSelectedEnte(v as "UNIAO" | "SP"); setResult(null); }}>
                  <SelectTrigger data-testid="select-ente" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNIAO">Federal (Uniao)</SelectItem>
                    <SelectItem value="SP">Sao Paulo (SP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px]">
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                  Exercicio (Ano)
                </label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger data-testid="select-year" className="w-full">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleConsulta}
                disabled={mutation.isPending}
                data-testid="button-buscar-pendentes"
                className="bg-amber-600 text-white"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-1.5" />
                    Buscar Pendentes {selectedEnte === "SP" ? "SP" : ""}
                  </>
                )}
              </Button>
              {result && (
                <Button
                  variant="outline"
                  onClick={handleConsulta}
                  disabled={mutation.isPending}
                  data-testid="button-atualizar"
                >
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${mutation.isPending ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              )}
            </div>
            {mutation.isPending && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {selectedEnte === "SP"
                    ? "Consultando DataJud CNJ (TJSP) e filtrando processos pendentes SP..."
                    : "Consultando DataJud CNJ (TRF1-TRF6) e filtrando processos pendentes..."}
                </div>
                <Progress value={undefined} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="hover-elevate">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total Pendentes</p>
                      <p className="text-xl font-semibold" data-testid="kpi-total-pendentes">{result.total_pendentes}</p>
                    </div>
                    <div className="p-2 rounded-md bg-amber-500/10 shrink-0">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-elevate">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Precatorios Pendentes</p>
                      <p className="text-xl font-semibold text-blue-600 dark:text-blue-400" data-testid="kpi-prec-pendentes">{result.total_precatorios_pendentes}</p>
                      <p className="text-xs text-muted-foreground">Classe 1265</p>
                    </div>
                    <div className="p-2 rounded-md bg-blue-500/10 shrink-0">
                      <Scale className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-elevate">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">RPVs Pendentes</p>
                      <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400" data-testid="kpi-rpv-pendentes">{result.total_rpvs_pendentes}</p>
                      <p className="text-xs text-muted-foreground">Classe 1266</p>
                    </div>
                    <div className="p-2 rounded-md bg-emerald-500/10 shrink-0">
                      <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-elevate">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Tribunais com Dados</p>
                      <p className="text-xl font-semibold" data-testid="kpi-tribunais">{tribunaisDisponiveis.length}</p>
                      <p className="text-xs text-muted-foreground">de {result.por_tribunal.length} consultados</p>
                    </div>
                    <div className="p-2 rounded-md bg-primary/10 shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {result.pdf_orcamento_summaries && result.pdf_orcamento_summaries.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium">Orcamento Oficial de Precatorios (PDF Tribunal)</span>
                    <Badge variant="outline" className="text-[10px]">Relacao Oficial</Badge>
                  </div>
                  {result.pdf_orcamento_summaries.map((pdf: PDFOrcamentoSummary, idx: number) => (
                    <div key={idx} className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-white dark:bg-background rounded-md border">
                          <p className="text-[10px] text-muted-foreground uppercase">Valor Total Orcamento</p>
                          <p className="text-lg font-bold text-amber-700 dark:text-amber-400" data-testid="kpi-valor-orcamento">
                            {formatBRL(pdf.valor_total_orcamento)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{pdf.tribunal} - {pdf.ano_orcamento}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-background rounded-md border">
                          <p className="text-[10px] text-muted-foreground uppercase">Precatorios no PDF</p>
                          <p className="text-lg font-bold" data-testid="kpi-total-pdf">{pdf.total_precatorios_pdf.toLocaleString("pt-BR")}</p>
                          <p className="text-[10px] text-muted-foreground">inscritos no orcamento</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-background rounded-md border">
                          <p className="text-[10px] text-muted-foreground uppercase">Alimentares</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatBRL(pdf.valor_alimentar)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {pdf.total_idoso > 0 && `${pdf.total_idoso} idosos`}
                            {pdf.total_idoso > 0 && pdf.total_deficiencia > 0 && " / "}
                            {pdf.total_deficiencia > 0 && `${pdf.total_deficiencia} PcD`}
                          </p>
                        </div>
                        <div className="p-3 bg-white dark:bg-background rounded-md border">
                          <p className="text-[10px] text-muted-foreground uppercase">Comuns</p>
                          <p className="text-lg font-bold">{formatBRL(pdf.valor_comum)}</p>
                          <p className="text-[10px] text-muted-foreground">nao preferenciais</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <a href={pdf.fonte_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" data-testid="link-pdf-fonte">
                          <ExternalLink className="w-2.5 h-2.5" />
                          Fonte: {pdf.fonte_url}
                        </a>
                        <span className="font-mono">SHA-256: {pdf.sha256.slice(0, 16)}...</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Resumo por Tribunal</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse" data-testid="table-tribunal-pendentes">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 font-medium text-muted-foreground">Tribunal</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Pendentes</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Prec.</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">RPVs</th>
                        <th className="text-center p-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Obs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.por_tribunal.map((t: EstoqueSummaryByTribunal) => (
                        <tr key={t.tribunal_alias} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-2">
                            <span className="font-mono font-semibold">{t.tribunal_alias.toUpperCase()}</span>
                            <span className="text-muted-foreground ml-2 hidden sm:inline">{t.tribunal}</span>
                          </td>
                          <td className="p-2 text-right font-semibold">{t.total_processos}</td>
                          <td className="p-2 text-right text-blue-600 dark:text-blue-400">{t.precatorios}</td>
                          <td className="p-2 text-right text-emerald-600 dark:text-emerald-400">{t.rpvs}</td>
                          <td className="p-2 text-center">
                            <StatusBadge status={t.status === "ERRO" ? "NAO_LOCALIZADO" : t.status} />
                          </td>
                          <td className="p-2 text-muted-foreground">{t.observacoes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Scale className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Processos Pendentes</span>
                    <Badge variant="secondary">{filteredProcessos.length} processos</Badge>
                    {totalValorPendente > 0 && (
                      <Badge variant="default" className="bg-amber-600 text-white" data-testid="badge-valor-total">
                        <Banknote className="w-3 h-3 mr-1" />
                        {formatBRL(totalValorPendente)}
                      </Badge>
                    )}
                    {processosComValor > 0 && processosComValor < filteredProcessos.length && (
                      <span className="text-[10px] text-muted-foreground">({processosComValor} de {filteredProcessos.length} com valor)</span>
                    )}
                    {filteredProcessos.length > 0 && processosComValor === 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground cursor-help">
                            <Info className="w-2.5 h-2.5 mr-1" />
                            Valor indisponivel no DataJud
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[280px]">
                          <p className="text-xs">A API publica do CNJ DataJud nao disponibiliza o valor da causa para precatorios/RPVs. O valor sera exibido quando disponivel via outra fonte de dados.</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-3 h-3 text-muted-foreground" />
                    <Select value={filtroTribunal} onValueChange={setFiltroTribunal}>
                      <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-filtro-tribunal">
                        <SelectValue placeholder="Tribunal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {tribunaisDisponiveis.map((t) => (
                          <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filtroClasse} onValueChange={setFiltroClasse}>
                      <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-filtro-classe">
                        <SelectValue placeholder="Classe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="precatorio">Precatorio</SelectItem>
                        <SelectItem value="rpv">RPV</SelectItem>
                      </SelectContent>
                    </Select>
                    <Separator orientation="vertical" className="h-6" />
                    <span className="text-[10px] text-muted-foreground">Ordenar:</span>
                    <Button
                      variant={sortField === "valor" ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px] px-2"
                      onClick={() => toggleSort("valor")}
                      disabled={processosComValor === 0}
                      data-testid="button-sort-valor"
                    >
                      <Banknote className="w-3 h-3 mr-1" />
                      Valor
                      {sortField === "valor" && (sortDir === "desc" ? <ArrowDown className="w-3 h-3 ml-1" /> : <ArrowUp className="w-3 h-3 ml-1" />)}
                    </Button>
                    <Button
                      variant={sortField === "data" ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px] px-2"
                      onClick={() => toggleSort("data")}
                      data-testid="button-sort-data"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Data
                      {sortField === "data" && (sortDir === "desc" ? <ArrowDown className="w-3 h-3 ml-1" /> : <ArrowUp className="w-3 h-3 ml-1" />)}
                    </Button>
                    <Button
                      variant={sortField === "tribunal" ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px] px-2"
                      onClick={() => toggleSort("tribunal")}
                      data-testid="button-sort-tribunal"
                    >
                      Tribunal
                      {sortField === "tribunal" && (sortDir === "desc" ? <ArrowDown className="w-3 h-3 ml-1" /> : <ArrowUp className="w-3 h-3 ml-1" />)}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 mb-4 p-3 bg-muted/40 rounded-md flex-wrap">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Download className="w-3.5 h-3.5" />
                    <span className="font-medium">Exportar lista ({filteredProcessos.length} processos):</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-[11px] bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => exportProcessosXLSX(filteredProcessos, parseInt(selectedYear))}
                      disabled={filteredProcessos.length === 0}
                      data-testid="button-export-xlsx"
                    >
                      <FileSpreadsheet className="w-3 h-3 mr-1" />
                      Planilha (Google Sheets)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => exportProcessosCSV(filteredProcessos, parseInt(selectedYear))}
                      disabled={filteredProcessos.length === 0}
                      data-testid="button-export-csv"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => result && exportProcessosJSON(filteredProcessos, parseInt(selectedYear), result)}
                      disabled={filteredProcessos.length === 0}
                      data-testid="button-export-json"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] border-amber-400 text-amber-700 dark:text-amber-400"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/loa/uniao/cruzamento-completo", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ ano_exercicio: parseInt(selectedYear) }),
                          });
                          if (!res.ok) {
                            const errData = await res.json().catch(() => ({}));
                            throw new Error(errData.error || `HTTP ${res.status}`);
                          }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `cruzamento_completo_${selectedYear}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (err: any) {
                          toast({ title: "Erro", description: err?.message || "Falha ao gerar cruzamento completo.", variant: "destructive" });
                        }
                      }}
                      data-testid="button-export-cruzamento"
                    >
                      <FileSpreadsheet className="w-3 h-3 mr-1" />
                      Cruzamento 4 Camadas
                    </Button>
                    <Separator orientation="vertical" className="h-5" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            const urls = filteredProcessos
                              .filter((p: EstoqueProcesso) => p.url_consulta)
                              .map((p: EstoqueProcesso) => `${formatCnj(p.numero_cnj)}\t${p.tribunal_alias.toUpperCase()}\t${p.classe_nome}\t${p.url_consulta}`);
                            if (urls.length > 0) {
                              const content = "Numero CNJ\tTribunal\tClasse\tURL Consulta\n" + urls.join("\n");
                              downloadBlob(content, `urls_consulta_${selectedYear}.txt`, "text/plain;charset=utf-8");
                            }
                          }}
                          disabled={filteredProcessos.length === 0}
                          data-testid="button-export-urls"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          URLs Consulta
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Exportar lista de URLs de consulta dos tribunais para acesso em lote ao oficio requisitorio</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md text-xs text-blue-700 dark:text-blue-300 mb-4">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p><strong>Acesso ao Oficio Requisitorio:</strong> Clique no botao "Consulta" (PJe ou eProc) em cada processo para abrir a consulta publica do tribunal.
                    No sistema do tribunal, localize o documento "Oficio Requisitorio" ou "Requisicao de Pagamento" nos autos.</p>
                    <p><strong>TRF6:</strong> Conforme orientacao oficial, requisicoes PJe devem ser consultadas via TRF1 processual; requisicoes eProc via eproc2g.trf6.jus.br.</p>
                    <p><strong>Valores:</strong> Obtidos da relacao oficial de precatorios publicada pelo tribunal (PDF). Quando marcado "(PDF)", o valor foi extraido do documento oficial de inclusao no orcamento.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredProcessos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Scale className="w-10 h-10 mb-3 opacity-50" />
                      <p className="text-sm">Nenhum processo pendente encontrado com os filtros selecionados</p>
                    </div>
                  ) : (
                    filteredProcessos.map((p: EstoqueProcesso) => (
                      <ProcessoCard
                        key={p.numero_cnj}
                        processo={p}
                        expanded={expandedProcessos.has(p.numero_cnj)}
                        onToggle={() => toggleExpanded(p.numero_cnj)}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Evidencias e Rastreabilidade</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted/40 rounded-md">
                    <p className="text-muted-foreground">Process ID</p>
                    <p className="font-mono break-all" data-testid="text-process-id">{result.process_id_uuid}</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded-md">
                    <p className="text-muted-foreground">Output SHA-256</p>
                    <p className="font-mono break-all" data-testid="text-output-sha256">{result.hashes.output_sha256}</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded-md sm:col-span-2">
                    <p className="text-muted-foreground">Evidence Pack</p>
                    <p className="font-mono break-all">{result.evidence_pack_path}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.sources.map((src: SourceInfo, idx: number) => (
                    <a key={idx} href={src.url} target="_blank" rel="noopener noreferrer" data-testid={`link-source-${idx}`}>
                      <Badge variant="outline" className="text-[10px]">
                        <ExternalLink className="w-2.5 h-2.5 mr-1" />
                        {src.name} ({src.type})
                      </Badge>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!result && !mutation.isPending && (
          <Card>
            <CardContent className="p-12 flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-amber-500/10 mb-4">
                <Scale className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold mb-1" data-testid="text-empty-state">
                Precatorios com Pagamento Pendente
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Consulte processos de precatorios e RPVs que ainda nao foram baixados (pagamento pendente)
                nos Tribunais Regionais Federais (TRF1-TRF6) via CNJ DataJud.
              </p>
              <p className="text-sm text-muted-foreground max-w-md mt-2">
                Cada processo inclui link direto para consulta publica do tribunal, onde voce pode acessar
                e baixar o <strong>oficio requisitorio</strong>.
              </p>
              <div className="flex items-center gap-4 mt-6 text-xs text-muted-foreground flex-wrap justify-center">
                <div className="flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Consulta Publica
                </div>
                <div className="flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Oficio Requisitorio
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Rastreabilidade
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
