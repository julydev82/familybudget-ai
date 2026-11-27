
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Category, Expense } from '../types';
import { analyzeCategories, CategoryAnalysis } from '../utils/analysis';
import { periodLabel, periodStart } from '../utils/period';

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const shortMonth = (period: string) => {
  const m = periodStart(period).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
  return m.charAt(0).toUpperCase() + m.slice(1);
};

const OVER_COLOR = '#dc2626';
const STATUS_ORDER = { over: 0, watch: 1, ok: 2, insufficient: 3 } as const;

interface Props {
  categories: Category[];
  expenses: Expense[];
  activePeriod: string;
  onApplyBudget: (category: Category, budget: number) => Promise<void>;
}

const CategoryAnalysisView: React.FC<Props> = ({ categories, expenses, activePeriod, onApplyBudget }) => {
  const analysis = useMemo(
    () => analyzeCategories(categories, expenses, activePeriod)
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [categories, expenses, activePeriod]
  );
  const [filter, setFilter] = useState('all');
  // Si la categoría elegida se elimina, vuelve a "todas".
  const selected = filter !== 'all' && categories.some(c => c.id === filter) ? filter : 'all';
  const visible = selected === 'all' ? analysis : analysis.filter(a => a.category.id === selected);
  const overCount = analysis.filter(a => a.status === 'over').length;
  const first = analysis[0]?.months[0]?.period;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Análisis por Categoría</h2>
          <p className="text-slate-400">
            Gasto de los últimos 6 meses{first ? ` (${periodLabel(first)} – ${periodLabel(activePeriod)})` : ''} frente al presupuesto.
          </p>
        </div>
        <label className="flex flex-col gap-1 w-full sm:w-auto">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</span>
          <select
            value={selected}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-64 bg-white border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 cursor-pointer"
          >
            <option value="all">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </label>
      </header>

      {selected === 'all' && overCount > 0 && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-sm font-semibold text-red-700">
          ⚠️ {overCount === 1 ? '1 categoría supera' : `${overCount} categorías superan`} su presupuesto de forma constante.
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${selected === 'all' ? 'lg:grid-cols-2' : ''}`}>
        {visible.map(a => <CategoryCard key={a.category.id} data={a} onApplyBudget={onApplyBudget} />)}
      </div>

      <p className="text-xs text-slate-400 px-1">
        El diagnóstico usa el promedio de los últimos 3 meses completos (el mes en curso no cuenta). Las barras en rojo superan el presupuesto; la línea punteada es el presupuesto actual.
      </p>
    </div>
  );
};

const CategoryCard: React.FC<{ data: CategoryAnalysis; onApplyBudget: Props['onApplyBudget'] }> = ({ data, onApplyBudget }) => {
  const { category, months, status, average, overCount, basisMonths, suggestedBudget } = data;
  const [applying, setApplying] = useState(false);
  const budget = Number(category.budget) || 0;
  const chartData = months.map(m => ({ ...m, label: shortMonth(m.period) }));

  const apply = async () => {
    if (suggestedBudget == null) return;
    if (!confirm(`¿Cambiar el presupuesto de "${category.name}" de ${currency.format(budget)} a ${currency.format(suggestedBudget)}?`)) return;
    setApplying(true);
    try { await onApplyBudget(category, suggestedBudget); } finally { setApplying(false); }
  };

  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><span className="text-xl">{category.icon}</span>{category.name}</h3>
        <span className="text-[10px] font-black text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 whitespace-nowrap">
          Presupuesto {currency.format(budget)}
        </span>
      </div>

      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 600 }} stroke="#94a3b8" tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} axisLine={false} width={56}
              tickFormatter={(v) => `$${compact.format(v)}`} domain={[0, (max: number) => Math.max(max, budget) * 1.1]} />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              formatter={(value: number) => [currency.format(value), 'Gastado']}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload;
                return p ? `${periodLabel(p.period)}${p.inProgress ? ' (en curso)' : ''}` : '';
              }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
            />
            {budget > 0 && <ReferenceLine y={budget} stroke="#475569" strokeDasharray="4 4" />}
            <Bar dataKey="spent" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {chartData.map(m => (
                <Cell key={m.period} fill={m.spent > budget ? OVER_COLOR : category.color} fillOpacity={m.inProgress ? 0.45 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {status === 'over' && suggestedBudget != null && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-700">
          <p className="font-bold">⚠️ Superaste el presupuesto en {overCount} de los últimos {basisMonths} meses.</p>
          <p className="mt-1">
            Gastas en promedio {currency.format(average)}. Te sugerimos ajustar el presupuesto a <strong>{currency.format(suggestedBudget)}</strong>.
          </p>
          <button onClick={apply} disabled={applying} className="mt-3 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50">
            {applying ? 'Aplicando…' : 'Aplicar sugerencia'}
          </button>
        </div>
      )}
      {status === 'ok' && (
        <p className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-500 font-medium">
          ✓ ¡Lo estás haciendo bien en esta categoría! Promedio de {currency.format(average)} frente a {currency.format(budget)} presupuestados.
        </p>
      )}
      {status === 'watch' && (
        <p className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-500 font-medium">
          {basisMonths < 2
            ? `Superaste el presupuesto en el único mes completo registrado (${currency.format(average)}). Aún no es constante; vigila esta categoría.`
            : `Un mes atípico subió el promedio a ${currency.format(average)}. Aún no es constante; vigila esta categoría.`}
        </p>
      )}
      {status === 'insufficient' && (
        <p className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-400 font-medium">
          Aún no hay meses completos para evaluar esta categoría.
        </p>
      )}
    </div>
  );
};

export default CategoryAnalysisView;
