import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

function ResultPanel({ data }: { data: A2Response }) {
  const totalPago = data.data.execucao.reduce((sum, e) => sum + (e.pago || 0), 0);
  const totalEmpenhado = data.data.execucao.reduce((sum, e) => sum + (e.empenhado || 0), 0);
  const totalDotacao = data.data.dotacao.reduce((sum, d) => sum + (d.dotacao_atual || 0), 0);
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

      <Tabs defaultValue="execucao" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="execucao" data-testid="tab-execucao">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Execucao
          </TabsTrigger>
          <TabsTrigger value="dotacao" data-testid="tab-dotacao">
            <Database className="w-4 h-4 mr-1.5" />
            Dotacao
          </TabsTrigger>
          <TabsTrigger value="kpis" data-testid="tab-kpis">
            <TrendingUp className="w-4 h-4 mr-1.5" />
            KPIs
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

        <TabsContent value="kpis" className="mt-4">
          <KPISummaryTable items={data.data.kpis} />
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
                  {data.sources.map((src, idx) => (
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

  const handleConsulta = () => {
    const mes = selectedMonth && selectedMonth !== "none" ? parseInt(selectedMonth) : undefined;
    mutation.mutate({ ano: parseInt(selectedYear), mes });
  };

  const handleBatchDownload = () => {
    batchMutation.mutate(parseInt(selectedYear));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Scale className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight" data-testid="text-app-title">
                  AuraLOA
                </h1>
                <p className="text-xs text-muted-foreground">
                  Precatorios inscritos na LOA - Uniao (Federal)
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              MVP A2 - Dotacao + Execucao
            </Badge>
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
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              Download automatico agendado para dia 1 de cada mes
            </div>
            {(mutation.isPending || batchMutation.isPending) && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {batchMutation.isPending
                    ? "Baixando ZIPs de 12 meses (pode levar alguns minutos)..."
                    : "Buscando dados do Portal da Transparencia e SIOP..."}
                </div>
                <Progress value={undefined} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>

        {currentResult && <ResultPanel data={currentResult} />}

        {!currentResult && !mutation.isPending && (
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
