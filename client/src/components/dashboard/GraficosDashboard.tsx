import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, FunnelChart, Funnel, LabelList
} from "recharts";
import {
  GraficoMensal, GraficoTribunal, GraficoStatus,
  FunilEtapa, formatarValor
} from "../../types/dashboard";

interface Props {
  graficoMensal: GraficoMensal[];
  graficoTribunal: GraficoTribunal[];
  graficoStatus: GraficoStatus[];
  funil: FunilEtapa[];
}

function formatarValorAbrev(valor: number): string {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toFixed(0)}K`;
  return `R$ ${valor}`;
}

export function GraficosDashboard({ graficoMensal, graficoTribunal, graficoStatus, funil }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Gráfico 1 — Evolução mensal */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolução de Consultas por Mês</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={graficoMensal}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="pesquisado" stroke="#64748b" strokeWidth={2} name="Pesquisado" dot={false} />
            <Line type="monotone" dataKey="aprovado" stroke="#22c55e" strokeWidth={2} name="Aprovado" dot={false} />
            <Line type="monotone" dataKey="fechado" stroke="#10b981" strokeWidth={2} name="Fechado" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico 2 — Distribuição por status */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuição por Status</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={graficoStatus}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {graficoStatus.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value} precatórios`, ""]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico 3 — Valor por tribunal */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Valor por Tribunal</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={graficoTribunal} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tickFormatter={formatarValorAbrev} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="tribunal" tick={{ fontSize: 11 }} width={50} />
            <Tooltip formatter={(value: number) => [formatarValor(value), "Valor Total"]} />
            <Bar dataKey="valor_total" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Valor Total" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico 4 — Funil de conversão */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Funil de Conversão</h3>
        <div className="space-y-2 mt-2">
          {funil.map((etapa, index) => {
            const maxQtd = funil[0]?.quantidade || 1;
            const pct = maxQtd > 0 ? Math.round((etapa.quantidade / maxQtd) * 100) : 0;
            return (
              <div key={etapa.id} className="flex items-center gap-3">
                <div className="w-28 text-xs text-gray-500 text-right shrink-0">{etapa.label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                    style={{ width: `${Math.max(pct, 5)}%`, backgroundColor: etapa.cor }}
                  >
                    <span className="text-white text-xs font-medium">{etapa.quantidade}</span>
                  </div>
                </div>
                <div className="w-20 text-xs text-gray-400 shrink-0">{formatarValor(etapa.valor_total)}</div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
