
import React, { useState } from 'react';
import { Category, PAYMENT_METHODS, PaymentMethod } from '../types';
import { addMonths, currentPeriod, expenseDateFor, periodLabel, periodStart } from '../utils/period';

interface QuickEntryProps {
  categories: Category[];
  activePeriod: string;
  onAddExpense: (expense: { amount: number; description: string; categoryId: string; paymentMethod: PaymentMethod }) => Promise<void>;
  onAddIncome: (income: { amount: number; description: string; period: string }) => Promise<void>;
}

const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 transition-all placeholder:text-slate-400";

const QuickEntry: React.FC<QuickEntryProps> = ({ categories, activePeriod, onAddExpense, onAddIncome }) => {
  const [mode, setMode] = useState<'expense' | 'income'>('expense');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [incomePeriod, setIncomePeriod] = useState(currentPeriod());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('salary');

  // Si las categorías aún no habían cargado al montar, usa la primera disponible.
  const effectiveCategoryId = categories.some(c => c.id === categoryId) ? categoryId : categories[0]?.id || '';
  const isAdvancePeriod = activePeriod > currentPeriod();

  const switchMode = (m: 'expense' | 'income') => {
    setMode(m);
    setError(null);
    setAmount('');
    setDescription(m === 'income' ? 'Sueldo' : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === 'expense') {
        if (!description.trim() || !effectiveCategoryId) {
          setError('Datos incompletos.');
          return;
        }
        await onAddExpense({ amount: value, description: description.trim(), categoryId: effectiveCategoryId, paymentMethod });
        setDescription('');
        setPaymentMethod('salary'); // por defecto, siempre sueldo
      } else {
        if (!incomePeriod) {
          setError('Elige el periodo del sueldo.');
          return;
        }
        await onAddIncome({ amount: value, description: description.trim() || 'Sueldo', period: incomePeriod });
        setDescription('Sueldo');
      }
      setAmount('');
    } catch {
      setError('No se pudo guardar. Verifica tu conexión.');
    } finally {
      setSaving(false);
    }
  };

  const expenseDate = expenseDateFor(activePeriod).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 text-slate-800 mb-8 transition-all">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{mode === 'expense' ? '📝' : '💵'}</span>
          <h3 className="font-bold text-md tracking-tight text-slate-700">
            {mode === 'expense' ? 'Registrar gasto' : 'Registrar sueldo'}
          </h3>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => switchMode('expense')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${mode === 'expense' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            GASTO
          </button>
          <button
            type="button"
            onClick={() => switchMode('income')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${mode === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            SUELDO
          </button>
        </div>
      </div>

      {mode === 'expense' ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Medio de pago">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Pagado con</span>
            {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map(m => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={paymentMethod === m}
                onClick={() => setPaymentMethod(m)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${paymentMethod === m
                  ? (m === 'credit' ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
              >
                {PAYMENT_METHODS[m].icon} {PAYMENT_METHODS[m].label}
              </button>
            ))}
          </div>
          <input type="number" inputMode="numeric" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto (ej: 120000)" className={inputClass} />
          <select value={effectiveCategoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id} className="text-slate-900">{cat.icon} {cat.name}</option>
            ))}
          </select>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="¿En qué?" className={inputClass} />
          <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white font-bold py-4 px-5 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input type="number" inputMode="numeric" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor recibido" className={inputClass} />
          <select value={incomePeriod} onChange={(e) => setIncomePeriod(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`} aria-label="Periodo al que aplica">
            {[-2, -1, 0, 1, 2].map(n => {
              const p = addMonths(currentPeriod(), n);
              return <option key={p} value={p}>Periodo: {periodLabel(p)}</option>;
            })}
          </select>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" className={inputClass} />
          <button type="submit" disabled={saving} className="w-full bg-emerald-600 text-white font-bold py-4 px-5 rounded-2xl shadow-lg hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}

      {mode === 'expense' && isAdvancePeriod && (
        <p className="mt-3 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2">
          Ya recibiste el sueldo de {periodLabel(activePeriod).toLowerCase()}: este gasto quedará con fecha {expenseDate}.
        </p>
      )}
      {mode === 'income' && incomePeriod > currentPeriod() && (
        <p className="mt-3 text-xs font-semibold text-slate-500 px-1">
          Desde que guardes este sueldo, los gastos nuevos quedarán con fecha 1 de {periodStart(incomePeriod).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })} hasta que empiece ese mes.
        </p>
      )}
      {error && <p className="mt-3 text-rose-500 text-[10px] font-black uppercase tracking-widest text-center">{error}</p>}
    </div>
  );
};

export default QuickEntry;
