import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Shield,
  Lock,
  Unlock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Hash,
  ExternalLink,
  Loader2,
  ArrowLeft,
  Search,
  Download,
  Eye,
  ClipboardList,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  LogOut,
} from "lucide-react";

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ContratoTecnico() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"contrato" | "dpo" | "regression" | "audit">("contrato");
  const [lockBy, setLockBy] = useState("");
  const [lockReason, setLockReason] = useState("");

  const contratoQuery = useQuery<any>({
    queryKey: ["/api/loa/uniao/contrato-tecnico"],
  });

  const locksQuery = useQuery<any>({
    queryKey: ["/api/loa/uniao/dpo/locks"],
  });

  const auditQuery = useQuery<any>({
    queryKey: ["/api/loa/uniao/dpo/audit-log"],
    enabled: activeTab === "audit",
  });

  const lockAllMutation = useMutation({
    mutationFn: async (data: { locked_by: string; reason: string }) => {
      const res = await apiRequest("POST", "/api/loa/uniao/dpo/lock-all", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Recursos Travados", description: `${data.locked_resources?.length || 0} recursos protegidos pelo DPO.` });
      queryClient.invalidateQueries({ queryKey: ["/api/loa/uniao/dpo/locks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loa/uniao/dpo/audit-log"] });
    },
  });

  const regressionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loa/uniao/regression/check", { ano_exercicio: 2025 });
      return res.json();
    },
  });

  const baselineMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loa/uniao/regression/baseline", { ano_exercicio: 2025 });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Baseline Salvo", description: "Baseline de metricas salvo para comparacao futura." });
    },
  });

  const contrato = contratoQuery.data;
  const locks = locksQuery.data;
  const audit = auditQuery.data;

  const tabs = [
    { id: "contrato" as const, label: "Contrato Tecnico", icon: FileText },
    { id: "dpo" as const, label: "Controle DPO", icon: Shield },
    { id: "regression" as const, label: "Anti-Regressao", icon: ShieldCheck },
    { id: "audit" as const, label: "Auditoria", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" data-testid="btn-back-home">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Dashboard
          </Button>
        </Link>
        <Link href="/dashboard/pendentes">
          <Button variant="ghost" size="sm" data-testid="btn-goto-pendentes">
            Pendentes
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
        <div className="flex-1" />
        <Badge variant="outline" className="text-xs font-mono" data-testid="badge-schema">
          <Hash className="w-3 h-3 mr-1" />
          Contrato Tecnico Master v1.0
        </Badge>
      </div>

      <h1 className="text-2xl font-bold mb-1" data-testid="page-title">Contrato Tecnico Master - AuraLOA</h1>
      <p className="text-sm text-muted-foreground mb-4">Documentacao tecnica, clausulas de protecao e controle DPO</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="w-4 h-4 mr-1" />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "contrato" && contrato && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {contrato.contrato_tecnico_master?.titulo}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Versao:</span> {contrato.contrato_tecnico_master?.versao}</div>
                <div><span className="text-muted-foreground">Modulo:</span> {contrato.contrato_tecnico_master?.modulo}</div>
                <div><span className="text-muted-foreground">Data:</span> {contrato.contrato_tecnico_master?.data_geracao?.slice(0, 19)}</div>
                <div className="font-mono text-xs"><span className="text-muted-foreground">SHA-256:</span> {contrato.contrato_tecnico_master?.sha256?.slice(0, 24)}...</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                <ShieldAlert className="w-5 h-5" />
                Clausulas Anti-Regressao ({contrato.clausulas_anti_regressao?.regras?.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {contrato.clausulas_anti_regressao?.regras?.map((r: any) => (
                <div key={r.id} className="p-3 border rounded-md text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive" className="text-[10px]">{r.id}</Badge>
                    <span className="font-medium">{r.titulo}</span>
                    <Badge variant="outline" className="text-[10px]">{r.severidade}</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{r.descricao}</p>
                  {r.codigo_referencia && (
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">Codigo: {r.codigo_referencia}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                Clausulas Anti-Alucinacao ({contrato.clausulas_anti_alucinacao?.regras?.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {contrato.clausulas_anti_alucinacao?.regras?.map((r: any) => (
                <div key={r.id} className="p-3 border rounded-md text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-amber-600 text-white text-[10px]">{r.id}</Badge>
                    <span className="font-medium">{r.titulo}</span>
                    <Badge variant="outline" className="text-[10px]">{r.severidade}</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{r.descricao}</p>
                  {r.dominios_aceitos && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.dominios_aceitos.map((d: string) => (
                        <Badge key={d} variant="secondary" className="text-[9px] font-mono">{d}</Badge>
                      ))}
                    </div>
                  )}
                  {r.padroes_bloqueados && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.padroes_bloqueados.map((p: string) => (
                        <Badge key={p} variant="destructive" className="text-[9px]">{p}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Shield className="w-5 h-5" />
                Clausula DPO ({contrato.clausula_dpo?.regras?.length} regras)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {contrato.clausula_dpo?.regras?.map((r: any) => (
                <div key={r.id} className="p-3 border rounded-md text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-blue-600 text-white text-[10px]">{r.id}</Badge>
                    <span className="font-medium">{r.titulo}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">{r.descricao}</p>
                  {r.endpoint && <p className="text-[10px] font-mono mt-1">{r.endpoint}</p>}
                </div>
              ))}
              <div className="mt-3">
                <p className="text-xs font-medium mb-2">Recursos Protegidos:</p>
                <div className="flex flex-wrap gap-1">
                  {contrato.clausula_dpo?.recursos_protegidos?.map((r: string) => (
                    <Badge key={r} variant="outline" className="text-[9px] font-mono">{r}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Pipeline Tecnico - 4 Camadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contrato.pipeline_tecnico?.camadas?.map((c: any) => (
                <div key={c.numero} className="p-3 border rounded-md text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="text-[10px]">Camada {c.numero}</Badge>
                    <span className="font-medium">{c.nome}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">{c.descricao}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">Codigo: {c.codigo}</p>
                  {c.fonte_primaria && <p className="text-[10px] font-mono">Fonte: {c.fonte_primaria}</p>}
                  {c.fonte_api && <p className="text-[10px] font-mono">API: {c.fonte_api}</p>}
                  {c.fonte && <p className="text-[10px] font-mono">Fonte: {c.fonte}</p>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Endpoints API ({contrato.endpoints_api?.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <Input
                  placeholder="Pesquisar endpoints..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-sm"
                  data-testid="input-search-endpoints"
                />
              </div>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {contrato.endpoints_api
                  ?.filter((e: any) =>
                    !searchTerm ||
                    e.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    e.descricao.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((e: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-1.5 hover:bg-muted/50 rounded">
                      <Badge variant={e.metodo === "GET" ? "secondary" : "default"} className="text-[9px] w-12 justify-center">
                        {e.metodo}
                      </Badge>
                      <span className="font-mono flex-1">{e.path}</span>
                      <span className="text-muted-foreground">{e.descricao}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Fontes Oficiais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {contrato.urls_fontes_oficiais?.map((u: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-1.5">
                    <Badge variant="outline" className="text-[9px]">{u.tipo}</Badge>
                    <span className="font-medium">{u.nome}</span>
                    <a href={u.url} target="_blank" rel="noopener noreferrer" className="font-mono text-blue-600 hover:underline flex items-center gap-1 truncate flex-1">
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      {u.url}
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "dpo" && (
        <div className="space-y-4">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Controle DPO - Trava de Recursos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
                <p className="font-medium mb-1">Travar todos os recursos do pipeline</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Ao travar, nenhuma alteracao podera ser feita nos componentes protegidos sem o token de autorizacao DPO.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    placeholder="Nome do DPO"
                    value={lockBy}
                    onChange={(e) => setLockBy(e.target.value)}
                    className="w-48 text-sm"
                    data-testid="input-dpo-name"
                  />
                  <Input
                    placeholder="Motivo da trava"
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    className="flex-1 text-sm"
                    data-testid="input-dpo-reason"
                  />
                  <Button
                    onClick={() => {
                      if (!lockBy || !lockReason) {
                        toast({ title: "Erro", description: "Preencha nome e motivo.", variant: "destructive" });
                        return;
                      }
                      lockAllMutation.mutate({ locked_by: lockBy, reason: lockReason });
                    }}
                    disabled={lockAllMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="btn-lock-all"
                  >
                    {lockAllMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
                    Travar Tudo
                  </Button>
                </div>
              </div>

              {lockAllMutation.data && lockAllMutation.data.tokens && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 rounded-md">
                  <p className="text-sm font-bold text-yellow-800 dark:text-yellow-300 mb-2">
                    TOKENS DE DESBLOQUEIO (guarde em local seguro!)
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {Object.entries(lockAllMutation.data.tokens).map(([resource, token]: [string, any]) => (
                      <div key={resource} className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="text-muted-foreground">{resource}:</span>
                        <span className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded select-all">{token}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Status dos Locks ({locks?.total_locked || 0}/{locks?.total_resources || 0})</p>
                <div className="space-y-1">
                  {locks?.locks?.map((l: any) => (
                    <div key={l.lock_id} className="flex items-center gap-2 text-xs p-2 border rounded">
                      {l.status === "LOCKED" ? (
                        <Lock className="w-3.5 h-3.5 text-red-500" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 text-green-500" />
                      )}
                      <span className="font-mono flex-1">{l.resource}</span>
                      <Badge variant={l.status === "LOCKED" ? "destructive" : "secondary"} className="text-[9px]">
                        {l.status}
                      </Badge>
                      <span className="text-muted-foreground">{l.locked_by}</span>
                      <span className="text-muted-foreground">{l.locked_at_iso?.slice(0, 16)}</span>
                    </div>
                  ))}
                  {(!locks?.locks || locks.locks.length === 0) && (
                    <p className="text-xs text-muted-foreground p-3 text-center">Nenhum lock ativo. Recursos desprotegidos.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "regression" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                Verificacao Anti-Regressao
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => regressionMutation.mutate()}
                  disabled={regressionMutation.isPending}
                  data-testid="btn-check-regression"
                >
                  {regressionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Executar Verificacao
                </Button>
                <Button
                  variant="outline"
                  onClick={() => baselineMutation.mutate()}
                  disabled={baselineMutation.isPending}
                  data-testid="btn-save-baseline"
                >
                  {baselineMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
                  Salvar Baseline
                </Button>
              </div>

              {regressionMutation.data && (
                <div className={`p-4 rounded-md border ${regressionMutation.data.passed ? "bg-green-50 dark:bg-green-950/30 border-green-200" : "bg-red-50 dark:bg-red-950/30 border-red-200"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {regressionMutation.data.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="font-medium">{regressionMutation.data.passed ? "Sem Regressao Detectada" : "REGRESSAO DETECTADA"}</span>
                  </div>

                  {regressionMutation.data.violations?.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {regressionMutation.data.violations.map((v: any, i: number) => (
                        <div key={i} className="p-2 bg-white dark:bg-background rounded border text-xs">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="text-[9px]">{v.severity}</Badge>
                            <span className="font-medium">{v.metric}</span>
                          </div>
                          <p className="text-muted-foreground mt-1">{v.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {regressionMutation.data.warnings?.length > 0 && (
                    <div className="mt-2">
                      {regressionMutation.data.warnings.map((w: string, i: number) => (
                        <p key={i} className="text-xs text-amber-600">{w}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Log de Auditoria DPO ({audit?.total || 0} entradas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {audit?.entries?.map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 border rounded">
                    <Badge
                      variant={e.action === "MODIFICATION_BLOCKED" ? "destructive" : e.action === "LOCK" ? "default" : "secondary"}
                      className="text-[9px] w-32 justify-center"
                    >
                      {e.action}
                    </Badge>
                    <span className="font-mono text-muted-foreground">{e.resource}</span>
                    <span className="flex-1 text-muted-foreground">{e.details}</span>
                    <span className="text-muted-foreground">{e.actor}</span>
                    <span className="text-muted-foreground">{e.timestamp_iso?.slice(0, 16)}</span>
                  </div>
                ))}
                {(!audit?.entries || audit.entries.length === 0) && (
                  <p className="text-xs text-muted-foreground p-3 text-center">Nenhuma entrada de auditoria registrada.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
