import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  PieChart,
  Pie,
  Cell,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Clock,
  Zap,
  Users,
  ArrowRight,
} from "lucide-react";

const radialData = [
  { name: "AuraLOA", value: 7, fill: "hsl(142 72% 48%)" },
  { name: "Manual", value: 280, fill: "hsl(0 70% 45%)" },
];

const radialConfig = {
  value: { label: "Horas" },
} satisfies ChartConfig;

const donutData = [
  { name: "Economia (AuraLOA)", value: 273, fill: "hsl(142 72% 48%)" },
  { name: "Tempo AuraLOA", value: 7, fill: "hsl(217 91% 50%)" },
];

const donutManualData = [
  { name: "Tempo Manual", value: 280, fill: "hsl(0 70% 45%)" },
  { name: "Restante", value: 0, fill: "transparent" },
];

const donutConfig = {
  value: { label: "Horas" },
} satisfies ChartConfig;

const etapas = [
  { etapa: "Coleta", manual: 120, digital: 3 },
  { etapa: "Cruzamento", manual: 80, digital: 2 },
  { etapa: "Validacao", manual: 40, digital: 1 },
  { etapa: "Evidencia", manual: 24, digital: 0.5 },
  { etapa: "Relatorio", manual: 16, digital: 0.5 },
];

const barConfig = {
  manual: { label: "Manual", color: "hsl(0 70% 45%)" },
  digital: { label: "AuraLOA", color: "hsl(142 72% 48%)" },
} satisfies ChartConfig;

export default function ChartPreview() {
  return (
    <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-bold mb-1">Preview: Graficos Due Diligence</h1>
        <p className="text-sm text-muted-foreground">3 opcoes de visualizacao — escolha a que preferir</p>
      </div>

      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-primary text-primary-foreground">Opcao A</Badge>
            <h2 className="text-sm font-semibold">RadialBar Gauge — Arcos Concentricos</h2>
          </div>
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 flex items-center justify-center">
                  <div className="relative">
                    <ChartContainer config={radialConfig} className="h-[280px] w-[280px]">
                      <RadialBarChart
                        innerRadius="35%"
                        outerRadius="90%"
                        data={radialData}
                        startAngle={180}
                        endAngle={-180}
                        barSize={20}
                      >
                        <PolarAngleAxis type="number" domain={[0, 280]} angleAxisId={0} tick={false} />
                        <RadialBar
                          dataKey="value"
                          cornerRadius={6}
                          background={{ fill: "hsl(var(--muted))" }}
                        />
                      </RadialBarChart>
                    </ChartContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold text-primary">40x</span>
                      <span className="text-[10px] text-muted-foreground">mais rapido</span>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2 flex flex-col justify-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500/80 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Due Diligence Manual</p>
                      <p className="text-xl font-bold text-red-400">280 horas</p>
                      <p className="text-[10px] text-muted-foreground">~35 dias uteis | 2-3 analistas</p>
                    </div>
                  </div>
                  <div className="w-full h-px bg-border" />
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">AuraLOA Digital</p>
                      <p className="text-xl font-bold text-emerald-400">7 horas</p>
                      <p className="text-[10px] text-muted-foreground">~1 dia util | automatizado</p>
                    </div>
                  </div>
                  <div className="w-full h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Economia</p>
                      <p className="text-lg font-bold text-primary">97.5%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Custo salvo</p>
                      <p className="text-lg font-bold text-primary">~R$ 85K</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-primary text-primary-foreground">Opcao B</Badge>
            <h2 className="text-sm font-semibold">Donut Comparativo — Proporcao de Economia</h2>
          </div>
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="relative">
                      <ChartContainer config={donutConfig} className="h-[200px] w-[200px]">
                        <PieChart>
                          <Pie
                            data={donutManualData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={0}
                          >
                            {donutManualData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-red-400">280h</span>
                        <span className="text-[9px] text-muted-foreground">Manual</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight className="w-5 h-5 text-primary" />
                    <span className="text-[10px] font-mono text-primary font-bold">40x</span>
                  </div>

                  <div className="text-center">
                    <div className="relative">
                      <ChartContainer config={donutConfig} className="h-[200px] w-[200px]">
                        <PieChart>
                          <Pie
                            data={donutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={0}
                          >
                            {donutData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-emerald-400">7h</span>
                        <span className="text-[9px] text-muted-foreground">AuraLOA</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2 flex flex-col justify-center gap-3">
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Economia Total</p>
                      <p className="text-3xl font-bold text-emerald-400">273h</p>
                      <p className="text-[10px] text-muted-foreground mt-1">economizadas por due diligence</p>
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tempo</p>
                        <p className="text-lg font-bold text-primary">-97.5%</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Custo</p>
                        <p className="text-lg font-bold text-primary">~R$ 85K</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-primary text-primary-foreground">Opcao C</Badge>
            <h2 className="text-sm font-semibold">Progress Bars Comparativas — Impacto Visual Direto</h2>
          </div>
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs font-medium">Due Diligence Manual</span>
                      </div>
                      <span className="text-sm font-bold text-red-400">280h</span>
                    </div>
                    <div className="h-8 rounded-md bg-muted/50 overflow-hidden relative">
                      <div
                        className="h-full rounded-md bg-gradient-to-r from-red-600 to-red-500"
                        style={{ width: "100%" }}
                      />
                      <div className="absolute inset-0 flex items-center px-3">
                        <span className="text-[10px] font-medium text-white">35 dias uteis — 2-3 analistas — sem cadeia de custodia</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-medium">AuraLOA Digital</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">7h</span>
                    </div>
                    <div className="h-8 rounded-md bg-muted/50 overflow-hidden relative">
                      <div
                        className="h-full rounded-md bg-gradient-to-r from-emerald-600 to-emerald-500"
                        style={{ width: "2.5%" }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 ml-1">1 dia util — automatizado — SHA-256 em cada payload</p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex-1 h-px bg-border" />
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      <span className="text-sm font-bold text-primary">40x mais rapido</span>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <div className="space-y-2">
                    {etapas.map((e) => (
                      <div key={e.etapa} className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground w-[70px] shrink-0 text-right">{e.etapa}</span>
                        <div className="flex-1 flex items-center gap-1">
                          <div className="h-3 rounded-sm bg-red-500/60" style={{ width: `${(e.manual / 120) * 100}%` }} />
                          <span className="text-[9px] font-mono text-red-400/70 shrink-0">{e.manual}h</span>
                        </div>
                        <div className="flex-1 flex items-center gap-1">
                          <div className="h-3 rounded-sm bg-emerald-500/60" style={{ width: `${Math.max((e.digital / 120) * 100, 1)}%` }} />
                          <span className="text-[9px] font-mono text-emerald-400/70 shrink-0">{e.digital}h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2 flex flex-col justify-center gap-3">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Reducao de Tempo</p>
                      <p className="text-4xl font-bold text-primary">97.5%</p>
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Manual</p>
                        <p className="text-lg font-bold text-red-400">R$ 84K</p>
                        <p className="text-[9px] text-muted-foreground">custo total</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">AuraLOA</p>
                        <p className="text-lg font-bold text-emerald-400">R$ 2.1K</p>
                        <p className="text-[9px] text-muted-foreground">custo total</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Economia por DD</p>
                      <p className="text-xl font-bold text-emerald-400">~R$ 82K</p>
                      <p className="text-[9px] text-muted-foreground">baseado em R$ 300/h analista senior</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8 p-4 rounded-md bg-muted/30 border border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          Pagina de preview temporaria — escolha a opcao preferida (A, B ou C) e ela sera aplicada na landing page.
        </p>
      </div>
    </div>
  );
}
