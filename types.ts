
export interface Category {
  id: string;
  name: string;
  budget: number;
  color: string;
  icon: string;
}

export type PaymentMethod = 'salary' | 'credit';

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; icon: string }> = {
  salary: { label: 'Sueldo', icon: '💵' },
  credit: { label: 'Tarjeta de crédito', icon: '💳' },
};

export interface Expense {
  id: string;
  /** Con qué se pagó. Los gastos anteriores a este campo se consideran 'salary'. */
  paymentMethod?: PaymentMethod;
  categoryId: string;
  amount: number;
  date: string; // ISO string
  description: string;
  userId: string;
  userName: string;
}

export interface FamilyUser {
  id: string;
  name: string;
  avatar: string;
}

export type ViewType = 'dashboard' | 'expenses' | 'categories' | 'analysis' | 'settings';

export interface Income {
  id: string;
  amount: number;
  period: string; // 'YYYY-MM'
  description: string;
  userId: string;
  userName: string;
  createdAt: string; // ISO string
}
