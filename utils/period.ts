// Un "periodo" es un mes de presupuesto con formato 'YYYY-MM'.

export const periodOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const currentPeriod = (): string => periodOf(new Date());

const parse = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return { y, m: m - 1 };
};

export const addMonths = (period: string, n: number): string => {
  const { y, m } = parse(period);
  return periodOf(new Date(y, m + n, 1));
};

export const periodStart = (period: string): Date => {
  const { y, m } = parse(period);
  return new Date(y, m, 1);
};

export const periodEnd = (period: string): Date => {
  const { y, m } = parse(period);
  return new Date(y, m + 1, 1);
};

export const isInPeriod = (isoDate: string, period: string): boolean => {
  const d = new Date(isoDate);
  return d >= periodStart(period) && d < periodEnd(period);
};

export const periodLabel = (period: string): string => {
  const text = periodStart(period).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Periodo activo: el mes más adelantado entre el mes actual y el último
 * periodo con sueldo registrado. Si recibes el sueldo de diciembre el 26 de
 * noviembre, el periodo activo pasa a ser diciembre.
 */
export const activePeriodFrom = (incomePeriods: string[]): string =>
  incomePeriods.reduce((max, p) => (p > max ? p : max), currentPeriod());

/**
 * Fecha con la que se guarda un gasto nuevo: si el periodo activo es un mes
 * futuro, el día 1 de ese mes; si no, la fecha real.
 */
export const expenseDateFor = (activePeriod: string): Date => {
  if (activePeriod > currentPeriod()) {
    const { y, m } = parse(activePeriod);
    return new Date(y, m, 1, 12, 0, 0); // mediodía para evitar saltos por zona horaria
  }
  return new Date();
};
