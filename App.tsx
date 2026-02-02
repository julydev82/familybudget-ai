
import React, { useState, useEffect, useMemo } from 'react';
import { 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  query, 
  orderBy,
  setDoc
} from "firebase/firestore";
import { db, collections } from './firebase';
import { Category, Expense, FamilyUser, ViewType } from './types';
import { INITIAL_CATEGORIES, MOCK_USERS } from './constants';
import DailyChart from './components/DailyChart';
import QuickEntry from './components/QuickEntry';
import CategoryDonutChart from './components/CategoryDonutChart';

// Formateador de moneda profesional para Colombia (COP)
const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('dashboard');
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentUser, setCurrentUser] = useState<FamilyUser>(MOCK_USERS[0]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAddingCat, setIsAddingCat] = useState(false);

  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return expenses.filter(e => new Date(e.date) >= startOfMonth);
  }, [expenses]);

  const categorySpendingData = useMemo(() => {
    return categories.map(cat => {
      const spent = currentMonthExpenses
        .filter(e => e.categoryId === cat.id)
        .reduce((s, e) => s + e.amount, 0);
      return {
        name: cat.name,
        value: spent,
        color: cat.color,
        icon: cat.icon
      };
    }).filter(c => c.value > 0);
  }, [categories, currentMonthExpenses]);

  useEffect(() => {
    const unsubCats = onSnapshot(collections.categories, async (snapshot) => {
      if (snapshot.empty) {
        for (const cat of INITIAL_CATEGORIES) {
          await setDoc(doc(db, "categories", cat.id), cat);
        }
      } else {
        setCategories(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category)));
      }
    });

    const q = query(collections.expenses, orderBy("date", "desc"));
    const unsubExps = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
      setLoading(false);
    });

    return () => { unsubCats(); unsubExps(); };
  }, []);

  const handleAddExpense = async (data: any) => {
    try {
      await addDoc(collections.expenses, {
        ...data,
        date: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name
      });
    } catch (err) {
      console.error("Error adding expense:", err);
    }
  };

  const handleCategoryAction = async (catData: Partial<Category>, isDelete = false) => {
    try {
      if (isDelete && catData.id) {
        if (confirm(`¿Eliminar la categoría "${catData.name}"?`)) {
          await deleteDoc(doc(db, "categories", catData.id));
        }
        return;
      }

      if (catData.id) {
        const { id, ...dataToUpdate } = catData as Category;
        await updateDoc(doc(db, "categories", id), dataToUpdate);
      } else {
        const newId = Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, "categories", newId), { 
          ...catData, 
          id: newId,
          color: catData.color || '#'+Math.floor(Math.random()*16777215).toString(16)
        });
      }
      setIsAddingCat(false);
      setEditingCategory(null);
    } catch (err) {
      console.error("Error with category action:", err);
    }
  };

  const totalBudget = useMemo(() => categories.reduce((s, c) => s + (Number(c.budget) || 0), 0), [categories]);
  const totalSpent = useMemo(() => currentMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0), [currentMonthExpenses]);
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-indigo-600 animate-pulse text-xl">Cargando presupuesto...</div>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row pb-20 md:pb-0">
      <nav className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">F</div>
          <h1 className="text-xl font-bold tracking-tight">FamilyBudget</h1>
        </div>
        <div className="space-y-1">
          <NavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="📊" label="Dashboard" />
          <NavItem active={view === 'categories'} onClick={() => setView('categories')} icon="⚙️" label="Configuración" />
          <NavItem active={view === 'expenses'} onClick={() => setView('expenses')} icon="💸" label="Historial" />
        </div>
        <div className="mt-auto p-4 bg-slate-50 rounded-2xl flex items-center gap-3">
          <img src={currentUser.avatar} className="w-8 h-8 rounded-full ring-2 ring-white" />
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider text-[9px]">Usuario</span>
            <span className="text-sm font-bold truncate">{currentUser.name}</span>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 md:p-10 max-w-5xl mx-auto w-full">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-fade-in">
            <header>
              <h2 className="text-3xl font-bold text-slate-800">Este Mes 📅</h2>
              <p className="text-slate-500 font-medium">Consumo reiniciado para {new Date().toLocaleString('es-CO', { month: 'long' })}.</p>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Presupuesto" value={currencyFormatter.format(totalBudget)} icon="💰" color="bg-blue-50 text-blue-600" />
              <StatCard title="Gastado" value={currencyFormatter.format(totalSpent)} icon="📉" color="bg-rose-50 text-rose-600" />
              <StatCard title="Disponible" value={currencyFormatter.format(Math.max(0, totalBudget - totalSpent))} icon="🏦" color="bg-emerald-50 text-emerald-600" />
            </div>

            <QuickEntry categories={categories} currentUser={currentUser} onAddExpense={handleAddExpense} />
            
            <div className="flex flex-col gap-8">
              <DailyChart expenses={currentMonthExpenses} categories={categories} />
              <CategoryDonutChart data={categorySpendingData} />
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="font-bold mb-6 flex justify-between items-center text-slate-700">
                <span>Estado por Categorías</span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${percentUsed > 100 ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {percentUsed.toFixed(0)}% UTILIZADO
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categories.map(cat => {
                  const spent = currentMonthExpenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0);
                  const perc = cat.budget > 0 ? (spent / cat.budget) * 100 : 0;
                  return (
                    <div key={cat.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-bold flex items-center gap-2 text-slate-800">{cat.icon} {cat.name}</span>
                        <span className="text-[10px] font-black text-slate-500">
                          {currencyFormatter.format(spent)} / {currencyFormatter.format(cat.budget)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-1000 ease-out" 
                          style={{ width: `${Math.min(100, perc)}%`, backgroundColor: perc > 100 ? '#ef4444' : cat.color }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'categories' && (
          <div className="space-y-6 animate-fade-in">
            <header className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold">Configuración</h2>
                <p className="text-slate-400">Administra tus metas mensuales.</p>
              </div>
              <button 
                onClick={() => { setEditingCategory(null); setIsAddingCat(true); }}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
              >
                <span>+</span> Nueva
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map(cat => (
                <div key={cat.id} className="group bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all">
                  <div className="text-3xl p-4 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform">{cat.icon}</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800">{cat.name}</h4>
                    <p className="text-sm text-slate-400 font-medium">Límite: {currencyFormatter.format(cat.budget)}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingCategory(cat); setIsAddingCat(true); }} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">✏️</button>
                    <button onClick={() => handleCategoryAction(cat, true)} className="p-2 text-slate-300 hover:text-red-600 transition-colors">🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            {isAddingCat && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
                  <h3 className="text-2xl font-black mb-6 text-slate-800">{editingCategory ? 'Editar' : 'Nueva'} Categoría</h3>
                  <div className="space-y-4">
                    <input id="cat-name" defaultValue={editingCategory?.name || ''} placeholder="Nombre" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:border-indigo-500 outline-none transition-all font-medium" />
                    <input id="cat-icon" defaultValue={editingCategory?.icon || ''} placeholder="Icono" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:border-indigo-500 outline-none transition-all font-medium" />
                    <input id="cat-budget" type="number" defaultValue={editingCategory?.budget || ''} placeholder="Presupuesto" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:border-indigo-500 outline-none transition-all font-medium" />
                    <div className="flex gap-4 pt-6">
                      <button onClick={() => { setIsAddingCat(false); setEditingCategory(null); }} className="flex-1 py-4 font-bold text-slate-400">Cancelar</button>
                      <button 
                        onClick={() => {
                          const name = (document.getElementById('cat-name') as HTMLInputElement).value;
                          const icon = (document.getElementById('cat-icon') as HTMLInputElement).value;
                          const budget = (document.getElementById('cat-budget') as HTMLInputElement).value;
                          if (name && budget) {
                            handleCategoryAction({ id: editingCategory?.id, name, icon: icon || '📦', budget: Number(budget), color: editingCategory?.color });
                          }
                        }}
                        className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100"
                      >Guardar</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'expenses' && (
          <div className="animate-fade-in space-y-6">
            <header>
              <h2 className="text-3xl font-bold">Historial Completo</h2>
              <p className="text-slate-400">Registro histórico de movimientos.</p>
            </header>
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                    <tr>
                      <th className="px-6 py-5">Concepto</th>
                      <th className="px-6 py-5">Categoría</th>
                      <th className="px-6 py-5">Fecha</th>
                      <th className="px-6 py-5 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {expenses.map(exp => {
                      const cat = categories.find(c => c.id === exp.categoryId);
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-700">{exp.description}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Por {exp.userName}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-50 border border-slate-100" style={{ color: cat?.color }}>
                              {cat?.icon} {cat?.name || 'Varios'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400 font-medium">
                            {new Date(exp.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-slate-700">-{currencyFormatter.format(exp.amount)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-around p-4 z-50">
        <MobileNavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="📊" />
        <MobileNavItem active={view === 'categories'} onClick={() => setView('categories')} icon="⚙️" />
        <MobileNavItem active={view === 'expenses'} onClick={() => setView('expenses')} icon="💸" />
        <button onClick={() => setCurrentUser(prev => prev.id === 'u1' ? MOCK_USERS[1] : MOCK_USERS[0])} className="p-1">
          <img src={currentUser.avatar} className="w-8 h-8 rounded-full ring-2 ring-indigo-100" />
        </button>
      </nav>
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-200 ${active ? 'bg-indigo-600 text-white font-bold shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}>
    <span className="text-xl">{icon}</span><span className="text-sm tracking-tight">{label}</span>
  </button>
);

const MobileNavItem = ({ active, onClick, icon }: any) => (
  <button onClick={onClick} className={`flex items-center justify-center p-3 rounded-2xl transition-all ${active ? 'text-indigo-600 bg-indigo-50 shadow-inner' : 'text-slate-400'}`}>
    <span className="text-2xl">{icon}</span>
  </button>
);

const StatCard = ({ title, value, icon, color }: any) => (
  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-5 transition-all hover:shadow-md">
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${color}`}>{icon}</div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</p>
      <p className="text-2xl font-black text-slate-800 tracking-tighter">{value}</p>
    </div>
  </div>
);

export default App;
