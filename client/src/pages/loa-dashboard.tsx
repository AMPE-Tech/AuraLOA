import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  FileCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Database,
  BarChart3,
  Shield,
  Clock,
  Hash,
  ExternalLink,
  Loader2,
  FileText,
  TrendingUp,
  Banknote,
  Scale,
  FolderOpen,
  RefreshCw,
  Info,
  Download,
  Calendar,
  LogOut,
} from "lucide-react";
import type {
  A2Response,
  A2HistoryEntry,
  DotacaoItem,
  ExecucaoItem,
  KPIItem,
  EvidenciaItem,
  ZipDownloadInfo,
  ZipExecucaoResult,
  ZipExecucaoRow,
  ZipEmpenhoDetalhe,
  CruzamentoAcaoItem,
  EstoqueResult,
  EstoqueProcesso,
  EstoqueSummaryByTribunal,
  GapResult,
  GapAcaoItem,
  PDFOrcamentoSummary,
} from "../../shared/loa_types";

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

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "N/D";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "N/D";
  return `${value.toFixed(1)}%`;
}

function KPICard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
}: {
  title: string;
  value: string;
  icon: typeof Banknote;
  subtitle?: string;
  trend?: string;
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-xl font-semibold tracking-tight truncate" data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="p-2 rounded-md bg-primary/10 shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenciaPanel({ evidencias }: { evidencias: EvidenciaItem[] }) {
  if (!evidencias || evidencias.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">Nenhuma evidencia registrada</p>
    );
  }
  return (
    <div className="space-y-2">
      {evidencias.map((ev, idx) => (
        <div key={idx} className="flex flex-col gap-1 p-3 bg-muted/50 rounded-md text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">
              {ev.source_name}
            </Badge>
            <span className="text-muted-foreground">{ev.captured_at_iso}</span>
          </div>
          {ev.source_url && (
            <a
              href={ev.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline flex items-center gap-1 break-all text-foreground"
              data-testid={`link-evidence-${idx}`}
            >
              <ExternalLink className="w-3 h-3 shrink-0" />
              {ev.source_url.length > 80 ? ev.source_url.slice(0, 80) + "..." : ev.source_url}
            </a>
          )}
          {ev.raw_payload_sha256 && (
            <div className="flex items-center gap-1 font-mono text-muted-foreground">
              <Hash className="w-3 h-3 shrink-0" />
              SHA256: {ev.raw_payload_sha256.slice(0, 16)}...
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DotacaoTable({ items }: { items: DotacaoItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Database className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm">Nenhum dado de dotacao encontrado</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.codigo_acao} className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">
                    {item.codigo_acao}
                  </Badge>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm font-medium mt-1">{item.descricao_acao}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="p-3 bg-muted/40 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Dotacao Inicial</p>
                <p className="text-sm font-semibold" data-testid={`dotacao-inicial-${item.codigo_acao}`}>
                  {formatCurrency(item.dotacao_inicial)}
                </p>
              </div>
              <div className="p-3 bg-muted/40 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Dotacao Atual</p>
                <p className="text-sm font-semibold" data-testid={`dotacao-atual-${item.codigo_acao}`}>
                  {formatCurrency(item.dotacao_atual)}
                </p>
              </div>
            </div>
            {item.observacoes && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md text-xs text-amber-700 dark:text-amber-300">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                {item.observacoes}
              </div>
            )}
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Evidencias ({item.evidencias?.length || 0})
              </summary>
              <div className="mt-2">
                <EvidenciaPanel evidencias={item.evidencias} />
              </div>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ExecucaoTable({ items }: { items: ExecucaoItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <BarChart3 className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm">Nenhum dado de execucao encontrado</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.codigo_acao} className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">
                    {item.codigo_acao}
                  </Badge>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm font-medium mt-1">{item.descricao_acao}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="p-3 bg-muted/40 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Empenhado</p>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400" data-testid={`empenhado-${item.codigo_acao}`}>
                  {formatCurrency(item.empenhado)}
                </p>
              </div>
              <div className="p-3 bg-muted/40 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Liquidado</p>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400" data-testid={`liquidado-${item.codigo_acao}`}>
                  {formatCurrency(item.liquidado)}
                </p>
              </div>
              <div className="p-3 bg-muted/40 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Pago</p>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400" data-testid={`pago-${item.codigo_acao}`}>
                  {formatCurrency(item.pago)}
                </p>
              </div>
            </div>
            {item.empenhado !== null && item.empenhado > 0 && item.pago !== null && (
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Execucao (Pago/Empenhado)</span>
                  <span className="font-medium">
                    {formatPercent((item.pago / item.empenhado) * 100)}
                  </span>
                </div>
                <Progress
                  value={Math.min((item.pago / item.empenhado) * 100, 100)}
                  className="h-2"
                  data-testid={`progress-${item.codigo_acao}`}
                />
              </div>
            )}
            {item.observacoes && (
              <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md text-xs text-blue-700 dark:text-blue-300">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                {item.observacoes}
              </div>
            )}
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Evidencias ({item.evidencias?.length || 0})
              </summary>
              <div className="mt-2">
                <EvidenciaPanel evidencias={item.evidencias} />
              </div>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function KPISummaryTable({ items }: { items: KPIItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-3">
      {items.map((kpi) => (
        <Card key={kpi.codigo_acao} className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {kpi.codigo_acao}
                </Badge>
                <span className="text-sm font-medium">{kpi.descricao_acao}</span>
              </div>
              <StatusBadge status={kpi.status} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 bg-muted/40 rounded-md">
                <p className="text-muted-foreground">Dotacao</p>
                <p className="font-semibold">{formatCurrency(kpi.dotacao_atual)}</p>
              </div>
              <div className="p-2 bg-muted/40 rounded-md">
                <p className="text-muted-foreground">Empenhado</p>
                <p className="font-semibold">{formatCurrency(kpi.empenhado)}</p>
              </div>
              <div className="p-2 bg-muted/40 rounded-md">
                <p className="text-muted-foreground">Liquidado</p>
                <p className="font-semibold">{formatCurrency(kpi.liquidado)}</p>
              </div>
              <div className="p-2 bg-muted/40 rounded-md">
                <p className="text-muted-foreground">Pago</p>
                <p className="font-semibold">{formatCurrency(kpi.pago)}</p>
              </div>
            </div>
            {kpi.percentual_execucao !== null && (
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">% Execucao</span>
                  <span className="font-semibold">{formatPercent(kpi.percentual_execucao)}</span>
                </div>
                <Progress value={Math.min(kpi.percentual_execucao, 100)} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ZipExecucaoTable({ data }: { data: ZipExecucaoResult }) {
  if (!data || !data.pago_por_acao_po || data.pago_por_acao_po.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <FileText className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Nenhum dado de execucao encontrado no ZIP</p>
      </div>
    );
  }

  const totalPago = data.pago_por_acao_po.reduce((sum: number, r: ZipExecucaoRow) => sum + r.pago, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Execucao extraida do ZIP (Pagamento x Empenho)</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {data.stats.empenhos_com_pagamento} empenhos
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {data.stats.chaves_acao_po} acoes/PO
          </Badge>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2.5 font-medium text-muted-foreground">Acao</th>
              <th className="text-left p-2.5 font-medium text-muted-foreground">PO</th>
              <th className="text-right p-2.5 font-medium text-muted-foreground">Pago (BRL)</th>
            </tr>
          </thead>
          <tbody>
            {data.pago_por_acao_po.map((row: ZipExecucaoRow, idx: number) => (
              <tr key={`${row.codigo_acao}-${row.codigo_po ?? 'null'}-${idx}`} className="border-b hover:bg-muted/30 transition-colors">
                <td className="p-2.5 font-mono text-xs" data-testid={`zip-acao-${idx}`}>{row.codigo_acao}</td>
                <td className="p-2.5 font-mono text-xs text-muted-foreground">{row.codigo_po || "-"}</td>
                <td className="p-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400" data-testid={`zip-pago-${idx}`}>
                  {formatCurrency(row.pago)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/30">
              <td className="p-2.5 font-semibold" colSpan={2}>Total</td>
              <td className="p-2.5 text-right font-bold text-emerald-700 dark:text-emerald-300" data-testid="zip-total-pago">
                {formatCurrency(totalPago)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function FonteBadge({ fonte }: { fonte: string }) {
  if (fonte === "Indisponivel") {
    return <Badge variant="destructive" className="text-[10px]">Indisponivel</Badge>;
  }
  if (fonte.includes("API")) {
    return <Badge variant="default" className="bg-blue-600 text-[10px]">API REST</Badge>;
  }
  if (fonte.includes("ZIP")) {
    return <Badge variant="default" className="bg-violet-600 text-[10px]">ZIP/CSV</Badge>;
  }
  if (fonte.includes("SPARQL")) {
    return <Badge variant="default" className="bg-teal-600 text-[10px]">SPARQL</Badge>;
  }
  return <Badge variant="secondary" className="text-[10px]">{fonte}</Badge>;
}

function CruzamentoDetalhado({ items }: { items: CruzamentoAcaoItem[] }) {
  if (!items || items.length === 0) return null;

  const totalEmp = items.reduce((s, i) => s + (i.empenhado_final || 0), 0);
  const totalLiq = items.reduce((s, i) => s + (i.liquidado_final || 0), 0);
  const totalPag = items.reduce((s, i) => s + (i.pago_final || 0), 0);
  const totalDot = items.reduce((s, i) => s + (i.dotacao_atual || 0), 0);
  const acoesCom = items.filter(i => i.empenhado_final !== null || i.pago_final !== null).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Cruzamento Dotacao x Execucao por Acao (DPO)</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">{acoesCom}/{items.length} acoes com dados</Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" data-testid="table-cruzamento">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 font-medium text-muted-foreground">Acao</th>
              <th className="text-left p-2 font-medium text-muted-foreground max-w-[200px]">Descricao</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Dotacao Atual</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Empenhado</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Liquidado</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Pago</th>
              <th className="text-right p-2 font-medium text-muted-foreground">% Exec</th>
              <th className="text-center p-2 font-medium text-muted-foreground">Fonte Exec</th>
              <th className="text-center p-2 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.codigo_acao} className="border-b hover:bg-muted/30 transition-colors" data-testid={`row-cruzamento-${item.codigo_acao}`}>
                <td className="p-2 font-mono font-semibold">{item.codigo_acao}</td>
                <td className="p-2 max-w-[200px] truncate" title={item.descricao_acao}>{item.descricao_acao}</td>
                <td className="p-2 text-right font-mono">{formatCurrency(item.dotacao_atual)}</td>
                <td className="p-2 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(item.empenhado_final)}</td>
                <td className="p-2 text-right font-mono text-amber-600 dark:text-amber-400">{formatCurrency(item.liquidado_final)}</td>
                <td className="p-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.pago_final)}</td>
                <td className="p-2 text-right font-mono">{formatPercent(item.percentual_execucao)}</td>
                <td className="p-2 text-center"><FonteBadge fonte={item.fonte_execucao} /></td>
                <td className="p-2 text-center"><StatusBadge status={item.status} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/30 font-semibold">
              <td className="p-2" colSpan={2}>TOTAL</td>
              <td className="p-2 text-right font-mono">{formatCurrency(totalDot || null)}</td>
              <td className="p-2 text-right font-mono text-blue-700 dark:text-blue-300">{formatCurrency(totalEmp || null)}</td>
              <td className="p-2 text-right font-mono text-amber-700 dark:text-amber-300">{formatCurrency(totalLiq || null)}</td>
              <td className="p-2 text-right font-mono text-emerald-700 dark:text-emerald-300">{formatCurrency(totalPag || null)}</td>
              <td className="p-2 text-right font-mono">
                {totalEmp > 0 ? formatPercent((totalPag / totalEmp) * 100) : "N/D"}
              </td>
              <td className="p-2" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.filter(i => i.empenhado_api !== null || i.pago_zip !== null).map((item) => (
          <Card key={item.codigo_acao} className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">{item.codigo_acao}</Badge>
                  <StatusBadge status={item.status} />
                </div>
                {item.qtd_empenhos_zip > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{item.qtd_empenhos_zip} empenhos ZIP</Badge>
                )}
              </div>
              <p className="text-xs font-medium mb-3 text-muted-foreground">{item.descricao_acao}</p>

              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-muted/40 rounded-md">
                    <p className="text-muted-foreground">Dotacao Atual</p>
                    <p className="font-semibold">{formatCurrency(item.dotacao_atual)}</p>
                    <FonteBadge fonte={item.fonte_dotacao} />
                  </div>
                  <div className="p-2 bg-muted/40 rounded-md">
                    <p className="text-muted-foreground">% Execucao</p>
                    <p className="font-semibold text-lg">{formatPercent(item.percentual_execucao)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md">
                    <p className="text-blue-600 dark:text-blue-400">Empenhado</p>
                    <p className="font-semibold text-blue-700 dark:text-blue-300">{formatCurrency(item.empenhado_final)}</p>
                    {item.empenhado_api !== null && item.empenhado_zip !== null && (
                      <p className="text-[10px] text-muted-foreground mt-1">API: {formatCurrency(item.empenhado_api)} | ZIP: {formatCurrency(item.empenhado_zip)}</p>
                    )}
                  </div>
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                    <p className="text-amber-600 dark:text-amber-400">Liquidado</p>
                    <p className="font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(item.liquidado_final)}</p>
                  </div>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-md">
                    <p className="text-emerald-600 dark:text-emerald-400">Pago</p>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(item.pago_final)}</p>
                    {item.pago_api !== null && item.pago_zip !== null && (
                      <p className="text-[10px] text-muted-foreground mt-1">API: {formatCurrency(item.pago_api)} | ZIP: {formatCurrency(item.pago_zip)}</p>
                    )}
                  </div>
                </div>

                {item.empenhado_final !== null && item.pago_final !== null && item.empenhado_final > 0 && (
                  <Progress value={Math.min((item.pago_final / item.empenhado_final) * 100, 100)} className="h-2" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmpenhoDetalheTable({ empenhos }: { empenhos: ZipEmpenhoDetalhe[] }) {
  if (!empenhos || empenhos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <FileText className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Nenhum empenho detalhado disponivel</p>
        <p className="text-xs">Selecione um mes para extrair dados do ZIP</p>
      </div>
    );
  }

  const empenhosComValor = empenhos.filter(e => e.valor_empenho > 0 || e.valor_pago > 0);
  const totalEmp = empenhosComValor.reduce((s, e) => s + e.valor_empenho, 0);
  const totalPago = empenhosComValor.reduce((s, e) => s + e.valor_pago, 0);
  const totalLiq = empenhosComValor.reduce((s, e) => s + e.valor_liquidado, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Empenhos Detalhados (Fonte: ZIP CSV)</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{empenhos.length} empenhos</Badge>
          <Badge variant="secondary" className="text-xs">{empenhosComValor.length} com valores</Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse" data-testid="table-empenhos">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-1.5 font-medium text-muted-foreground">Empenho</th>
              <th className="text-left p-1.5 font-medium text-muted-foreground">Data</th>
              <th className="text-left p-1.5 font-medium text-muted-foreground">Acao</th>
              <th className="text-left p-1.5 font-medium text-muted-foreground">PO</th>
              <th className="text-left p-1.5 font-medium text-muted-foreground">Orgao</th>
              <th className="text-left p-1.5 font-medium text-muted-foreground">UG</th>
              <th className="text-left p-1.5 font-medium text-muted-foreground max-w-[150px]">Favorecido</th>
              <th className="text-right p-1.5 font-medium text-muted-foreground">Empenhado</th>
              <th className="text-right p-1.5 font-medium text-muted-foreground">Liquidado</th>
              <th className="text-right p-1.5 font-medium text-muted-foreground">Pago</th>
            </tr>
          </thead>
          <tbody>
            {empenhosComValor.map((emp, idx) => (
              <tr key={emp.codigo_empenho || idx} className="border-b hover:bg-muted/30 transition-colors" data-testid={`row-empenho-${idx}`}>
                <td className="p-1.5 font-mono">{emp.codigo_empenho?.slice(-15) || "-"}</td>
                <td className="p-1.5">{emp.data_emissao || "-"}</td>
                <td className="p-1.5 font-mono font-semibold">{emp.codigo_acao}</td>
                <td className="p-1.5 font-mono text-muted-foreground">{emp.codigo_po || "-"}</td>
                <td className="p-1.5" title={emp.orgao}>{emp.codigo_orgao}</td>
                <td className="p-1.5" title={emp.unidade_gestora}>{emp.codigo_ug}</td>
                <td className="p-1.5 max-w-[150px] truncate" title={emp.favorecido}>{emp.favorecido || "-"}</td>
                <td className="p-1.5 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(emp.valor_empenho)}</td>
                <td className="p-1.5 text-right font-mono text-amber-600 dark:text-amber-400">{formatCurrency(emp.valor_liquidado || null)}</td>
                <td className="p-1.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(emp.valor_pago || null)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/30 font-semibold text-xs">
              <td className="p-1.5" colSpan={7}>TOTAL ({empenhosComValor.length} empenhos)</td>
              <td className="p-1.5 text-right font-mono text-blue-700 dark:text-blue-300">{formatCurrency(totalEmp)}</td>
              <td className="p-1.5 text-right font-mono text-amber-700 dark:text-amber-300">{formatCurrency(totalLiq)}</td>
              <td className="p-1.5 text-right font-mono text-emerald-700 dark:text-emerald-300">{formatCurrency(totalPago)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function EstoquePanel({ data, onFetchAll }: { data: EstoqueResult; onFetchAll?: (tribunal: string) => void }) {
  const { toast } = useToast();
  const [filterTribunal, setFilterTribunal] = useState<string>("todos");
  const [downloadingTribunal, setDownloadingTribunal] = useState<string | null>(null);

  const filteredProcessos = filterTribunal === "todos"
    ? data.processos
    : data.processos.filter((p) => p.tribunal_alias === filterTribunal);

  const tribunaisComProcessos = data.summary.por_tribunal.filter((t) => t.total_processos > 0);

  const totalDisponivel = data.summary.por_tribunal.reduce((sum, t) => sum + (t.total_disponivel || t.total_processos), 0);
  const hasMoreAvailable = totalDisponivel > data.summary.total_processos;

  const handleDownloadCSV = async (tribunalAlias?: string) => {
    const label = tribunalAlias || "todos";
    setDownloadingTribunal(label);
    try {
      const body: any = {
        ano_exercicio: data.ano_exercicio,
        max_por_tribunal: 10000,
      };
      if (tribunalAlias) {
        body.tribunais = [tribunalAlias];
      }
      const res = await apiRequest("POST", "/api/loa/uniao/estoque/csv", body);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `estoque_${label}_${data.ano_exercicio}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV baixado", description: `Estoque ${label.toUpperCase()} exportado` });
    } catch (err: any) {
      toast({ title: "Erro no download", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingTribunal(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            Estoque CNJ (DataJud) - Exercicio {data.ano_exercicio}
          </h3>
          <p className="text-xs text-muted-foreground">
            {data.tribunais_consultados.length} tribunais consultados | Providers: {data.providers_used.join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={data.status_geral} />
          <Badge variant="outline" className="font-mono text-[10px]">
            <Hash className="w-3 h-3 mr-1" />
            {data.process_id_uuid.slice(0, 8)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPICard
          title="Processos Carregados"
          value={String(data.summary.total_processos)}
          icon={FileText}
          subtitle={hasMoreAvailable ? `de ${totalDisponivel.toLocaleString("pt-BR")} disponiveis no DataJud` : "Precatorios + RPVs"}
        />
        <KPICard
          title="Precatorios"
          value={String(data.summary.total_precatorios)}
          icon={Scale}
          subtitle="Classe 1265"
        />
        <KPICard
          title="RPVs"
          value={String(data.summary.total_rpvs)}
          icon={Banknote}
          subtitle="Classe 1266"
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm font-medium">Resumo por Tribunal</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadCSV()}
              disabled={downloadingTribunal !== null || data.summary.total_processos === 0}
              data-testid="button-download-estoque-all-csv"
            >
              {downloadingTribunal === "todos" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
              Baixar Todos CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" data-testid="table-estoque-tribunal">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium text-muted-foreground">Tribunal</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Carregados</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Disponiveis</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Prec.</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">RPVs</th>
                  <th className="text-center p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-center p-2 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.summary.por_tribunal.map((t: EstoqueSummaryByTribunal) => {
                  const hasMore = t.total_disponivel !== null && t.total_disponivel > t.total_processos;
                  return (
                    <tr key={t.tribunal_alias} className="border-b hover:bg-muted/30 transition-colors" data-testid={`row-tribunal-${t.tribunal_alias}`}>
                      <td className="p-2">
                        <span className="font-mono font-semibold">{t.tribunal_alias.toUpperCase()}</span>
                        <span className="text-muted-foreground ml-2 hidden sm:inline">{t.tribunal}</span>
                      </td>
                      <td className="p-2 text-right font-semibold">{t.total_processos}</td>
                      <td className="p-2 text-right">
                        {t.total_disponivel !== null ? (
                          <span className={hasMore ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
                            {t.total_disponivel.toLocaleString("pt-BR")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-2 text-right text-blue-600 dark:text-blue-400">{t.precatorios}</td>
                      <td className="p-2 text-right text-emerald-600 dark:text-emerald-400">{t.rpvs}</td>
                      <td className="p-2 text-center">
                        <StatusBadge status={t.status === "ERRO" ? "NAO_LOCALIZADO" : t.status} />
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          {t.total_processos > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => handleDownloadCSV(t.tribunal_alias)}
                              disabled={downloadingTribunal !== null}
                              data-testid={`button-download-csv-${t.tribunal_alias}`}
                            >
                              {downloadingTribunal === t.tribunal_alias ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              <span className="ml-1">CSV</span>
                            </Button>
                          )}
                          {hasMore && onFetchAll && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-amber-600 dark:text-amber-400"
                              onClick={() => onFetchAll(t.tribunal_alias)}
                              data-testid={`button-fetch-all-${t.tribunal_alias}`}
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span className="ml-1">Buscar {t.total_disponivel?.toLocaleString("pt-BR")}</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="p-2">TOTAL</td>
                  <td className="p-2 text-right">{data.summary.total_processos}</td>
                  <td className="p-2 text-right">{totalDisponivel > 0 ? totalDisponivel.toLocaleString("pt-BR") : "-"}</td>
                  <td className="p-2 text-right text-blue-700 dark:text-blue-300">{data.summary.total_precatorios}</td>
                  <td className="p-2 text-right text-emerald-700 dark:text-emerald-300">{data.summary.total_rpvs}</td>
                  <td className="p-2" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {data.processos.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-sm font-medium">
                Processos ({filteredProcessos.length}{filterTribunal !== "todos" ? ` de ${data.processos.length}` : ""})
              </p>
              {tribunaisComProcessos.length > 1 && (
                <Select value={filterTribunal} onValueChange={setFilterTribunal}>
                  <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="select-filter-tribunal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Tribunais</SelectItem>
                    {tribunaisComProcessos.map((t) => (
                      <SelectItem key={t.tribunal_alias} value={t.tribunal_alias}>
                        {t.tribunal_alias.toUpperCase()} ({t.total_processos})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-[11px] border-collapse" data-testid="table-estoque-processos">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-1.5 font-medium text-muted-foreground">Numero CNJ</th>
                    <th className="text-left p-1.5 font-medium text-muted-foreground">Tribunal</th>
                    <th className="text-left p-1.5 font-medium text-muted-foreground">Classe</th>
                    <th className="text-left p-1.5 font-medium text-muted-foreground">Situação</th>
                    <th className="text-left p-1.5 font-medium text-muted-foreground">Dt. Ajuizamento</th>
                    <th className="text-left p-1.5 font-medium text-muted-foreground">Orgao Julgador</th>
                    <th className="text-right p-1.5 font-medium text-muted-foreground">Valor</th>
                    <th className="text-right p-1.5 font-medium text-muted-foreground">Movs.</th>
                    <th className="text-center p-1.5 font-medium text-muted-foreground">Consulta</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcessos.map((p: EstoqueProcesso, idx: number) => (
                    <tr key={p.numero_cnj || idx} className="border-b hover:bg-muted/30 transition-colors" data-testid={`row-processo-${idx}`}>
                      <td className="p-1.5 font-mono text-[10px]">{p.numero_cnj || "-"}</td>
                      <td className="p-1.5 font-mono">{p.tribunal_alias.toUpperCase()}</td>
                      <td className="p-1.5">
                        <Badge variant={p.classe_codigo === 1265 ? "default" : "secondary"} className="text-[10px]">
                          {p.classe_nome || p.classe_codigo}
                        </Badge>
                      </td>
                      <td className="p-1.5">
                        <Badge variant={p.pagamento_pendente ? "destructive" : "secondary"} className="text-[10px]">
                          {p.situacao}
                        </Badge>
                      </td>
                      <td className="p-1.5">{p.data_ajuizamento ? p.data_ajuizamento.substring(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$3/$2/$1") : "-"}</td>
                      <td className="p-1.5 max-w-[180px] truncate" title={p.orgao_julgador?.nome || ""}>{p.orgao_julgador?.nome || "-"}</td>
                      <td className="p-1.5 text-right font-mono">
                        {p.valor_causa !== null ? p.valor_causa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}
                      </td>
                      <td className="p-1.5 text-right">{p.total_movimentos}</td>
                      <td className="p-1.5 text-center">
                        {p.url_consulta && (
                          <a href={p.url_consulta} target="_blank" rel="noopener noreferrer">
                            <Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-primary/10">
                              <ExternalLink className="w-2.5 h-2.5 mr-0.5" />
                              PJe
                            </Badge>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.pdf_orcamento_summaries && data.pdf_orcamento_summaries.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium">Relação Oficial de Precatórios (PDF Tribunal)</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {data.pdf_orcamento_summaries.map((pdf: PDFOrcamentoSummary, idx: number) => (
                <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-sm">{pdf.tribunal}</p>
                      <p className="text-xs text-muted-foreground">Orçamento {pdf.ano_orcamento}</p>
                    </div>
                    <a
                      href={pdf.fonte_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`button-download-pdf-${idx}`}
                    >
                      <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Baixar PDF Oficial
                      </Button>
                    </a>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2 bg-background rounded">
                      <p className="text-muted-foreground">Total Precatórios</p>
                      <p className="font-semibold text-lg">{pdf.total_precatorios_pdf.toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <p className="text-muted-foreground">Valor Total Orçamento</p>
                      <p className="font-semibold text-lg text-emerald-600 dark:text-emerald-400">
                        {pdf.valor_total_orcamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <p className="text-muted-foreground">Idosos (preferência)</p>
                      <p className="font-semibold">{pdf.total_idoso.toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <p className="text-muted-foreground">PcD (preferência)</p>
                      <p className="font-semibold">{pdf.total_deficiencia.toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Shield className="w-3 h-3" />
                    <span>SHA-256: {pdf.sha256.slice(0, 16)}...</span>
                    <span className="mx-1">|</span>
                    <a href={pdf.fonte_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline break-all">
                      {pdf.fonte_url}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Evidencias Estoque</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-muted/40 rounded-md">
              <p className="text-muted-foreground">Output SHA-256</p>
              <p className="font-mono break-all" data-testid="text-estoque-sha256">{data.hashes.output_sha256}</p>
            </div>
            <div className="p-2 bg-muted/40 rounded-md">
              <p className="text-muted-foreground">Evidence Pack</p>
              <p className="font-mono break-all">{data.evidence_pack_path}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.sources.map((src: { name: string; url: string; type: string }, idx: number) => (
              <a key={idx} href={src.url} target="_blank" rel="noopener noreferrer" data-testid={`link-estoque-source-${idx}`}>
                <Badge variant="outline" className="text-[10px]">
                  <ExternalLink className="w-2.5 h-2.5 mr-1" />
                  {src.name} ({src.type})
                </Badge>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GapAnalysisPanel({ data }: { data: GapResult }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (type: "gap-csv" | "cruzamento") => {
    setDownloading(type);
    try {
      const endpoint = type === "gap-csv"
        ? "/api/loa/uniao/gap-analysis/csv"
        : "/api/loa/uniao/cruzamento-completo";
      const res = await apiRequest("POST", endpoint, { ano_exercicio: data.ano_exercicio });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = type === "gap-csv" ? "gap_analysis_completo" : "cruzamento_4_camadas";
      a.download = `${suffix}_${data.ano_exercicio}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV baixado", description: type === "gap-csv" ? "Gap Analysis completo exportado" : "Cruzamento 4 camadas exportado" });
    } catch (err: any) {
      toast({ title: "Erro no download", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Gap Analysis - Exercicio {data.ano_exercicio}
          </h3>
          <p className="text-xs text-muted-foreground">
            Dotacao (SIOP) vs Execucao (Portal) vs Estoque (CNJ)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload("gap-csv")}
            disabled={downloading !== null}
            data-testid="button-download-gap-csv"
          >
            {downloading === "gap-csv" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
            Gap CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload("cruzamento")}
            disabled={downloading !== null}
            data-testid="button-download-cruzamento"
            className="border-violet-400 text-violet-700 dark:text-violet-400"
          >
            {downloading === "cruzamento" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
            4 Camadas CSV
          </Button>
          <StatusBadge status={data.status_geral} />
          <Badge variant="outline" className="font-mono text-[10px]">
            <Hash className="w-3 h-3 mr-1" />
            {data.process_id_uuid.slice(0, 8)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Dotacao Total"
          value={formatCurrency(data.totais.dotacao_total)}
          icon={Database}
          subtitle="Orcamento previsto"
        />
        <KPICard
          title="Total Pago"
          value={formatCurrency(data.totais.pago_total)}
          icon={Banknote}
          subtitle="Execucao efetiva"
        />
        <KPICard
          title="Estoque Processos"
          value={String(data.totais.estoque_total_processos)}
          icon={FileText}
          subtitle={`${data.totais.estoque_total_precatorios} prec. + ${data.totais.estoque_total_rpvs} RPVs`}
        />
        <KPICard
          title="Cobertura"
          value={data.totais.cobertura_pct !== null ? formatPercent(data.totais.cobertura_pct) : "N/D"}
          icon={TrendingUp}
          subtitle={data.totais.gap_dotacao_vs_pago !== null ? `Gap: ${formatCurrency(data.totais.gap_dotacao_vs_pago)}` : "Gap: N/D"}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Gap por Acao Orcamentaria</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" data-testid="table-gap-analysis">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium text-muted-foreground">Acao</th>
                  <th className="text-left p-2 font-medium text-muted-foreground max-w-[180px]">Descricao</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Dotacao</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Empenhado</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Pago</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Gap (Dot-Pago)</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Cobertura</th>
                  <th className="text-center p-2 font-medium text-muted-foreground">Estoque</th>
                  <th className="text-center p-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.por_acao.map((item: GapAcaoItem) => (
                  <tr key={item.codigo_acao} className="border-b hover:bg-muted/30 transition-colors" data-testid={`row-gap-${item.codigo_acao}`}>
                    <td className="p-2 font-mono font-semibold">{item.codigo_acao}</td>
                    <td className="p-2 max-w-[180px] truncate" title={item.descricao_acao}>{item.descricao_acao}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(item.dotacao_atual)}</td>
                    <td className="p-2 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(item.total_empenhado)}</td>
                    <td className="p-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.total_pago)}</td>
                    <td className={`p-2 text-right font-mono ${item.gap_dotacao_vs_pago !== null && item.gap_dotacao_vs_pago > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatCurrency(item.gap_dotacao_vs_pago)}
                    </td>
                    <td className="p-2 text-right font-mono">{formatPercent(item.cobertura_pct)}</td>
                    <td className="p-2 text-center">
                      <span className="text-muted-foreground">{item.estoque_processos > 0 ? item.estoque_processos : "-"}</span>
                    </td>
                    <td className="p-2 text-center"><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="p-2" colSpan={2}>TOTAL</td>
                  <td className="p-2 text-right font-mono">{formatCurrency(data.totais.dotacao_total)}</td>
                  <td className="p-2 text-right font-mono text-blue-700 dark:text-blue-300">{formatCurrency(data.totais.empenhado_total)}</td>
                  <td className="p-2 text-right font-mono text-emerald-700 dark:text-emerald-300">{formatCurrency(data.totais.pago_total)}</td>
                  <td className="p-2 text-right font-mono">{formatCurrency(data.totais.gap_dotacao_vs_pago)}</td>
                  <td className="p-2 text-right font-mono">{formatPercent(data.totais.cobertura_pct)}</td>
                  <td className="p-2 text-center">{data.totais.estoque_total_processos}</td>
                  <td className="p-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {data.estoque_por_tribunal.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Estoque por Tribunal (CNJ DataJud)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.estoque_por_tribunal.map((t: EstoqueSummaryByTribunal) => (
                <div key={t.tribunal_alias} className="p-3 bg-muted/40 rounded-md" data-testid={`card-tribunal-${t.tribunal_alias}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono font-semibold text-sm">{t.tribunal_alias.toUpperCase()}</span>
                    <StatusBadge status={t.status === "ERRO" ? "NAO_LOCALIZADO" : t.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{t.tribunal}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">{t.total_processos}</p>
                    </div>
                    <div>
                      <p className="text-blue-600 dark:text-blue-400">Prec.</p>
                      <p className="font-semibold">{t.precatorios}</p>
                    </div>
                    <div>
                      <p className="text-emerald-600 dark:text-emerald-400">RPVs</p>
                      <p className="font-semibold">{t.rpvs}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.pdf_orcamento_summaries && data.pdf_orcamento_summaries.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium">Relação Oficial de Precatórios (PDF Tribunal)</span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {data.pdf_orcamento_summaries.map((pdf: PDFOrcamentoSummary, idx: number) => (
                <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-sm">{pdf.tribunal}</p>
                      <p className="text-xs text-muted-foreground">Orçamento {pdf.ano_orcamento}</p>
                    </div>
                    <a
                      href={pdf.fonte_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`button-gap-download-pdf-${idx}`}
                    >
                      <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Baixar PDF Oficial
                      </Button>
                    </a>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2 bg-background rounded">
                      <p className="text-muted-foreground">Total Precatórios</p>
                      <p className="font-semibold text-lg">{pdf.total_precatorios_pdf.toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <p className="text-muted-foreground">Valor Total Orçamento</p>
                      <p className="font-semibold text-lg text-emerald-600 dark:text-emerald-400">
                        {pdf.valor_total_orcamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <p className="text-muted-foreground">Idosos (preferência)</p>
                      <p className="font-semibold">{pdf.total_idoso.toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <p className="text-muted-foreground">PcD (preferência)</p>
                      <p className="font-semibold">{pdf.total_deficiencia.toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Shield className="w-3 h-3" />
                    <span>SHA-256: {pdf.sha256.slice(0, 16)}...</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Evidencias Gap Analysis</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-muted/40 rounded-md">
              <p className="text-muted-foreground">Output SHA-256</p>
              <p className="font-mono break-all" data-testid="text-gap-sha256">{data.hashes.output_sha256}</p>
            </div>
            <div className="p-2 bg-muted/40 rounded-md">
              <p className="text-muted-foreground">Evidence Pack</p>
              <p className="font-mono break-all">{data.evidence_pack_path}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.sources.map((src: { name: string; url: string; type: string }, idx: number) => (
              <a key={idx} href={src.url} target="_blank" rel="noopener noreferrer" data-testid={`link-gap-source-${idx}`}>
                <Badge variant="outline" className="text-[10px]">
                  <ExternalLink className="w-2.5 h-2.5 mr-1" />
                  {src.name} ({src.type})
                </Badge>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultPanel({ data }: { data: A2Response }) {
  const totalPago = data.data.execucao.reduce((sum: number, e: ExecucaoItem) => sum + (e.pago || 0), 0);
  const totalEmpenhado = data.data.execucao.reduce((sum: number, e: ExecucaoItem) => sum + (e.empenhado || 0), 0);
  const totalDotacao = data.data.dotacao.reduce((sum: number, d: DotacaoItem) => sum + (d.dotacao_atual || 0), 0);
  const pctExec = totalEmpenhado > 0 ? (totalPago / totalEmpenhado) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-result-title">
            Resultado - Exercicio {data.ano_exercicio}
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerado em {new Date(data.generated_at_iso).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={data.status_geral} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="font-mono text-[10px]">
                <Hash className="w-3 h-3 mr-1" />
                {data.process_id_uuid.slice(0, 8)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">{data.process_id_uuid}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Total Pago"
          value={formatCurrency(totalPago)}
          icon={Banknote}
          subtitle="Soma dos pagamentos"
        />
        <KPICard
          title="Total Empenhado"
          value={formatCurrency(totalEmpenhado)}
          icon={FileText}
          subtitle="Soma dos empenhos"
        />
        <KPICard
          title="Dotacao Total"
          value={formatCurrency(totalDotacao || null)}
          icon={Database}
          subtitle="Soma da dotacao atual"
        />
        <KPICard
          title="% Execucao"
          value={pctExec !== null ? formatPercent(pctExec) : "N/D"}
          icon={TrendingUp}
          subtitle="Pago / Empenhado"
        />
      </div>

      {data.zip_download && (
        <Card className={data.zip_download.ok ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Download className={`w-4 h-4 ${data.zip_download.ok ? "text-emerald-600" : "text-red-500"}`} />
                <span className="text-sm font-medium">ZIP Despesas - Mes {data.mes}</span>
                <Badge variant={data.zip_download.ok ? "default" : "destructive"} className={data.zip_download.ok ? "bg-emerald-600" : ""}>
                  {data.zip_download.ok ? "Baixado" : `Falhou (${data.zip_download.status})`}
                </Badge>
              </div>
              {data.zip_download.ok && (
                <span className="text-xs text-muted-foreground font-mono">
                  {(data.zip_download.bytes / 1048576).toFixed(1)} MB
                </span>
              )}
            </div>
            {data.zip_download.ok && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-muted/40 rounded-md">
                  <p className="text-muted-foreground">SHA-256</p>
                  <p className="font-mono break-all" data-testid="text-zip-sha256">{data.zip_download.sha256}</p>
                </div>
                <div className="p-2 bg-muted/40 rounded-md">
                  <p className="text-muted-foreground">Arquivo</p>
                  <p className="font-mono break-all">{data.zip_download.filePath}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="cruzamento" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="cruzamento" data-testid="tab-cruzamento">
            <Scale className="w-4 h-4 mr-1.5" />
            Cruzamento
          </TabsTrigger>
          {data.data.execucao_zip?.empenhos_detalhe && data.data.execucao_zip.empenhos_detalhe.length > 0 && (
            <TabsTrigger value="empenhos" data-testid="tab-empenhos">
              <FileCheck className="w-4 h-4 mr-1.5" />
              Empenhos
            </TabsTrigger>
          )}
          <TabsTrigger value="execucao" data-testid="tab-execucao">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Execucao API
          </TabsTrigger>
          <TabsTrigger value="dotacao" data-testid="tab-dotacao">
            <Database className="w-4 h-4 mr-1.5" />
            Dotacao
          </TabsTrigger>
          {data.data.execucao_zip && (
            <TabsTrigger value="execucao_zip" data-testid="tab-execucao-zip">
              <FileText className="w-4 h-4 mr-1.5" />
              Execucao ZIP
            </TabsTrigger>
          )}
          <TabsTrigger value="evidencias" data-testid="tab-evidencias">
            <Shield className="w-4 h-4 mr-1.5" />
            Evidencias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cruzamento" className="mt-4">
          {data.data.cruzamento ? (
            <CruzamentoDetalhado items={data.data.cruzamento} />
          ) : (
            <KPISummaryTable items={data.data.kpis} />
          )}
        </TabsContent>

        {data.data.execucao_zip?.empenhos_detalhe && data.data.execucao_zip.empenhos_detalhe.length > 0 && (
          <TabsContent value="empenhos" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <EmpenhoDetalheTable empenhos={data.data.execucao_zip.empenhos_detalhe} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="execucao" className="mt-4">
          <ExecucaoTable items={data.data.execucao} />
        </TabsContent>

        {data.data.execucao_zip && (
          <TabsContent value="execucao_zip" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <ZipExecucaoTable data={data.data.execucao_zip} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="dotacao" className="mt-4">
          <DotacaoTable items={data.data.dotacao} />
        </TabsContent>

        <TabsContent value="evidencias" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Pacote de Evidencias</span>
                </div>
                <Badge variant="secondary">{data.evidencias_count} registros</Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-muted/40 rounded-md">
                  <p className="text-muted-foreground mb-1">Schema Version</p>
                  <p className="font-mono">{data.schema_version}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-md">
                  <p className="text-muted-foreground mb-1">Output SHA-256</p>
                  <p className="font-mono break-all">{data.hashes.output_sha256}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-md sm:col-span-2">
                  <p className="text-muted-foreground mb-1">Evidence Pack Path</p>
                  <p className="font-mono flex items-center gap-1">
                    <FolderOpen className="w-3 h-3 shrink-0" />
                    {data.evidence_pack_path}
                  </p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Fontes consultadas</p>
                <div className="flex flex-wrap gap-2">
                  {data.sources.map((src: { name: string; url: string; type: string }, idx: number) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1"
                    >
                      <Badge variant="outline" className="text-[10px]">
                        <ExternalLink className="w-2.5 h-2.5 mr-1" />
                        {src.name} ({src.type})
                      </Badge>
                    </a>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function LOADashboard() {
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [currentResult, setCurrentResult] = useState<A2Response | null>(null);
  const [estoqueResult, setEstoqueResult] = useState<EstoqueResult | null>(null);
  const [gapResult, setGapResult] = useState<GapResult | null>(null);
  const [activeView, setActiveView] = useState<"a2" | "estoque" | "gap">("a2");
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const historyQuery = useQuery<A2HistoryEntry[]>({
    queryKey: ["/api/loa/uniao/a2/history"],
  });

  const mutation = useMutation({
    mutationFn: async ({ ano, mes }: { ano: number; mes?: number }) => {
      const body: Record<string, number> = { ano_exercicio: ano };
      if (mes) body.mes = mes;
      const res = await apiRequest("POST", "/api/loa/uniao/a2", body);
      return res.json();
    },
    onSuccess: (data: A2Response) => {
      setCurrentResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/loa/uniao/a2/history"] });
      const zipMsg = data.zip_download
        ? ` | ZIP: ${data.zip_download.ok ? `${(data.zip_download.bytes / 1048576).toFixed(1)}MB` : 'falhou'}`
        : '';
      toast({
        title: "Consulta concluida",
        description: `Status: ${data.status_geral} | ${data.evidencias_count} evidencias${zipMsg}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na consulta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const batchMutation = useMutation({
    mutationFn: async (ano: number) => {
      const res = await apiRequest("POST", "/api/loa/uniao/a2/batch-download", {
        ano_exercicio: ano,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Batch download concluido",
        description: `${data.summary.downloaded}/12 ZIPs baixados com sucesso`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no batch download",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const estoqueMutation = useMutation({
    mutationFn: async (params: { ano: number; tribunais?: string[]; max_por_tribunal?: number }) => {
      const res = await apiRequest("POST", "/api/loa/uniao/estoque", {
        ano_exercicio: params.ano,
        tribunais: params.tribunais,
        max_por_tribunal: params.max_por_tribunal || 500,
      });
      return res.json();
    },
    onSuccess: (data: EstoqueResult) => {
      setEstoqueResult(data);
      setActiveView("estoque");
      toast({
        title: "Estoque consultado",
        description: `${data.summary.total_processos} processos (${data.summary.total_precatorios} prec., ${data.summary.total_rpvs} RPVs)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na consulta de estoque",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const gapMutation = useMutation({
    mutationFn: async (ano: number) => {
      const res = await apiRequest("POST", "/api/loa/uniao/gap-analysis", {
        ano_exercicio: ano,
      });
      return res.json();
    },
    onSuccess: (data: GapResult) => {
      setGapResult(data);
      setActiveView("gap");
      toast({
        title: "Gap Analysis concluida",
        description: `${data.por_acao.length} acoes analisadas | Cobertura: ${data.totais.cobertura_pct !== null ? data.totais.cobertura_pct.toFixed(1) + '%' : 'N/D'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no Gap Analysis",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConsulta = () => {
    const mes = selectedMonth && selectedMonth !== "none" ? parseInt(selectedMonth) : undefined;
    mutation.mutate({ ano: parseInt(selectedYear), mes });
    setActiveView("a2");
  };

  const handleBatchDownload = () => {
    batchMutation.mutate(parseInt(selectedYear));
  };

  const handleEstoque = () => {
    estoqueMutation.mutate({ ano: parseInt(selectedYear) });
  };

  const handleGapAnalysis = () => {
    gapMutation.mutate(parseInt(selectedYear));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-primary/15">
                <Scale className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight" data-testid="text-app-title">
                  AuraLOA
                </h1>
                <p className="text-[10px] text-muted-foreground">
                  Precatorios inscritos na LOA
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button variant="outline" size="sm" data-testid="link-federal" className="border-blue-400 text-blue-700 dark:text-blue-400">
                  <Scale className="w-3.5 h-3.5 mr-1" />
                  Federal
                </Button>
              </Link>
              <Link href="/dashboard/sp">
                <Button variant="outline" size="sm" data-testid="link-sp" className="border-amber-400 text-amber-700 dark:text-amber-400">
                  <Scale className="w-3.5 h-3.5 mr-1" />
                  SP (Estado)
                </Button>
              </Link>
              <Link href="/dashboard/pendentes">
                <Button variant="outline" size="sm" data-testid="link-pendentes">
                  <Scale className="w-3.5 h-3.5 mr-1" />
                  Pendentes
                </Button>
              </Link>
              <Link href="/dashboard/contrato">
                <Button variant="outline" size="sm" data-testid="link-contrato">
                  <Shield className="w-3.5 h-3.5 mr-1" />
                  Contrato DPO
                </Button>
              </Link>
              {localStorage.getItem("aura_role") === "admin" && (
                <Link href="/dashboard/admin">
                  <Button variant="outline" size="sm" data-testid="link-admin" className="border-violet-500/40 text-violet-400 hover:text-violet-300">
                    <Shield className="w-3.5 h-3.5 mr-1" />
                    Admin
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-logout"
                onClick={() => {
                  localStorage.removeItem("aura_token");
                  localStorage.removeItem("aura_email");
                  localStorage.removeItem("aura_role");
                  window.location.href = "/";
                }}
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Sair
              </Button>
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
                  Exercicio (Ano)
                </label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger data-testid="select-year" className="w-full">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[160px]">
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                  Mes (ZIP download)
                </label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger data-testid="select-month" className="w-full">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem download</SelectItem>
                    {MONTH_NAMES.map((name, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1)}>
                        {String(idx + 1).padStart(2, "0")} - {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleConsulta}
                disabled={mutation.isPending}
                data-testid="button-consultar"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-1.5" />
                    Consultar
                  </>
                )}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleBatchDownload}
                    disabled={batchMutation.isPending}
                    data-testid="button-batch-download"
                  >
                    {batchMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Baixando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1.5" />
                        12 meses
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Baixar ZIPs de todos os 12 meses do ano selecionado</p>
                </TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="h-8" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleEstoque}
                    disabled={estoqueMutation.isPending}
                    data-testid="button-estoque"
                  >
                    {estoqueMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Estoque...
                      </>
                    ) : (
                      <>
                        <Scale className="w-4 h-4 mr-1.5" />
                        Estoque CNJ
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Consultar estoque de processos no CNJ DataJud (TRF1-TRF6)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    onClick={handleGapAnalysis}
                    disabled={gapMutation.isPending}
                    data-testid="button-gap-analysis"
                    className="bg-violet-600 text-white"
                  >
                    {gapMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 mr-1.5" />
                        Gap Analysis
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cruzar Dotacao x Execucao x Estoque CNJ</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              Download automatico agendado para dia 1 de cada mes
            </div>
            {(mutation.isPending || batchMutation.isPending || estoqueMutation.isPending || gapMutation.isPending) && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {batchMutation.isPending
                    ? "Baixando ZIPs de 12 meses (pode levar alguns minutos)..."
                    : estoqueMutation.isPending
                    ? "Consultando estoque CNJ DataJud (TRF1-TRF6)..."
                    : gapMutation.isPending
                    ? "Executando Gap Analysis (Dotacao x Execucao x Estoque)..."
                    : "Buscando dados do Portal da Transparencia e SIOP..."}
                </div>
                <Progress value={undefined} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>

        {activeView === "a2" && currentResult && <ResultPanel data={currentResult} />}
        {activeView === "estoque" && estoqueResult && (
          <EstoquePanel
            data={estoqueResult}
            onFetchAll={async (tribunal) => {
              const tribunalData = estoqueResult.summary.por_tribunal.find((t) => t.tribunal_alias === tribunal);
              const maxNeeded = tribunalData?.total_disponivel || 10000;
              toast({ title: `Buscando todos processos ${tribunal.toUpperCase()}...`, description: `Pode levar alguns segundos para ${maxNeeded.toLocaleString("pt-BR")} processos` });
              try {
                const res = await apiRequest("POST", "/api/loa/uniao/estoque", {
                  ano_exercicio: estoqueResult.ano_exercicio,
                  tribunais: [tribunal],
                  max_por_tribunal: maxNeeded,
                });
                const singleResult: EstoqueResult = await res.json();
                setEstoqueResult((prev) => {
                  if (!prev) return singleResult;
                  const otherProcessos = prev.processos.filter((p) => p.tribunal_alias !== tribunal);
                  const mergedProcessos = [...otherProcessos, ...singleResult.processos];
                  const mergedPorTribunal = prev.summary.por_tribunal.map((t) =>
                    t.tribunal_alias === tribunal
                      ? (singleResult.summary.por_tribunal[0] || t)
                      : t
                  );
                  const totalPrec = mergedProcessos.filter((p) => p.classe_codigo === 1265).length;
                  const totalRpv = mergedProcessos.filter((p) => p.classe_codigo === 1266).length;
                  return {
                    ...prev,
                    processos: mergedProcessos,
                    summary: {
                      ...prev.summary,
                      total_processos: mergedProcessos.length,
                      total_precatorios: totalPrec,
                      total_rpvs: totalRpv,
                      por_tribunal: mergedPorTribunal,
                    },
                  };
                });
                toast({ title: `${tribunal.toUpperCase()} completo`, description: `${singleResult.summary.total_processos} processos carregados` });
              } catch (err: any) {
                toast({ title: "Erro ao buscar todos", description: err.message, variant: "destructive" });
              }
            }}
          />
        )}
        {activeView === "gap" && gapResult && <GapAnalysisPanel data={gapResult} />}

        {(activeView === "a2" ? currentResult : activeView === "estoque" ? estoqueResult : gapResult) && (
          <div className="flex items-center gap-2 flex-wrap">
            {currentResult && activeView !== "a2" && (
              <Button variant="ghost" size="sm" onClick={() => setActiveView("a2")} data-testid="button-view-a2">
                <BarChart3 className="w-3 h-3 mr-1" />
                Ver Dotacao x Execucao
              </Button>
            )}
            {estoqueResult && activeView !== "estoque" && (
              <Button variant="ghost" size="sm" onClick={() => setActiveView("estoque")} data-testid="button-view-estoque">
                <Scale className="w-3 h-3 mr-1" />
                Ver Estoque CNJ
              </Button>
            )}
            {gapResult && activeView !== "gap" && (
              <Button variant="ghost" size="sm" onClick={() => setActiveView("gap")} data-testid="button-view-gap">
                <TrendingUp className="w-3 h-3 mr-1" />
                Ver Gap Analysis
              </Button>
            )}
          </div>
        )}

        {!currentResult && !estoqueResult && !gapResult && !mutation.isPending && !estoqueMutation.isPending && !gapMutation.isPending && (
          <Card>
            <CardContent className="p-12 flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <BarChart3 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1" data-testid="text-empty-state">
                Consulte Precatorios da LOA Federal
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Selecione o ano de exercicio e clique em "Consultar" para cruzar dados de
                dotacao (SIOP) com execucao (Portal da Transparencia) das acoes
                orcamentarias de precatorios.
              </p>
              <div className="flex items-center gap-4 mt-6 text-xs text-muted-foreground flex-wrap justify-center">
                <div className="flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5" />
                  Auditavel
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Com evidencias
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  Hashes SHA-256
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {historyQuery.data && historyQuery.data.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Consultas recentes</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {historyQuery.data.slice(0, 6).map((entry) => (
                <Card key={entry.id} className="hover-elevate cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-semibold">
                        Exercicio {entry.ano_exercicio}
                      </span>
                      <StatusBadge status={entry.status_geral} />
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        {new Date(entry.generated_at_iso).toLocaleString("pt-BR")}
                      </p>
                      <p>{entry.evidencias_count} evidencias</p>
                      {entry.execucao_total_pago !== null && (
                        <p>
                          Total pago: {formatCurrency(entry.execucao_total_pago)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
