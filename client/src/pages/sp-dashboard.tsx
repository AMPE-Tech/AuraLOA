import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Upload,
  Search,
  Scale,
  Shield,
  Clock,
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

export default function SpDashboard() {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState("2025");
  const [activeTab, setActiveTab] = useState("importar");

  const [loaCsvText, setLoaCsvText] = useState("");
  const [despesasCsvText, setDespesasCsvText] = useState("");
  const [tjspEntidade, setTjspEntidade] = useState("FAZENDA DO ESTADO DE SAO PAULO");

  const [a2Orgao, setA2Orgao] = useState("");
  const [a2Uo, setA2Uo] = useState("");

  const years = ["2026", "2025", "2024", "2023", "2022"];

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

  const tjspPendentesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sp/tjsp/pendentes?entidade=${encodeURIComponent(tjspEntidade)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
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
    onError: (err: any) => {
      toast({ title: "Erro A2 SP", description: err?.message || "Falha na conciliacao.", variant: "destructive" });
    },
  });

  const a2Result = a2Mutation.data as SpA2Result | undefined;
  const tjspPendentesResult = tjspPendentesMutation.data as SpTjspResult | undefined;
  const tjspPagamentosResult = tjspPagamentosMutation.data as SpTjspResult | undefined;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-voltar-dashboard">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Dashboard Uniao
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-6" />
              <div className="p-2 rounded-md bg-amber-500/10">
                <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight" data-testid="text-sp-title">
                  Precatorios LOA - Estado de Sao Paulo
                </h1>
                <p className="text-xs text-muted-foreground">
                  Modulo SP: LOA Sefaz + Execucao Transparencia SP + Estoque TJSP/DEPRE
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/contrato">
                <Button variant="outline" size="sm" data-testid="link-contrato-sp">
                  <Shield className="w-3.5 h-3.5 mr-1" />
                  Contrato DPO
                </Button>
              </Link>
              <Badge variant="outline" className="text-[10px] font-mono border-amber-400 text-amber-700 dark:text-amber-400">
                MVP SP - Ente Estado
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {statusQuery.data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover-elevate">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">LOA SP Importada</p>
                    <p className="text-xl font-semibold" data-testid="kpi-loa-sp-count">
                      {statusQuery.data.dados_importados?.loa?.total_registros ?? 0} registros
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Anos: {(statusQuery.data.dados_importados?.loa?.anos ?? []).join(", ") || "Nenhum"}
                    </p>
                  </div>
                  <div className="p-2 rounded-md bg-primary/10">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Despesas SP Importadas</p>
                    <p className="text-xl font-semibold" data-testid="kpi-despesas-sp-count">
                      {statusQuery.data.dados_importados?.despesas?.total_registros ?? 0} registros
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Anos: {(statusQuery.data.dados_importados?.despesas?.anos ?? []).join(", ") || "Nenhum"}
                    </p>
                  </div>
                  <div className="p-2 rounded-md bg-primary/10">
                    <Banknote className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Status Modulo</p>
                    <p className="text-xl font-semibold" data-testid="kpi-sp-status">
                      {statusQuery.data.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ente: {statusQuery.data.ente}
                    </p>
                  </div>
                  <div className="p-2 rounded-md bg-emerald-500/10">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="importar" data-testid="tab-importar">
              <Upload className="w-3.5 h-3.5 mr-1" />
              Importar Dados
            </TabsTrigger>
            <TabsTrigger value="tjsp" data-testid="tab-tjsp">
              <Scale className="w-3.5 h-3.5 mr-1" />
              Estoque TJSP
            </TabsTrigger>
            <TabsTrigger value="conciliacao" data-testid="tab-conciliacao">
              <BarChart3 className="w-3.5 h-3.5 mr-1" />
              Conciliacao A2
            </TabsTrigger>
            <TabsTrigger value="fontes" data-testid="tab-fontes">
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              Fontes Oficiais
            </TabsTrigger>
          </TabsList>

          <TabsContent value="importar" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    LOA SP (Dotacao - Sefaz/SP)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                    <p className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Cole o CSV da LOA SP (Sefaz). Colunas esperadas: ORGAO, UO, PROGRAMA, ACAO, DOTACAO_INICIAL, DOTACAO_ATUAL. Delimitador padrao: ponto-e-virgula (;).
                    </p>
                  </div>
                  <Textarea
                    placeholder="ORGAO;UO;PROGRAMA;ACAO;DOTACAO_ATUAL&#10;SECRETARIA X;1234;999;ATIVIDADE Y;1.234.567,89"
                    value={loaCsvText}
                    onChange={(e) => setLoaCsvText(e.target.value)}
                    className="min-h-[120px] font-mono text-xs"
                    data-testid="textarea-loa-csv"
                  />
                  <Button
                    onClick={() => loaImportMutation.mutate()}
                    disabled={loaImportMutation.isPending || !loaCsvText.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-import-loa"
                  >
                    {loaImportMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Importar LOA SP ({selectedYear})
                  </Button>
                  {loaImportMutation.data && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-md">
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {(loaImportMutation.data as SpImportResult).imported} linhas importadas
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        <Hash className="w-3 h-3 inline mr-1" />
                        {(loaImportMutation.data as SpImportResult).evidence.bundle_sha256?.slice(0, 24)}...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Banknote className="w-4 h-4" />
                    Despesas SP (Execucao - Portal Transparencia)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                    <p className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Cole o CSV de despesas do Portal da Transparencia SP. Colunas esperadas: ORGAO, UO, FASE, VALOR, FAVORECIDO, DATA. Delimitador padrao: ponto-e-virgula (;).
                    </p>
                  </div>
                  <Textarea
                    placeholder="ORGAO;UO;FASE;VALOR;DATA&#10;SECRETARIA X;1234;PAGAMENTO;123.456,78;2025-01-10"
                    value={despesasCsvText}
                    onChange={(e) => setDespesasCsvText(e.target.value)}
                    className="min-h-[120px] font-mono text-xs"
                    data-testid="textarea-despesas-csv"
                  />
                  <Button
                    onClick={() => despesasImportMutation.mutate()}
                    disabled={despesasImportMutation.isPending || !despesasCsvText.trim()}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-import-despesas"
                  >
                    {despesasImportMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Importar Despesas SP ({selectedYear})
                  </Button>
                  {despesasImportMutation.data && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-md">
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {(despesasImportMutation.data as SpImportResult).imported} linhas importadas
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        <Hash className="w-3 h-3 inline mr-1" />
                        {(despesasImportMutation.data as SpImportResult).evidence.bundle_sha256?.slice(0, 24)}...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tjsp" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  Consulta TJSP - Precatorios Pendentes/Pagamentos (DEPRE)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                  <p className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    MVP best-effort: captura HTML da pagina do TJSP e tenta mapear tabelas. Algumas paginas exigem selecao de entidade via formulario POST (Patch 2).
                  </p>
                </div>

                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-[250px]">
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                      Entidade (texto exato TJSP)
                    </label>
                    <Input
                      value={tjspEntidade}
                      onChange={(e) => setTjspEntidade(e.target.value)}
                      placeholder="FAZENDA DO ESTADO DE SAO PAULO"
                      className="font-mono text-xs"
                      data-testid="input-entidade-tjsp"
                    />
                  </div>
                  <Button
                    onClick={() => tjspPendentesMutation.mutate()}
                    disabled={tjspPendentesMutation.isPending || !tjspEntidade.trim()}
                    variant="default"
                    data-testid="button-tjsp-pendentes"
                  >
                    {tjspPendentesMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Pendentes
                  </Button>
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

                {tjspPendentesResult && (
                  <Card className="border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Scale className="w-4 h-4 text-blue-600" />
                          Resultado Pendentes TJSP
                        </h3>
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
                        <p className="text-xs text-muted-foreground italic">Nenhum item extraido. A pagina pode exigir formulario POST por entidade (Patch 2).</p>
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
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-green-600" />
                          Resultado Pagamentos TJSP
                        </h3>
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
                        <p className="text-xs text-muted-foreground italic">Nenhum item extraido. A pagina pode exigir formulario POST por entidade (Patch 2).</p>
                      )}
                      <p className="text-[10px] font-mono text-muted-foreground mt-2">
                        <Hash className="w-3 h-3 inline mr-1" />
                        {tjspPagamentosResult.evidence?.bundle_sha256?.slice(0, 24)}...
                      </p>
                    </CardContent>
                  </Card>
                )}

                {(tjspPendentesResult || tjspPagamentosResult) && (
                  <div className="p-3 bg-muted/30 rounded-md">
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
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conciliacao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Conciliacao A2 - Estado de Sao Paulo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted/30 rounded-md">
                  <p className="text-xs text-muted-foreground">
                    Cruza LOA SP (dotacao) x Despesas SP (execucao) para o ano selecionado. Filtros opcionais por Orgao e UO.
                  </p>
                </div>
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="min-w-[180px]">
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Orgao (opcional)</label>
                    <Input
                      value={a2Orgao}
                      onChange={(e) => setA2Orgao(e.target.value)}
                      placeholder="Ex: SECRETARIA X"
                      className="text-xs"
                      data-testid="input-a2-orgao"
                    />
                  </div>
                  <div className="min-w-[140px]">
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">UO (opcional)</label>
                    <Input
                      value={a2Uo}
                      onChange={(e) => setA2Uo(e.target.value)}
                      placeholder="Ex: 1234"
                      className="text-xs"
                      data-testid="input-a2-uo"
                    />
                  </div>
                  <Button
                    onClick={() => a2Mutation.mutate()}
                    disabled={a2Mutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    data-testid="button-a2-sp"
                  >
                    {a2Mutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <BarChart3 className="w-4 h-4 mr-2" />
                    )}
                    Conciliar A2 SP ({selectedYear})
                  </Button>
                </div>

                {a2Result && (
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Card className="border-blue-200 dark:border-blue-800">
                        <CardContent className="p-4 text-center">
                          <p className="text-xs text-muted-foreground">Dotacao Atual Total</p>
                          <p className="text-lg font-bold text-blue-600" data-testid="a2-dotacao-total">
                            {formatCurrency(a2Result.summary.dotacao_atual_total)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{a2Result.loa_count} registros LOA</p>
                        </CardContent>
                      </Card>
                      <Card className="border-green-200 dark:border-green-800">
                        <CardContent className="p-4 text-center">
                          <p className="text-xs text-muted-foreground">Execucao Total</p>
                          <p className="text-lg font-bold text-green-600" data-testid="a2-execucao-total">
                            {formatCurrency(a2Result.summary.execucao_total)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{a2Result.despesas_count} despesas</p>
                        </CardContent>
                      </Card>
                      <Card className="border-amber-200 dark:border-amber-800">
                        <CardContent className="p-4 text-center">
                          <p className="text-xs text-muted-foreground">Saldo Estimado</p>
                          <p className={`text-lg font-bold ${a2Result.summary.saldo_estimado >= 0 ? "text-emerald-600" : "text-red-600"}`} data-testid="a2-saldo">
                            {formatCurrency(a2Result.summary.saldo_estimado)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Dotacao - Execucao</p>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-md">
                      <p className="text-xs text-muted-foreground italic">{a2Result.summary.note}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fontes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Fontes Oficiais - Estado de Sao Paulo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md">
                    <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      Camada 1: LOA SP (Dotacao)
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2">Fonte: Secretaria da Fazenda do Estado de SP</p>
                    <a
                      href="https://portal.fazenda.sp.gov.br/servicos/orcamento/Paginas/loa.aspx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline flex items-center gap-1 text-primary"
                      data-testid="link-fonte-loa-sp"
                    >
                      <ExternalLink className="w-3 h-3" />
                      portal.fazenda.sp.gov.br - LOA Atual e Anos Anteriores
                    </a>
                  </div>

                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-md">
                    <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                      <Banknote className="w-3.5 h-3.5" />
                      Camada 2: Execucao (Despesas)
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2">Fonte: Portal da Transparencia do Estado de SP</p>
                    <a
                      href="https://www.transparencia.sp.gov.br/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline flex items-center gap-1 text-primary"
                      data-testid="link-fonte-transparencia-sp"
                    >
                      <ExternalLink className="w-3 h-3" />
                      transparencia.sp.gov.br - Portal da Transparencia
                    </a>
                  </div>

                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                    <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                      <Scale className="w-3.5 h-3.5" />
                      Camada 3: Estoque (TJSP/DEPRE)
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2">Fonte: Tribunal de Justica do Estado de SP</p>
                    <div className="space-y-1">
                      <a
                        href="https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline flex items-center gap-1 text-primary"
                        data-testid="link-fonte-tjsp-pendentes"
                      >
                        <ExternalLink className="w-3 h-3" />
                        TJSP - Lista de Precatorios Pendentes
                      </a>
                      <a
                        href="https://www.tjsp.jus.br/cac/scp/webmenupesquisa.aspx"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline flex items-center gap-1 text-primary"
                        data-testid="link-fonte-tjsp-pesquisa"
                      >
                        <ExternalLink className="w-3 h-3" />
                        TJSP - Menu de Pesquisa de Precatorios
                      </a>
                      <a
                        href="https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline flex items-center gap-1 text-primary"
                        data-testid="link-fonte-tjsp-lista-pagamentos"
                      >
                        <ExternalLink className="w-3 h-3" />
                        TJSP - Publicacao de Listas de Pagamento
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
