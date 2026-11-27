
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  onSnapshot,
  QuerySnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  setDoc,
  where
} from "firebase/firestore";
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { auth, householdRefs, HouseholdId } from './firebase';
import { NEEDS_VERIFICATION, resolveHousehold, syncCategoryTemplate } from './services/household';
import VerifyEmail from './components/VerifyEmail';
import { Category, Expense, FamilyUser, Income, PaymentMethod, ViewType } from './types';
import { activePeriodFrom, addMonths, currentPeriod, expenseDateFor, isInPeriod, periodLabel, periodStart } from './utils/period';
import { INITIAL_CATEGORIES } from './constants';
import DailyChart from './components/DailyChart';
import QuickEntry from './components/QuickEntry';
import CategoryDonutChart from './components/CategoryDonutChart';
import Login from './components/Login';
import CategoryAnalysisView from './components/CategoryAnalysisView';

// Formateador de moneda profesional para Colombia (COP)
const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Meses hacia atrás (además del actual) que se cargan desde Firestore.
const HISTORY_MONTHS = 5;

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('dashboard');
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<FamilyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  // Hogar del usuario: undefined mientras se determina, null = hogar familiar original.
  const [householdId, setHouseholdId] = useState<HouseholdId | undefined>(undefined);
  const [needsVerification, setNeedsVerification] = useState(false);
  // Clave uid + estado de verificación: se vuelve a resolver al verificar el correo.
  const resolvedKey = useRef<string | null>(null);

  useEffect(() => {
    // onIdTokenChanged (y no onAuthStateChanged) para recibir también el nombre
    // que se asigna justo después de registrarse.
    const unsubAuth = onIdTokenChanged(auth, (user) => {
      if (user) {
        setCurrentUser({
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Usuario',
          avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || '')}&background=random`
        });
        const key = `${user.uid}|${user.emailVerified}`;
        if (resolvedKey.current !== key) {
          resolvedKey.current = key;
          setHouseholdId(undefined);
          setNeedsVerification(false);
          setAccessError(null);
          resolveHousehold(user)
            .then(id => {
              if (resolvedKey.current !== key) return;
              if (id === NEEDS_VERIFICATION) setNeedsVerification(true);
              else setHouseholdId(id);
            })
            .catch(err => {
              console.error("Error resolving household:", err);
              if (resolvedKey.current === key) {
                const code = (err as { code?: string })?.code || (err as Error)?.message || 'desconocido';
                setAccessError(`No se pudo preparar tu cuenta (${code}). Cierra sesión y vuelve a entrar para reintentar.`);
              }
            });
        }
      } else {
        resolvedKey.current = null;
        setCurrentUser(null);
        setHouseholdId(undefined);
        setNeedsVerification(false);
        setAccessError(null);
      }
      setAuthLoading(false);
    });
    return () => unsubAuth();
  }, []);

  const refs = useMemo(() => (householdId === undefined ? null : householdRefs(householdId)), [householdId]);

  // Periodo activo: mes actual, o el mes del último sueldo si es adelantado.
  const activePeriod = useMemo(() => activePeriodFrom(incomes.map(i => i.period)), [incomes]);
  // Periodo que se está viendo en el dashboard (por defecto, el activo).
  const viewPeriod = selectedPeriod ?? activePeriod;

  // Historial: del mes en curso hasta el periodo del sueldo, el más reciente primero.
  const historyPeriods = useMemo(() => {
    const list: string[] = [];
    for (let p = currentPeriod(); p <= activePeriod; p = addMonths(p, 1)) list.unshift(p);
    return list;
  }, [activePeriod]);

  const periodExpenses = useMemo(
    () => expenses.filter(e => isInPeriod(e.date, viewPeriod)),
    [expenses, viewPeriod]
  );
  const periodIncomes = useMemo(
    () => incomes.filter(i => i.period === viewPeriod),
    [incomes, viewPeriod]
  );

  const categorySpendingData = useMemo(() => {
    return categories.map(cat => {
      const spent = periodExpenses
        .filter(e => e.categoryId === cat.id)
        .reduce((s, e) => s + e.amount, 0);
      return {
        name: cat.name,
        value: spent,
        color: cat.color,
        icon: cat.icon
      };
    }).filter(c => c.value > 0);
  }, [categories, periodExpenses]);

  useEffect(() => {
    // Limpia los datos del usuario anterior para no mostrarlos a otra cuenta.
    setCategories([]);
    setExpenses([]);
    setIncomes([]);
    setSelectedPeriod(null);
    setLoading(true);
    if (!refs) return;

    const onError = (err: { code?: string }) => {
      console.error("Firestore error:", err);
      setAccessError(err.code === 'permission-denied'
        ? 'Tu cuenta no tiene acceso a estos datos.'
        : 'No se pudieron cargar los datos. Verifica tu conexión.');
      setLoading(false);
    };

    const unsubCats = onSnapshot(refs.categories, async (snapshot: QuerySnapshot) => {
      if (snapshot.empty) {
        for (const cat of INITIAL_CATEGORIES) {
          await setDoc(refs.doc('categories', cat.id), cat);
        }
      } else {
        const cats = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category));
        setCategories(cats);
        // El hogar familiar publica sus categorías como plantilla para cuentas nuevas.
        if (householdId === null) {
          syncCategoryTemplate(cats).catch(err => console.warn("No se pudo actualizar la plantilla:", err));
        }
      }
    }, onError);

    // Solo se descargan los gastos desde hace 5 meses (lo que usan el dashboard
    // y el análisis de 6 meses), no todo el histórico.
    const since = periodStart(addMonths(currentPeriod(), -HISTORY_MONTHS)).toISOString();
    const q = query(refs.expenses, where("date", ">=", since), orderBy("date", "desc"));
    const unsubExps = onSnapshot(q, (snapshot: QuerySnapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
      setLoading(false);
    }, onError);

    const unsubIncomes = onSnapshot(query(refs.incomes, orderBy("period", "desc")), (snapshot: QuerySnapshot) => {
      setIncomes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income)));
    }, onError);

    return () => { unsubCats(); unsubExps(); unsubIncomes(); };
  }, [refs, householdId]);

  const handleAddExpense = async (data: { amount: number; description: string; categoryId: string; paymentMethod: PaymentMethod }) => {
    if (!currentUser || !refs) return;
    await addDoc(refs.expenses, {
      ...data,
      // Si ya se recibió el sueldo de un mes futuro, el gasto queda el día 1 de ese mes.
      date: expenseDateFor(activePeriod).toISOString(),
      userId: currentUser.id,
      userName: currentUser.name
    });
  };

  const handleAddIncome = async (data: { amount: number; description: string; period: string }) => {
    if (!currentUser || !refs) return;
    await addDoc(refs.incomes, {
      ...data,
      createdAt: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name
    });
    setSelectedPeriod(null); // vuelve al periodo activo
  };

  const handleApplyBudget = async (category: Category, budget: number) => {
    try {
      await updateDoc(refs!.doc('categories', category.id), { budget });
    } catch (err) {
      console.error("Error updating budget:", err);
      alert('No se pudo actualizar el presupuesto.');
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!confirm(`¿Eliminar el gasto "${expense.description}" por ${currencyFormatter.format(expense.amount)}?`)) return;
    try {
      await deleteDoc(refs!.doc('expenses', expense.id));
    } catch (err) {
      console.error("Error deleting expense:", err);
      alert('No se pudo eliminar el gasto.');
    }
  };

  const handleDeleteIncome = async (income: Income) => {
    if (!confirm(`¿Eliminar el ingreso "${income.description}" de ${periodLabel(income.period)}?`)) return;
    try {
      await deleteDoc(refs!.doc('incomes', income.id));
    } catch (err) {
      console.error("Error deleting income:", err);
    }
  };

  const handleCategoryAction = async (catData: Partial<Category>, isDelete = false) => {
    try {
      if (isDelete && catData.id) {
        if (confirm(`¿Eliminar la categoría "${catData.name}"?`)) {
          await deleteDoc(refs!.doc('categories', catData.id));
        }
        return;
      }

      if (catData.id) {
        const { id, ...dataToUpdate } = catData as Category;
        await updateDoc(refs!.doc('categories', id), dataToUpdate);
      } else {
        const newId = Math.random().toString(36).substr(2, 9);
        await setDoc(refs!.doc('categories', newId), {
          ...catData,
          id: newId,
          color: catData.color || '#' + Math.floor(Math.random() * 16777215).toString(16)
        });
      }
      setIsAddingCat(false);
      setEditingCategory(null);
    } catch (err) {
      console.error("Error with category action:", err);
    }
  };

  const totalBudget = useMemo(() => categories.reduce((s, c) => s + (Number(c.budget) || 0), 0), [categories]);
  const totalIncome = useMemo(() => periodIncomes.reduce((s, i) => s + (i.amount || 0), 0), [periodIncomes]);
  const totalSpent = useMemo(() => periodExpenses.reduce((s, e) => s + (e.amount || 0), 0), [periodExpenses]);
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  // Lo pagado con tarjeta no sale del sueldo este mes; se muestra aparte.
  const creditSpent = useMemo(
    () => periodExpenses.filter(e => e.paymentMethod === 'credit').reduce((s, e) => s + (e.amount || 0), 0),
    [periodExpenses]
  );
  const salarySpent = totalSpent - creditSpent;
  const balance = totalIncome - salarySpent;
  const percentOfIncome = totalIncome > 0 ? (salarySpent / totalIncome) * 100 : 0;
  const overIncome = totalSpent - totalIncome;

  if (authLoading) return <div className="h-screen flex items-center justify-center font-bold text-indigo-600 animate-pulse text-xl">Cargando...</div>;
  if (!currentUser) return <Login />;
  if (accessError) return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="font-bold text-slate-700 max-w-sm">⚠️ {accessError}</p>
      <button onClick={() => signOut(auth)} className="px-6 py-3 font-bold text-red-500 hover:bg-red-50 rounded-xl">Cerrar Sesión</button>
    </div>
  );
  if (needsVerification) return <VerifyEmail />;
  if (householdId === undefined) return <div className="h-screen flex items-center justify-center font-bold text-indigo-600 animate-pulse text-xl">Preparando tu cuenta...</div>;
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
          <NavItem active={view === 'analysis'} onClick={() => setView('analysis')} icon="📈" label="Análisis" />
          <NavItem active={view === 'categories'} onClick={() => setView('categories')} icon="⚙️" label="Configuración" />
          <NavItem active={view === 'expenses'} onClick={() => setView('expenses')} icon="💸" label="Historial" />
        </div>
        <div className="mt-auto flex flex-col gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-3">
            <img src={currentUser.avatar} className="w-8 h-8 rounded-full ring-2 ring-white" />
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider text-[9px]">Usuario</span>
              <span className="text-sm font-bold truncate">{currentUser.name}</span>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="w-full py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors">Cerrar Sesión</button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 md:p-10 max-w-5xl mx-auto w-full">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-fade-in">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-slate-800">{periodLabel(viewPeriod)} 📅</h2>
                <p className="text-slate-500 font-medium">
                  {viewPeriod === activePeriod
                    ? (activePeriod > currentPeriod() ? 'Periodo adelantado: ya recibiste el sueldo de este mes.' : 'Periodo en curso.')
                    : 'Consultando un periodo diferente al activo.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedPeriod(addMonths(viewPeriod, -1))} disabled={viewPeriod <= addMonths(currentPeriod(), -HISTORY_MONTHS)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30" aria-label="Periodo anterior">‹</button>
                {viewPeriod !== activePeriod && (
                  <button onClick={() => setSelectedPeriod(null)} className="px-3 h-10 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100">Periodo activo</button>
                )}
                <button onClick={() => setSelectedPeriod(addMonths(viewPeriod, 1))} disabled={viewPeriod >= activePeriod} className="w-10 h-10 rounded-xl bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30" aria-label="Periodo siguiente">›</button>
              </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Ingresos" value={currencyFormatter.format(totalIncome)} icon="💵" color="bg-emerald-50 text-emerald-600" />
              <StatCard title="Presupuesto" value={currencyFormatter.format(totalBudget)} icon="💰" color="bg-blue-50 text-blue-600" />
              <StatCard title="Gastado" value={currencyFormatter.format(totalSpent)} icon="📉" color="bg-rose-50 text-rose-600" />
              <StatCard title="Disponible" value={currencyFormatter.format(Math.max(0, totalBudget - totalSpent))} icon="🏦" color="bg-sky-50 text-sky-600" />
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h3 className="font-bold text-slate-700">Ingreso vs Gasto</h3>
                {totalIncome > 0 && (
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${percentOfIncome > 100 ? 'bg-red-100 text-red-600' : percentOfIncome > 80 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {percentOfIncome.toFixed(0)}% DEL SUELDO USADO
                  </span>
                )}
              </div>
              {totalIncome > 0 ? (
                <>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(100, percentOfIncome)}%`, backgroundColor: percentOfIncome > 100 ? '#ef4444' : percentOfIncome > 80 ? '#f59e0b' : '#10b981' }}
                    />
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="text-slate-500 font-medium">
                      💵 {currencyFormatter.format(salarySpent)} pagado con sueldo de {currencyFormatter.format(totalIncome)}
                    </span>
                    <span className={`font-black ${balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {balance < 0 ? 'Déficit del sueldo' : 'Te quedan del sueldo'} {currencyFormatter.format(Math.abs(balance))}
                    </span>
                  </div>
                  {creditSpent > 0 && (
                    <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                      <span className="text-slate-500 font-medium">💳 Pagado con tarjeta de crédito</span>
                      <span className="font-black text-violet-600">{currencyFormatter.format(creditSpent)}</span>
                    </div>
                  )}
                  {overIncome > 0 && (
                    <p className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-700">
                      El gasto total del mes ({currencyFormatter.format(totalSpent)}) supera el ingreso en {currencyFormatter.format(overIncome)}
                      {creditSpent > 0 ? ', cubierto con tarjeta de crédito o ahorros.' : '.'}
                    </p>
                  )}
                  {periodIncomes.length > 1 && (
                    <div className="mt-3 text-xs text-slate-400 font-medium">
                      {periodIncomes.map(i => `${i.userName}: ${currencyFormatter.format(i.amount)}`).join(' · ')}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400 font-medium">Aún no hay sueldo registrado para {periodLabel(viewPeriod).toLowerCase()}. Regístralo en la pestaña SUELDO.</p>
              )}
            </div>

            <QuickEntry categories={categories} activePeriod={activePeriod} onAddExpense={handleAddExpense} onAddIncome={handleAddIncome} />

            <div className="flex flex-col gap-8">
              <DailyChart expenses={periodExpenses} categories={categories} period={viewPeriod} />
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
                  const spent = periodExpenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0);
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

        {view === 'analysis' && (
          <CategoryAnalysisView categories={categories} expenses={expenses} activePeriod={activePeriod} onApplyBudget={handleApplyBudget} />
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
              <h2 className="text-3xl font-bold">Historial</h2>
              <p className="text-slate-400">
                {historyPeriods.length > 1
                  ? `Gastos del mes en curso y del periodo del sueldo (${periodLabel(activePeriod).toLowerCase()}).`
                  : 'Gastos del mes en curso.'}
              </p>
            </header>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-700 mb-4">Ingresos</h3>
              {incomes.length === 0 ? (
                <p className="text-sm text-slate-400">Aún no hay ingresos registrados.</p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {incomes.map(inc => (
                    <li key={inc.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-700 truncate">{inc.description}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Periodo {periodLabel(inc.period)} · Por {inc.userName}</div>
                      </div>
                      <span className="font-bold text-emerald-600">+{currencyFormatter.format(inc.amount)}</span>
                      <button onClick={() => handleDeleteIncome(inc)} className="p-2 text-slate-300 hover:text-red-600 transition-colors" aria-label="Eliminar ingreso">🗑️</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {historyPeriods.map(period => {
              const items = expenses.filter(e => isInPeriod(e.date, period));
              const total = items.reduce((sum, e) => sum + (e.amount || 0), 0);
              return (
                <div key={period} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 flex flex-wrap justify-between items-center gap-2 border-b border-slate-50">
                    <h3 className="font-bold text-slate-700">Gastos de {periodLabel(period).toLowerCase()}</h3>
                    <span className="text-[10px] font-black text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                      {items.length} {items.length === 1 ? 'registro' : 'registros'} · {currencyFormatter.format(total)}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="px-6 py-5 text-sm text-slate-400">Sin gastos registrados en este periodo.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                          <tr>
                            <th className="px-6 py-4">Concepto</th>
                            <th className="px-6 py-4">Categoría</th>
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4 text-right">Monto</th>
                            <th className="px-2 py-4"><span className="sr-only">Acciones</span></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {items.map(exp => {
                            const cat = categories.find(c => c.id === exp.categoryId);
                            return (
                              <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-semibold text-slate-700">{exp.description}</div>
                                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                                    Por {exp.userName}
                                    {exp.paymentMethod === 'credit' && <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 normal-case tracking-normal">💳 Tarjeta</span>}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-50 border border-slate-100 whitespace-nowrap" style={{ color: cat?.color }}>
                                    {cat?.icon} {cat?.name || 'Varios'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-400 font-medium whitespace-nowrap">
                                  {new Date(exp.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                  <span className="font-bold text-slate-700">-{currencyFormatter.format(exp.amount)}</span>
                                </td>
                                <td className="px-2 py-4 text-right">
                                  <button onClick={() => handleDeleteExpense(exp)} className="p-2 text-slate-300 hover:text-red-600 transition-colors" aria-label={`Eliminar gasto ${exp.description}`}>🗑️</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-around p-4 z-50">
        <MobileNavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="📊" />
        <MobileNavItem active={view === 'analysis'} onClick={() => setView('analysis')} icon="📈" />
        <MobileNavItem active={view === 'categories'} onClick={() => setView('categories')} icon="⚙️" />
        <MobileNavItem active={view === 'expenses'} onClick={() => setView('expenses')} icon="💸" />
        <button onClick={() => signOut(auth)} className="p-1 text-red-500">
          🚪
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
