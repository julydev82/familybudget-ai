
import React, { useState } from 'react';
import { parseExpenseWithAI } from '../services/geminiService';
import { Category, FamilyUser } from '../types';

interface QuickEntryProps {
  categories: Category[];
  currentUser: FamilyUser;
  onAddExpense: (expense: { amount: number; description: string; categoryId: string }) => void;
}

const QuickEntry: React.FC<QuickEntryProps> = ({ categories, currentUser, onAddExpense }) => {
  const [mode, setMode] = useState<'smart' | 'manual'>('smart');
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [manualAmount, setManualAmount] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCategoryId, setManualCategoryId] = useState(categories[0]?.id || '');

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await parseExpenseWithAI(text, categories);
      if (result && result.amount) {
        let categoryId = categories[0].id;
        if (result.categoryName) {
          const match = categories.find(c => c.name.toLowerCase().includes(result.categoryName.toLowerCase()));
          if (match) categoryId = match.id;
        }

        onAddExpense({
          amount: result.amount,
          description: result.description,
          categoryId
        });
        setText('');
      } else {
        setError('No pude entender el gasto. Intenta algo como: "Gasté 50.000 en supermercado"');
      }
    } catch (err) {
      setError('Error al procesar con IA. Verifica tu conexión.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(manualAmount);
    if (isNaN(amount) || !manualDescription.trim() || !manualCategoryId) {
      setError('Datos incompletos.');
      return;
    }

    onAddExpense({
      amount,
      description: manualDescription,
      categoryId: manualCategoryId
    });

    setManualAmount('');
    setManualDescription('');
    setError(null);
  };

  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 text-slate-800 mb-8 transition-all">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">{mode === 'smart' ? '✨' : '📝'}</span>
          <h3 className="font-bold text-md tracking-tight text-slate-700">
            {mode === 'smart' ? 'Asistente IA' : 'Entrada Directa'}
          </h3>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            onClick={() => { setMode('smart'); setError(null); }}
            className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${mode === 'smart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            SMART
          </button>
          <button
            onClick={() => { setMode('manual'); setError(null); }}
            className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${mode === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            MANUAL
          </button>
        </div>
      </div>

      {mode === 'smart' ? (
        <form onSubmit={handleAISubmit} className="relative group">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Ej: "Hoy gasté 35.000 en el almuerzo"'
            className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 px-6 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400 text-slate-800 transition-all font-medium"
            disabled={isProcessing}
          />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white font-bold px-8 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 active:scale-95"
            disabled={isProcessing || !text.trim()}
          >
            {isProcessing ? '...' : 'Imputar'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="number"
            step="1"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            placeholder="Monto (ej: 120.000)"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 transition-all placeholder:text-slate-400"
          />
          <select
            value={manualCategoryId}
            onChange={(e) => setManualCategoryId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 appearance-none cursor-pointer"
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id} className="text-slate-900">{cat.icon} {cat.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={manualDescription}
            onChange={(e) => setManualDescription(e.target.value)}
            placeholder="¿En qué?"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 transition-all placeholder:text-slate-400"
          />
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white font-bold py-4 px-5 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
          >
            Guardar
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-rose-500 text-[10px] font-black uppercase tracking-widest text-center">{error}</p>}
    </div>
  );
};

export default QuickEntry;
