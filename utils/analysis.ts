import { Category, Expense } from '../types';
import { addMonths, currentPeriod, periodOf } from './period';

export type CategoryStatus = 'over' | 'ok' | 'watch' | 'insufficient';

export interface CategoryAnalysis {
  category: Category;
  months: { period: string; spent: number; inProgress: boolean }[];
  /** Meses completos usados para el diagnóstico (hasta 3, los más recientes). */
  basisMonths: number;
  average: number;
  overCount: number;
  status: CategoryStatus;
  suggestedBudget: number | null;
}

const roundUpTo = (value: number, step: number) => Math.ceil(value / step) * step;

/**
 * Analiza los últimos 6 periodos (terminando en el periodo activo) por categoría.
 *
 * El diagnóstico usa los últimos 3 meses COMPLETOS (anteriores al mes en curso),
 * sin contar meses anteriores al primer gasto registrado en la app:
 *  - 'over': el promedio supera el presupuesto y se excedió en la mayoría de
 *    esos meses → se sugiere el promedio, redondeado hacia arriba a $1.000.
 *  - 'ok': el promedio está dentro del presupuesto.
 *  - 'watch': el promedio lo supera, pero no de forma constante (un mes
 *    atípico, o solo hay un mes completo de datos).
 *  - 'insufficient': aún no hay meses completos con datos.
 */
export const analyzeCategories = (
  categories: Category[],
  expenses: Expense[],
  activePeriod: string
): CategoryAnalysis[] => {
  const now = currentPeriod();
  const periods = Array.from({ length: 6 }, (_, i) => addMonths(activePeriod, i - 5));

  // Gasto por categoría y periodo.
  const totals = new Map<string, number>();
  let firstPeriod: string | null = null;
  for (const e of expenses) {
    const p = periodOf(new Date(e.date));
    if (!firstPeriod || p < firstPeriod) firstPeriod = p;
    const key = `${e.categoryId}|${p}`;
    totals.set(key, (totals.get(key) || 0) + (e.amount || 0));
  }

  const basisPeriods = periods
    .filter(p => p < now && firstPeriod !== null && p >= firstPeriod)
    .slice(-3);

  return categories.map(category => {
    const spentIn = (p: string) => totals.get(`${category.id}|${p}`) || 0;
    const months = periods.map(p => ({ period: p, spent: spentIn(p), inProgress: p >= now }));

    const basis = basisPeriods.map(spentIn);
    const n = basis.length;
    const average = n > 0 ? basis.reduce((a, b) => a + b, 0) / n : 0;
    const budget = Number(category.budget) || 0;
    const overCount = basis.filter(v => v > budget).length;

    let status: CategoryStatus;
    if (n === 0) status = 'insufficient';
    else if (average <= budget) status = 'ok';
    // "Constante" exige al menos 2 meses completos y excederse en la mayoría.
    else if (n >= 2 && overCount >= Math.ceil((n * 2) / 3)) status = 'over';
    else status = 'watch';

    return {
      category,
      months,
      basisMonths: n,
      average,
      overCount,
      status,
      suggestedBudget: status === 'over' ? roundUpTo(average, 1000) : null,
    };
  });
};
