
import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Expense, Category } from '../types';

const currencyShort = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
});

interface DailyChartProps {
  expenses: Expense[];
  categories: Category[];
}

const DailyChart: React.FC<DailyChartProps> = ({ expenses, categories }) => {
  const chartData = useMemo(() => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const totalBudget = categories.reduce((sum, c) => sum + c.budget, 0);
    const dailyIdeal = totalBudget / daysInMonth;

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    let cumulativeSpending = 0;

    return days.map(day => {
      const dayStart = new Date(today.getFullYear(), today.getMonth(), day);
      const dayEnd = new Date(today.getFullYear(), today.getMonth(), day + 1);
      
      const daySpending = expenses
        .filter(e => {
          const d = new Date(e.date);
          return d >= dayStart && d < dayEnd;
        })
        .reduce((sum, e) => sum + e.amount, 0);
      
      cumulativeSpending += daySpending;
      const isPastOrToday = day <= today.getDate();

      return {
        day: `${day}`,
        gastado: isPastOrToday ? Math.round(cumulativeSpending) : null,
        ideal: Math.round(dailyIdeal * day),
        presupuesto: totalBudget
      };
    });
  }, [expenses, categories]);

  return (
    <div className="h-80 w-full bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <h3 className="text-sm font-bold mb-6 text-slate-700 flex items-center gap-2">
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
        Gasto Acumulado Mensual (COP)
      </h3>
      <ResponsiveContainer width="100%" height="80%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorGastado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="day" 
            tick={{fontSize: 10, fontWeight: 600}} 
            stroke="#94a3b8" 
            interval={2}
          />
          <YAxis 
            tick={{fontSize: 10, fontWeight: 600}} 
            stroke="#94a3b8"
            tickFormatter={(val) => `$${val.toLocaleString('es-CO')}`}
          />
          <Tooltip 
            formatter={(value: number) => [currencyShort.format(value), "Monto"]}
            labelFormatter={(label) => `Día ${label}`}
            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
          />
          <Area 
            type="monotone" 
            dataKey="gastado" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorGastado)" 
            name="Gasto Real"
            animationDuration={1500}
          />
          <Area 
            type="monotone" 
            dataKey="ideal" 
            stroke="#cbd5e1" 
            strokeDasharray="4 4"
            strokeWidth={1.5}
            fill="transparent"
            name="Ideal"
          />
          <ReferenceLine y={chartData[0]?.presupuesto} stroke="#ef4444" strokeDasharray="3 3" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DailyChart;
