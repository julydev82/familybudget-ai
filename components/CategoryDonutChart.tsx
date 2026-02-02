
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CategoryDonutChartProps {
  data: {
    name: string;
    value: number;
    color: string;
    icon: string;
  }[];
}

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
});

const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({ data }) => {
  const total = data.reduce((acc, item) => acc + item.value, 0);

  if (data.length === 0) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-slate-400 bg-white p-6 rounded-3xl border border-slate-100">
        <span className="text-4xl mb-2">🏷️</span>
        <p className="text-xs font-bold uppercase tracking-widest">Sin gastos registrados</p>
      </div>
    );
  }

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="#475569" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-[10px] font-bold"
      >
        {`${name} (${(percent * 100).toFixed(0)}%)`}
      </text>
    );
  };

  return (
    <div className="h-[400px] w-full bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
          Distribución por Categoría (%)
        </h3>
        <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 uppercase tracking-widest">
          Total: {currencyFormatter.format(total)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
            label={renderCustomizedLabel}
            labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [currencyFormatter.format(value), "Gasto"]}
            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
          />
          <Legend 
            verticalAlign="bottom" 
            align="center"
            iconType="circle"
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value, entry: any) => (
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                {entry.payload.icon} {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CategoryDonutChart;
