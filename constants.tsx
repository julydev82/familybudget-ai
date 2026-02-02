
import { Category, FamilyUser } from './types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: 'Alimentación', budget: 500, color: '#10b981', icon: '🛒' },
  { id: '2', name: 'Vivienda', budget: 1200, color: '#3b82f6', icon: '🏠' },
  { id: '3', name: 'Transporte', budget: 200, color: '#f59e0b', icon: '🚗' },
  { id: '4', name: 'Ocio', budget: 150, color: '#8b5cf6', icon: '🎬' },
  { id: '5', name: 'Otros', budget: 100, color: '#64748b', icon: '📦' },
];

export const MOCK_USERS: FamilyUser[] = [
  { id: 'u1', name: 'Adriana', avatar: 'https://picsum.photos/seed/ana/100' },
  { id: 'u2', name: 'Julian', avatar: 'https://picsum.photos/seed/carlos/100' },
];
