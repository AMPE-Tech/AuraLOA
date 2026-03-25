import { DashboardKPIs, formatarValor } from "../../types/dashboard";
import { TrendingUp, FileSearch, CheckCircle, AlertTriangle, XCircle, Briefcase, DollarSign } from "lucide-react";

interface Props {
  kpis: DashboardKPIs;
}

interface CardProps {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  icone: React.ReactNode;
  corFundo: string;
  corIcone: string;
}

function KPICard({ titulo, valor, subtitulo, icone, corFundo, corIcone }: CardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{titulo}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{valor}</p>
          {subtitulo && <p className="text-xs text-gray-400 mt-1">{subtitulo}</p>}
        </div>
        <div className={`${corFundo} p-2.5 rounded-lg`}>
          <div className={corIcone}>{icone}</div>
        </div>
      </div>
    </div>
  );
}

export function KPICards({ kpis }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          titulo="Total Pesquisado"
          valor={kpis.total_pesquisado}
          subtitulo="precatórios consultados"
          icone={<FileSearch size={18} />}
          corFundo="bg-slate-50"
          corIcone="text-slate-600"
        />
        <KPICard
          titulo="Aprovados"
          valor={kpis.total_aprovado}
          subtitulo={`${kpis.taxa_aprovacao}% do total`}
          icone={<CheckCircle size={18} />}
          corFundo="bg-green-50"
          corIcone="text-green-600"
        />
        <KPICard
          titulo="Verificar"
          valor={kpis.total_verificar}
          subtitulo="requerem atenção"
          icone={<AlertTriangle size={18} />}
          corFundo="bg-yellow-50"
          corIcone="text-yellow-600"
        />
        <KPICard
          titulo="Suspeitos"
          valor={kpis.total_suspeito}
          subtitulo="bloqueados"
          icone={<XCircle size={18} />}
          corFundo="bg-red-50"
          corIcone="text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          titulo="Valor Total Pesquisado"
          valor={formatarValor(kpis.valor_total_pesquisado)}
          subtitulo="face dos precatórios"
          icone={<DollarSign size={18} />}
          corFundo="bg-blue-50"
          corIcone="text-blue-600"
        />
        <KPICard
          titulo="Em Negociação"
          valor={formatarValor(kpis.valor_total_negociacao)}
          subtitulo={`${kpis.total_proposta} com proposta ativa`}
          icone={<Briefcase size={18} />}
          corFundo="bg-purple-50"
          corIcone="text-purple-600"
        />
        <KPICard
          titulo="Negócios Fechados"
          valor={formatarValor(kpis.valor_total_fechado)}
          subtitulo={`${kpis.total_fechado} contratos — ${kpis.taxa_conversao}% conversão`}
          icone={<TrendingUp size={18} />}
          corFundo="bg-emerald-50"
          corIcone="text-emerald-600"
        />
      </div>
    </div>
  );
}
