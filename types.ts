
export interface Category {
  id: string;
  name: string;
  budget: number;
  color: string;
  icon: string;
}

export interface Expense {
  id: string;
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

export type ViewType = 'dashboard' | 'expenses' | 'categories' | 'settings';
