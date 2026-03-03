import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Scale,
  Shield,
  Hash,
  ExternalLink,
  Loader2,
  FileText,
  Banknote,
  Database,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Info,
  Download,
  Zap,
  Upload,
  TrendingUp,
  Clock,
  LogOut,
} from "lucide-react";
import type { SpA2Result, SpImportResult, SpTjspResult, TjspItem } from "../../shared/loa_types";

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/D";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/D";
  return `${Number(value).toFixed(1)}%`;
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

export default function SpDashboard() {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState("2025");

  const [loaCsvText, setLoaCsvText] = useState("");
  const [despesasCsvText, setDespesasCsvText] = useState("");
  const [tjspEntidade, setTjspEntidade] = useState("FAZENDA DO ESTADO DE SAO PAULO");

  const [a2Orgao, setA2Orgao] = useState("");
  const [a2Uo, setA2Uo] = useState("");
  const [activeView, setActiveView] = useState<"results" | "tjsp" | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => String(currentYear + 1 - i));

  const statusQuery = useQuery<any>({
    queryKey: ["/api/sp/status"],
  });

  const loaImportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sp/loa/import", {
        ano: parseInt(selectedYear),
        csvText: loaCsvText,
      });
      return res.json();
    },
    onSuccess: (data: SpImportResult) => {
      toast({ title: "LOA SP Importada", description: `${data.imported} linhas importadas com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["/api/sp/status"] });
      setLoaCsvText("");
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err?.message || "Falha ao importar LOA SP.", variant: "destructive" });
    },
  });

  const despesasImportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sp/despesas/import", {
        ano: parseInt(selectedYear),
        csvText: despesasCsvText,
      });
      return res.json();
    },
    onSuccess: (data: SpImportResult) => {
      toast({ title: "Despesas SP Importadas", description: `${data.imported} linhas importadas com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["/api/sp/status"] });
      setDespesasCsvText("");
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err?.message || "Falha ao importar despesas SP.", variant: "destructive" });
    },
  });

  const autoExecucaoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sp/auto/execucao", {
        ano: parseInt(selectedYear),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.ok) {
        toast({
          title: "Execucao SP importada",
          description: `${data.total_linhas} linhas | ${data.precatorios_encontrados} precatorios`,
        });
      } else {
        toast({
          title: "Dados nao disponiveis",
          description: data.note || `Arquivo nao disponivel para ${selectedYear}.`,
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sp/status"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err?.message || "Falha ao importar automaticamente.", variant: "destructive" });
    },
  });

  const autoDotacaoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sp/auto/dotacao", {
        ano: parseInt(selectedYear),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.ok) {
        toast({
          title: "Dotacao SP importada",
          description: `${data.total_linhas} linhas | ${data.precatorios_encontrados} precatorios`,
        });
      } else {
        toast({
          title: "Dados nao disponiveis",
          description: data.note || `Arquivo nao disponivel para ${selectedYear}.`,
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sp/status"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err?.message || "Falha ao importar automaticamente.", variant: "destructive" });
    },
  });

  const tjspPendentesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sp/tjsp/pendentes?entidade=${encodeURIComponent(tjspEntidade)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      setActiveView("tjsp");
    },
    onError: (err: any) => {
      toast({ title: "Erro TJSP", description: err?.message || "Falha ao consultar TJSP.", variant: "destructive" });
    },
  });

  const tjspPagamentosMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sp/tjsp/pagamentos?entidade=${encodeURIComponent(tjspEntidade)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      setActiveView("tjsp");
    },
    onError: (err: any) => {
      toast({ title: "Erro TJSP", description: err?.message || "Falha ao consultar TJSP.", variant: "destructive" });
    },
  });

  const a2Mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sp/a2", {
        ano: parseInt(selectedYear),
        orgao: a2Orgao || undefined,
        uo: a2Uo || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setActiveView("results");
    },
    onError: (err: any) => {
      toast({ title: "Erro A2 SP", description: err?.message || "Falha na conciliacao.", variant: "destructive" });
    },
  });

  const a2Result = a2Mutation.data as SpA2Result | undefined;
  const tjspPendentesResult = tjspPendentesMutation.data as SpTjspResult | undefined;
  const tjspPagamentosResult = tjspPagamentosMutation.data as SpTjspResult | undefined;

  const isAnyPending = autoExecucaoMutation.isPending || autoDotacaoMutation.isPending || a2Mutation.isPending || tjspPendentesMutation.isPending || tjspPagamentosMutation.isPending;

  const totalDotacao = a2Result?.summary?.dotacao_atual_total ?? 0;
  const totalExecucao = a2Result?.summary?.execucao_total ?? 0;
  const saldoEstimado = a2Result?.summary?.saldo_estimado ?? 0;
  const pctExec = totalDotacao > 0 ? (totalExecucao / totalDotacao) * 100 : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-500/10">
                <Scale className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight" data-testid="text-sp-title">
                  AuraLOA
                </h1>
                <p className="text-[10px] text-muted-foreground">
                  Precatorios LOA - Estado de Sao Paulo
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
                  <SelectTrigger data-testid="select-year-sp" className="w-full">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => autoExecucaoMutation.mutate()}
                    disabled={isAnyPending}
                    data-testid="button-auto-execucao"
                  >
                    {autoExecucaoMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1.5" />
                        Execucao
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Baixar CSV de execucao orcamentaria da Sefaz/SP</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => autoDotacaoMutation.mutate()}
                    disabled={isAnyPending}
                    data-testid="button-auto-dotacao"
                  >
                    {autoDotacaoMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1.5" />
                        Dotacao
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Baixar CSV de dotacao inicial da Sefaz/SP</p>
                </TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="h-8" />
              <Button
                onClick={() => a2Mutation.mutate()}
                disabled={isAnyPending}
                data-testid="button-a2-sp"
              >
                {a2Mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Conciliando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-1.5" />
                    Conciliar A2
                  </>
                )}
              </Button>
              <Separator orientation="vertical" className="h-8" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => tjspPendentesMutation.mutate()}
                    disabled={isAnyPending || !tjspEntidade.trim()}
                    data-testid="button-tjsp-pendentes"
                  >
                    {tjspPendentesMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        TJSP...
                      </>
                    ) : (
                      <>
                        <Scale className="w-4 h-4 mr-1.5" />
                        Estoque TJSP
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Consultar precatorios pendentes no TJSP/DEPRE</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="w-3 h-3" />
              Dados importados automaticamente de dworcamento.fazenda.sp.gov.br
            </div>
            {isAnyPending && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {autoExecucaoMutation.isPending
                    ? "Baixando CSV de execucao da Sefaz/SP..."
                    : autoDotacaoMutation.isPending
                    ? "Baixando CSV de dotacao da Sefaz/SP..."
                    : a2Mutation.isPending
                    ? "Executando conciliacao A2 (Dotacao x Execucao)..."
                    : tjspPendentesMutation.isPending
                    ? "Consultando TJSP pendentes..."
                    : "Consultando TJSP pagamentos..."}
                </div>
                <Progress value={undefined} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>

        {statusQuery.data && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="hover-elevate">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground truncate">LOA SP Importada</p>
                    <p className="text-xl font-semibold tracking-tight truncate" data-testid="kpi-loa-sp-count">
                      {statusQuery.data.dados_importados?.loa?.total_registros ?? 0} registros
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Anos: {(statusQuery.data.dados_importados?.loa?.anos ?? []).join(", ") || "Nenhum"}
                    </p>
                  </div>
                  <div className="p-2 rounded-md bg-primary/10 shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground truncate">Despesas SP Importadas</p>
                    <p className="text-xl font-semibold tracking-tight truncate" data-testid="kpi-despesas-sp-count">
                      {statusQuery.data.dados_importados?.despesas?.total_registros ?? 0} registros
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Anos: {(statusQuery.data.dados_importados?.despesas?.anos ?? []).join(", ") || "Nenhum"}
                    </p>
                  </div>
                  <div className="p-2 rounded-md bg-primary/10 shrink-0">
                    <Banknote className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground truncate">Status Modulo</p>
                    <p className="text-xl font-semibold tracking-tight truncate" data-testid="kpi-sp-status">
                      {statusQuery.data.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ente: {statusQuery.data.ente}
                    </p>
                  </div>
                  <div className="p-2 rounded-md bg-emerald-500/10 shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeView === "results" && a2Result && (
          <ResultsPanel
            a2Result={a2Result}
            selectedYear={selectedYear}
            totalDotacao={totalDotacao}
            totalExecucao={totalExecucao}
            saldoEstimado={saldoEstimado}
            pctExec={pctExec}
            autoExecData={autoExecucaoMutation.data as any}
            autoDotData={autoDotacaoMutation.data as any}
            loaCsvText={loaCsvText}
            setLoaCsvText={setLoaCsvText}
            despesasCsvText={despesasCsvText}
            setDespesasCsvText={setDespesasCsvText}
            loaImportMutation={loaImportMutation}
            despesasImportMutation={despesasImportMutation}
          />
        )}

        {activeView === "tjsp" && (
          <TJSPPanel
            tjspPendentesResult={tjspPendentesResult}
            tjspPagamentosResult={tjspPagamentosResult}
            tjspEntidade={tjspEntidade}
            setTjspEntidade={setTjspEntidade}
            tjspPagamentosMutation={tjspPagamentosMutation}
          />
        )}

        {activeView !== null && (
          <div className="flex items-center gap-2 flex-wrap">
            {a2Result && activeView !== "results" && (
              <Button variant="ghost" size="sm" onClick={() => setActiveView("results")} data-testid="button-view-results">
                <BarChart3 className="w-3 h-3 mr-1" />
                Ver Conciliacao A2
              </Button>
            )}
            {(tjspPendentesResult || tjspPagamentosResult) && activeView !== "tjsp" && (
              <Button variant="ghost" size="sm" onClick={() => setActiveView("tjsp")} data-testid="button-view-tjsp">
                <Scale className="w-3 h-3 mr-1" />
                Ver Estoque TJSP
              </Button>
            )}
          </div>
        )}

        {activeView === null && !isAnyPending && (
          <Card>
            <CardContent className="p-12 flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <BarChart3 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1" data-testid="text-empty-state">
                Consulte Precatorios da LOA SP
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Importe dados de execucao e dotacao da Sefaz/SP, depois execute a conciliacao A2 para cruzar dotacao x execucao.
              </p>
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <Badge variant="outline" className="text-[10px]">
                  <Zap className="w-3 h-3 mr-1" />
                  Import Automatico Sefaz/SP
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <Scale className="w-3 h-3 mr-1" />
                  Estoque TJSP/DEPRE
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Conciliacao A2
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {activeView === null && !isAnyPending && (
          <ImportAndFontesPanel
            autoExecData={autoExecucaoMutation.data as any}
            autoDotData={autoDotacaoMutation.data as any}
            loaCsvText={loaCsvText}
            setLoaCsvText={setLoaCsvText}
            despesasCsvText={despesasCsvText}
            setDespesasCsvText={setDespesasCsvText}
            loaImportMutation={loaImportMutation}
            despesasImportMutation={despesasImportMutation}
          />
        )}
      </main>
    </div>
  );
}

function ResultsPanel({
  a2Result,
  selectedYear,
  totalDotacao,
  totalExecucao,
  saldoEstimado,
  pctExec,
  autoExecData,
  autoDotData,
  loaCsvText,
  setLoaCsvText,
  despesasCsvText,
  setDespesasCsvText,
  loaImportMutation,
  despesasImportMutation,
}: {
  a2Result: SpA2Result;
  selectedYear: string;
  totalDotacao: number;
  totalExecucao: number;
  saldoEstimado: number;
  pctExec: number | null;
  autoExecData: any;
  autoDotData: any;
  loaCsvText: string;
  setLoaCsvText: (v: string) => void;
  despesasCsvText: string;
  setDespesasCsvText: (v: string) => void;
  loaImportMutation: any;
  despesasImportMutation: any;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold" data-testid="text-results-title">
            Resultado A2 — SP {selectedYear}
          </h2>
          <Badge variant="outline" className="font-mono text-[10px] border-amber-400 text-amber-700 dark:text-amber-400">
            Ente Estado
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {a2Result.loa_count} LOA
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {a2Result.despesas_count} Despesas
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Dotacao Total"
          value={formatCurrency(totalDotacao || null)}
          icon={Database}
          subtitle={`${a2Result.loa_count} registros LOA`}
        />
        <KPICard
          title="Execucao Total"
          value={formatCurrency(totalExecucao || null)}
          icon={Banknote}
          subtitle={`${a2Result.despesas_count} despesas`}
        />
        <KPICard
          title="Saldo Estimado"
          value={formatCurrency(saldoEstimado)}
          icon={TrendingUp}
          subtitle="Dotacao - Execucao"
        />
        <KPICard
          title="% Execucao"
          value={pctExec !== null ? formatPercent(pctExec) : "N/D"}
          icon={BarChart3}
          subtitle="Execucao / Dotacao"
        />
      </div>

      <Tabs defaultValue="conciliacao" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="conciliacao" data-testid="tab-conciliacao">
            <Scale className="w-4 h-4 mr-1.5" />
            Conciliacao
          </TabsTrigger>
          <TabsTrigger value="dados-importados" data-testid="tab-dados-importados">
            <Download className="w-4 h-4 mr-1.5" />
            Dados Importados
          </TabsTrigger>
          <TabsTrigger value="fontes" data-testid="tab-fontes">
            <ExternalLink className="w-4 h-4 mr-1.5" />
            Fontes Oficiais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conciliacao" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Cruzamento Dotacao x Execucao — SP {selectedYear}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" data-testid="table-a2-sp">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2.5 font-medium text-muted-foreground">Metrica</th>
                      <th className="text-right p-2.5 font-medium text-muted-foreground">Valor (BRL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-blue-500" />
                        Dotacao Atual Total
                      </td>
                      <td className="p-2.5 text-right font-semibold text-blue-600 dark:text-blue-400" data-testid="a2-dotacao-total">
                        {formatCurrency(totalDotacao)}
                      </td>
                    </tr>
                    <tr className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 flex items-center gap-2">
                        <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                        Execucao Total (Liquidado)
                      </td>
                      <td className="p-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400" data-testid="a2-execucao-total">
                        {formatCurrency(totalExecucao)}
                      </td>
                    </tr>
                    <tr className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 flex items-center gap-2">
                        <TrendingUp className={`w-3.5 h-3.5 ${saldoEstimado >= 0 ? "text-emerald-500" : "text-red-500"}`} />
                        Saldo Estimado
                      </td>
                      <td className={`p-2.5 text-right font-bold ${saldoEstimado >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`} data-testid="a2-saldo">
                        {formatCurrency(saldoEstimado)}
                      </td>
                    </tr>
                    {pctExec !== null && (
                      <tr className="border-t-2 bg-muted/30">
                        <td className="p-2.5 font-semibold flex items-center gap-2">
                          <BarChart3 className="w-3.5 h-3.5 text-primary" />
                          % Execucao
                        </td>
                        <td className="p-2.5 text-right font-bold" data-testid="a2-pct-exec">
                          {formatPercent(pctExec)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {pctExec !== null && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Execucao / Dotacao</span>
                    <span className="font-medium">{formatPercent(pctExec)}</span>
                  </div>
                  <Progress value={Math.min(pctExec, 100)} className="h-2" />
                </div>
              )}
              {a2Result.summary.note && (
                <div className="mt-3 flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md text-xs text-amber-700 dark:text-amber-300">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  {a2Result.summary.note}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dados-importados" className="mt-4 space-y-4">
          {autoExecData && (
            <Card className={autoExecData.ok ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div className="flex items-center gap-2">
                    <Download className={`w-4 h-4 ${autoExecData.ok ? "text-emerald-600" : "text-red-500"}`} />
                    <span className="text-sm font-medium">Execucao Sefaz/SP — {autoExecData.ano}</span>
                    <Badge variant={autoExecData.ok ? "default" : "destructive"} className={autoExecData.ok ? "bg-emerald-600" : ""}>
                      {autoExecData.ok ? `${autoExecData.precatorios_encontrados} precatorios` : "Indisponivel"}
                    </Badge>
                  </div>
                  {autoExecData.ok && (
                    <span className="text-xs text-muted-foreground">{autoExecData.total_linhas} linhas</span>
                  )}
                </div>
                {autoExecData.ok && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                      <div className="p-2 bg-muted/40 rounded-md">
                        <p className="text-muted-foreground">SHA-256</p>
                        <p className="font-mono break-all" data-testid="text-auto-exec-sha">{autoExecData.evidence?.csv_sha256}</p>
                      </div>
                      <div className="p-2 bg-muted/40 rounded-md">
                        <p className="text-muted-foreground">Fonte</p>
                        <p className="font-mono break-all text-[10px]">{autoExecData.fonte_url}</p>
                      </div>
                    </div>
                    {autoExecData.precatorios?.map((p: any, i: number) => (
                      <div key={i} className="p-2 bg-muted/30 rounded-md text-xs mb-1" data-testid={`text-prec-exec-${i}`}>
                        <span className="font-medium">{p.desc_projeto}</span>
                        <span className="text-muted-foreground ml-2">Dot. {formatCurrency(p.dotacao_inicial)}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 ml-2">Liq. {formatCurrency(p.valor_liquidado)}</span>
                      </div>
                    ))}
                  </>
                )}
                {!autoExecData.ok && autoExecData.note && (
                  <p className="text-xs text-red-600 dark:text-red-400">{autoExecData.note}</p>
                )}
              </CardContent>
            </Card>
          )}

          {autoDotData && (
            <Card className={autoDotData.ok ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div className="flex items-center gap-2">
                    <Download className={`w-4 h-4 ${autoDotData.ok ? "text-emerald-600" : "text-red-500"}`} />
                    <span className="text-sm font-medium">Dotacao Sefaz/SP — {autoDotData.ano}</span>
                    <Badge variant={autoDotData.ok ? "default" : "destructive"} className={autoDotData.ok ? "bg-emerald-600" : ""}>
                      {autoDotData.ok ? `${autoDotData.precatorios_encontrados} precatorios` : "Indisponivel"}
                    </Badge>
                  </div>
                  {autoDotData.ok && (
                    <span className="text-xs text-muted-foreground">{autoDotData.total_linhas} linhas</span>
                  )}
                </div>
                {autoDotData.ok && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                      <div className="p-2 bg-muted/40 rounded-md">
                        <p className="text-muted-foreground">SHA-256</p>
                        <p className="font-mono break-all" data-testid="text-auto-dot-sha">{autoDotData.evidence?.csv_sha256}</p>
                      </div>
                      <div className="p-2 bg-muted/40 rounded-md">
                        <p className="text-muted-foreground">Fonte</p>
                        <p className="font-mono break-all text-[10px]">{autoDotData.fonte_url}</p>
                      </div>
                    </div>
                    {autoDotData.precatorios?.map((p: any, i: number) => (
                      <div key={i} className="p-2 bg-muted/30 rounded-md text-xs mb-1" data-testid={`text-prec-dot-${i}`}>
                        <span className="font-medium">{p.desc_projeto}</span>
                        <span className="text-muted-foreground ml-2">Dot. Inicial {formatCurrency(p.dotacao_inicial)}</span>
                      </div>
                    ))}
                  </>
                )}
                {!autoDotData.ok && autoDotData.note && (
                  <p className="text-xs text-red-600 dark:text-red-400">{autoDotData.note}</p>
                )}
              </CardContent>
            </Card>
          )}

          {!autoExecData && !autoDotData && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Download className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Nenhum dado importado ainda. Use os botoes acima para baixar dados da Sefaz/SP.</p>
            </div>
          )}

          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5" data-testid="toggle-manual-import">
              <Upload className="w-3.5 h-3.5" />
              Importacao Manual (CSV colado)
            </summary>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    LOA SP (Dotacao)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="ORGAO;UO;PROGRAMA;ACAO;DOTACAO_ATUAL&#10;SECRETARIA X;1234;999;ATIVIDADE Y;1.234.567,89"
                    value={loaCsvText}
                    onChange={(e: any) => setLoaCsvText(e.target.value)}
                    className="min-h-[100px] font-mono text-xs"
                    data-testid="textarea-loa-csv"
                  />
                  <Button
                    onClick={() => loaImportMutation.mutate()}
                    disabled={loaImportMutation.isPending || !loaCsvText.trim()}
                    className="w-full"
                    size="sm"
                    data-testid="button-import-loa"
                  >
                    {loaImportMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Importar LOA SP
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Banknote className="w-4 h-4" />
                    Despesas SP (Execucao)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="ORGAO;UO;FASE;VALOR;DATA&#10;SECRETARIA X;1234;PAGAMENTO;123.456,78;2025-01-10"
                    value={despesasCsvText}
                    onChange={(e: any) => setDespesasCsvText(e.target.value)}
                    className="min-h-[100px] font-mono text-xs"
                    data-testid="textarea-despesas-csv"
                  />
                  <Button
                    onClick={() => despesasImportMutation.mutate()}
                    disabled={despesasImportMutation.isPending || !despesasCsvText.trim()}
                    className="w-full"
                    size="sm"
                    data-testid="button-import-despesas"
                  >
                    {despesasImportMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Importar Despesas SP
                  </Button>
                </CardContent>
              </Card>
            </div>
          </details>
        </TabsContent>

        <TabsContent value="fontes" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <ExternalLink className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Fontes Oficiais — Estado de Sao Paulo</span>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md">
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    Camada 1: LOA SP (Dotacao)
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">Fonte: Secretaria da Fazenda do Estado de SP</p>
                  <div className="space-y-1">
                    <a href="https://portal.fazenda.sp.gov.br/servicos/orcamento/Paginas/loa.aspx" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-loa-sp">
                      <ExternalLink className="w-3 h-3" />
                      portal.fazenda.sp.gov.br - LOA
                    </a>
                    <a href="https://dworcamento.fazenda.sp.gov.br" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-dworcamento">
                      <ExternalLink className="w-3 h-3" />
                      dworcamento.fazenda.sp.gov.br - Dados Abertos
                    </a>
                  </div>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-md">
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <Banknote className="w-3.5 h-3.5" />
                    Camada 2: Execucao (Despesas)
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">Fonte: Portal da Transparencia do Estado de SP</p>
                  <a href="https://www.transparencia.sp.gov.br/" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-transparencia-sp">
                    <ExternalLink className="w-3 h-3" />
                    transparencia.sp.gov.br
                  </a>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <Scale className="w-3.5 h-3.5" />
                    Camada 3: Estoque (TJSP/DEPRE)
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">Fonte: Tribunal de Justica do Estado de SP</p>
                  <div className="space-y-1">
                    <a href="https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-tjsp-pendentes">
                      <ExternalLink className="w-3 h-3" />
                      TJSP - Lista de Precatorios Pendentes
                    </a>
                    <a href="https://www.tjsp.jus.br/cac/scp/webmenupesquisa.aspx" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-tjsp-pesquisa">
                      <ExternalLink className="w-3 h-3" />
                      TJSP - Menu de Pesquisa
                    </a>
                    <a href="https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-tjsp-lista-pagamentos">
                      <ExternalLink className="w-3 h-3" />
                      TJSP - Listas de Pagamento
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TJSPPanel({
  tjspPendentesResult,
  tjspPagamentosResult,
  tjspEntidade,
  setTjspEntidade,
  tjspPagamentosMutation,
}: {
  tjspPendentesResult?: SpTjspResult;
  tjspPagamentosResult?: SpTjspResult;
  tjspEntidade: string;
  setTjspEntidade: (v: string) => void;
  tjspPagamentosMutation: any;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Estoque TJSP/DEPRE</h2>
          <Badge variant="outline" className="font-mono text-[10px] border-amber-400 text-amber-700 dark:text-amber-400">
            Ente Estado
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Entidade para consulta</span>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[250px]">
              <Input
                value={tjspEntidade}
                onChange={(e) => setTjspEntidade(e.target.value)}
                placeholder="FAZENDA DO ESTADO DE SAO PAULO"
                className="font-mono text-xs"
                data-testid="input-entidade-tjsp"
              />
            </div>
            <Button
              onClick={() => tjspPagamentosMutation.mutate()}
              disabled={tjspPagamentosMutation.isPending || !tjspEntidade.trim()}
              variant="outline"
              data-testid="button-tjsp-pagamentos"
            >
              {tjspPagamentosMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Pagamentos
            </Button>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md">
            <p className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              MVP best-effort: captura HTML da pagina do TJSP. Algumas paginas exigem selecao de entidade via formulario POST.
            </p>
          </div>
        </CardContent>
      </Card>

      {tjspPendentesResult && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold">Pendentes TJSP</span>
              </div>
              <Badge variant="outline">{tjspPendentesResult.count} itens</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{tjspPendentesResult.note}</p>
            {tjspPendentesResult.count > 0 ? (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {tjspPendentesResult.data.map((item: TjspItem, idx: number) => (
                  <div key={idx} className="p-2 bg-muted/50 rounded text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.numero && <Badge variant="secondary" className="font-mono">{item.numero}</Badge>}
                      {item.credor && <span className="truncate">{item.credor}</span>}
                      {item.valor !== undefined && (
                        <Badge className="bg-blue-600 text-white">{formatCurrency(item.valor)}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Nenhum item extraido.</p>
            )}
            <p className="text-[10px] font-mono text-muted-foreground mt-2">
              <Hash className="w-3 h-3 inline mr-1" />
              {tjspPendentesResult.evidence?.bundle_sha256?.slice(0, 24)}...
            </p>
          </CardContent>
        </Card>
      )}

      {tjspPagamentosResult && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold">Pagamentos TJSP</span>
              </div>
              <Badge variant="outline">{tjspPagamentosResult.count} itens</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{tjspPagamentosResult.note}</p>
            {tjspPagamentosResult.count > 0 ? (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {tjspPagamentosResult.data.map((item: TjspItem, idx: number) => (
                  <div key={idx} className="p-2 bg-muted/50 rounded text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.numero && <Badge variant="secondary" className="font-mono">{item.numero}</Badge>}
                      {item.credor && <span className="truncate">{item.credor}</span>}
                      {item.valor !== undefined && (
                        <Badge className="bg-green-600 text-white">{formatCurrency(item.valor)}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Nenhum item extraido.</p>
            )}
            <p className="text-[10px] font-mono text-muted-foreground mt-2">
              <Hash className="w-3 h-3 inline mr-1" />
              {tjspPagamentosResult.evidence?.bundle_sha256?.slice(0, 24)}...
            </p>
          </CardContent>
        </Card>
      )}

      {(tjspPendentesResult || tjspPagamentosResult) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium mb-2">URLs Oficiais TJSP para consulta manual:</p>
            <div className="space-y-1">
              {Object.entries((tjspPendentesResult || tjspPagamentosResult)?.urls_consulta || {}).map(([key, url]) => (
                <a
                  key={key}
                  href={url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs underline text-primary"
                >
                  <ExternalLink className="w-3 h-3" />
                  {key}: {(url as string).length > 60 ? (url as string).slice(0, 60) + "..." : url as string}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImportAndFontesPanel({
  autoExecData,
  autoDotData,
  loaCsvText,
  setLoaCsvText,
  despesasCsvText,
  setDespesasCsvText,
  loaImportMutation,
  despesasImportMutation,
}: {
  autoExecData: any;
  autoDotData: any;
  loaCsvText: string;
  setLoaCsvText: (v: string) => void;
  despesasCsvText: string;
  setDespesasCsvText: (v: string) => void;
  loaImportMutation: any;
  despesasImportMutation: any;
}) {
  return (
    <Tabs defaultValue="dados-importados" className="w-full">
      <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
        <TabsTrigger value="dados-importados" data-testid="tab-importar">
          <Download className="w-4 h-4 mr-1.5" />
          Dados Importados
        </TabsTrigger>
        <TabsTrigger value="fontes" data-testid="tab-fontes">
          <ExternalLink className="w-4 h-4 mr-1.5" />
          Fontes Oficiais
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dados-importados" className="mt-4 space-y-4">
        {autoExecData && (
          <Card className={autoExecData.ok ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div className="flex items-center gap-2">
                  <Download className={`w-4 h-4 ${autoExecData.ok ? "text-emerald-600" : "text-red-500"}`} />
                  <span className="text-sm font-medium">Execucao Sefaz/SP — {autoExecData.ano}</span>
                  <Badge variant={autoExecData.ok ? "default" : "destructive"} className={autoExecData.ok ? "bg-emerald-600" : ""}>
                    {autoExecData.ok ? `${autoExecData.precatorios_encontrados} precatorios` : "Indisponivel"}
                  </Badge>
                </div>
                {autoExecData.ok && (
                  <span className="text-xs text-muted-foreground">{autoExecData.total_linhas} linhas</span>
                )}
              </div>
              {autoExecData.ok && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2 bg-muted/40 rounded-md">
                      <p className="text-muted-foreground">SHA-256</p>
                      <p className="font-mono break-all" data-testid="text-auto-exec-sha">{autoExecData.evidence?.csv_sha256}</p>
                    </div>
                    <div className="p-2 bg-muted/40 rounded-md">
                      <p className="text-muted-foreground">Fonte</p>
                      <p className="font-mono break-all text-[10px]">{autoExecData.fonte_url}</p>
                    </div>
                  </div>
                  {autoExecData.precatorios?.map((p: any, i: number) => (
                    <div key={i} className="p-2 bg-muted/30 rounded-md text-xs mb-1" data-testid={`text-prec-exec-${i}`}>
                      <span className="font-medium">{p.desc_projeto}</span>
                      <span className="text-muted-foreground ml-2">Dot. {formatCurrency(p.dotacao_inicial)}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 ml-2">Liq. {formatCurrency(p.valor_liquidado)}</span>
                    </div>
                  ))}
                </>
              )}
              {!autoExecData.ok && autoExecData.note && (
                <p className="text-xs text-red-600 dark:text-red-400">{autoExecData.note}</p>
              )}
            </CardContent>
          </Card>
        )}

        {autoDotData && (
          <Card className={autoDotData.ok ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div className="flex items-center gap-2">
                  <Download className={`w-4 h-4 ${autoDotData.ok ? "text-emerald-600" : "text-red-500"}`} />
                  <span className="text-sm font-medium">Dotacao Sefaz/SP — {autoDotData.ano}</span>
                  <Badge variant={autoDotData.ok ? "default" : "destructive"} className={autoDotData.ok ? "bg-emerald-600" : ""}>
                    {autoDotData.ok ? `${autoDotData.precatorios_encontrados} precatorios` : "Indisponivel"}
                  </Badge>
                </div>
                {autoDotData.ok && (
                  <span className="text-xs text-muted-foreground">{autoDotData.total_linhas} linhas</span>
                )}
              </div>
              {autoDotData.ok && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2 bg-muted/40 rounded-md">
                      <p className="text-muted-foreground">SHA-256</p>
                      <p className="font-mono break-all" data-testid="text-auto-dot-sha">{autoDotData.evidence?.csv_sha256}</p>
                    </div>
                    <div className="p-2 bg-muted/40 rounded-md">
                      <p className="text-muted-foreground">Fonte</p>
                      <p className="font-mono break-all text-[10px]">{autoDotData.fonte_url}</p>
                    </div>
                  </div>
                  {autoDotData.precatorios?.map((p: any, i: number) => (
                    <div key={i} className="p-2 bg-muted/30 rounded-md text-xs mb-1" data-testid={`text-prec-dot-${i}`}>
                      <span className="font-medium">{p.desc_projeto}</span>
                      <span className="text-muted-foreground ml-2">Dot. Inicial {formatCurrency(p.dotacao_inicial)}</span>
                    </div>
                  ))}
                </>
              )}
              {!autoDotData.ok && autoDotData.note && (
                <p className="text-xs text-red-600 dark:text-red-400">{autoDotData.note}</p>
              )}
            </CardContent>
          </Card>
        )}

        {!autoExecData && !autoDotData && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Download className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhum dado importado ainda. Use os botoes acima para baixar dados da Sefaz/SP.</p>
          </div>
        )}

        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5" data-testid="toggle-manual-import">
            <Upload className="w-3.5 h-3.5" />
            Importacao Manual (CSV colado)
          </summary>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  LOA SP (Dotacao)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="ORGAO;UO;PROGRAMA;ACAO;DOTACAO_ATUAL&#10;SECRETARIA X;1234;999;ATIVIDADE Y;1.234.567,89"
                  value={loaCsvText}
                  onChange={(e: any) => setLoaCsvText(e.target.value)}
                  className="min-h-[100px] font-mono text-xs"
                  data-testid="textarea-loa-csv"
                />
                <Button
                  onClick={() => loaImportMutation.mutate()}
                  disabled={loaImportMutation.isPending || !loaCsvText.trim()}
                  className="w-full"
                  size="sm"
                  data-testid="button-import-loa"
                >
                  {loaImportMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Importar LOA SP
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  Despesas SP (Execucao)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="ORGAO;UO;FASE;VALOR;DATA&#10;SECRETARIA X;1234;PAGAMENTO;123.456,78;2025-01-10"
                  value={despesasCsvText}
                  onChange={(e: any) => setDespesasCsvText(e.target.value)}
                  className="min-h-[100px] font-mono text-xs"
                  data-testid="textarea-despesas-csv"
                />
                <Button
                  onClick={() => despesasImportMutation.mutate()}
                  disabled={despesasImportMutation.isPending || !despesasCsvText.trim()}
                  className="w-full"
                  size="sm"
                  data-testid="button-import-despesas"
                >
                  {despesasImportMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Importar Despesas SP
                </Button>
              </CardContent>
            </Card>
          </div>
        </details>
      </TabsContent>

      <TabsContent value="fontes" className="mt-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Fontes Oficiais — Estado de Sao Paulo</span>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md">
                <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Camada 1: LOA SP (Dotacao)
                </h4>
                <p className="text-xs text-muted-foreground mb-2">Fonte: Secretaria da Fazenda do Estado de SP</p>
                <div className="space-y-1">
                  <a href="https://portal.fazenda.sp.gov.br/servicos/orcamento/Paginas/loa.aspx" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-loa-sp">
                    <ExternalLink className="w-3 h-3" />
                    portal.fazenda.sp.gov.br - LOA
                  </a>
                  <a href="https://dworcamento.fazenda.sp.gov.br" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-dworcamento">
                    <ExternalLink className="w-3 h-3" />
                    dworcamento.fazenda.sp.gov.br - Dados Abertos
                  </a>
                </div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-md">
                <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <Banknote className="w-3.5 h-3.5" />
                  Camada 2: Execucao (Despesas)
                </h4>
                <p className="text-xs text-muted-foreground mb-2">Fonte: Portal da Transparencia do Estado de SP</p>
                <a href="https://www.transparencia.sp.gov.br/" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-transparencia-sp">
                  <ExternalLink className="w-3 h-3" />
                  transparencia.sp.gov.br
                </a>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <Scale className="w-3.5 h-3.5" />
                  Camada 3: Estoque (TJSP/DEPRE)
                </h4>
                <p className="text-xs text-muted-foreground mb-2">Fonte: Tribunal de Justica do Estado de SP</p>
                <div className="space-y-1">
                  <a href="https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-tjsp-pendentes">
                    <ExternalLink className="w-3 h-3" />
                    TJSP - Lista de Precatorios Pendentes
                  </a>
                  <a href="https://www.tjsp.jus.br/cac/scp/webmenupesquisa.aspx" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-tjsp-pesquisa">
                    <ExternalLink className="w-3 h-3" />
                    TJSP - Menu de Pesquisa
                  </a>
                  <a href="https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx" target="_blank" rel="noopener noreferrer" className="text-xs underline flex items-center gap-1 text-primary" data-testid="link-fonte-tjsp-lista-pagamentos">
                    <ExternalLink className="w-3 h-3" />
                    TJSP - Listas de Pagamento
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
