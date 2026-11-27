import { User } from 'firebase/auth';
import { doc, getDoc, getDocs, limit, query, setDoc, writeBatch } from 'firebase/firestore';
import { db, householdRefs, HouseholdId } from '../firebase';
import { Category } from '../types';
import { INITIAL_CATEGORIES } from '../constants';

const templateRef = () => doc(db, 'config', 'categoryTemplate');

/** Normaliza una categoría para que cumpla las reglas de Firestore. */
const cleanCategory = (c: Partial<Category>): Category | null => {
  const id = typeof c.id === 'string' && c.id ? c.id : null;
  const name = typeof c.name === 'string' ? c.name.trim().slice(0, 50) : '';
  if (!id || !name) return null;
  const budget = Number(c.budget);
  return {
    id,
    name,
    budget: Number.isFinite(budget) && budget >= 0 ? budget : 0,
    color: typeof c.color === 'string' && c.color ? c.color : '#64748b',
    icon: typeof c.icon === 'string' && c.icon ? c.icon : '📦',
  };
};

const cleanList = (list: Partial<Category>[]) =>
  list.map(cleanCategory).filter((c): c is Category => c !== null).sort((a, b) => a.id.localeCompare(b.id));

/**
 * Determina el hogar del usuario. Si es una cuenta nueva, le crea su propio
 * hogar y clona la plantilla de categorías. Es idempotente: si un intento
 * anterior quedó a medias, lo completa.
 * Devuelve null para el hogar familiar original (colecciones en la raíz).
 */
export const resolveHousehold = async (user: User): Promise<HouseholdId> => {
  const memberRef = doc(db, 'members', user.uid);
  const member = await getDoc(memberRef);
  const now = new Date().toISOString();

  let householdId: string;
  if (member.exists()) {
    const existing = member.data().householdId as string | undefined;
    if (!existing) return null; // hogar familiar original
    householdId = existing;
  } else {
    // Cuenta nueva: su hogar usa su propio UID como identificador.
    householdId = user.uid;
    await setDoc(memberRef, { householdId, email: user.email ?? '', createdAt: now });
  }

  const householdRef = doc(db, 'households', householdId);
  if (!(await getDoc(householdRef)).exists()) {
    await setDoc(householdRef, { ownerId: user.uid, createdAt: now });
  }

  const refs = householdRefs(householdId);
  const hasCategories = !(await getDocs(query(refs.categories, limit(1)))).empty;
  if (!hasCategories) {
    let template = cleanList(INITIAL_CATEGORIES);
    try {
      const snap = await getDoc(templateRef());
      const fromTemplate = cleanList(snap.exists() ? (snap.data().categories ?? []) : []);
      if (fromTemplate.length > 0) template = fromTemplate;
    } catch (err) {
      console.warn('No se pudo leer la plantilla de categorías; se usan las predeterminadas.', err);
    }
    const batch = writeBatch(db);
    for (const c of template) batch.set(refs.doc('categories', c.id), c);
    await batch.commit();
  }

  return householdId;
};

/**
 * Publica las categorías del hogar familiar como plantilla para las cuentas
 * nuevas. Solo escribe cuando cambiaron.
 */
export const syncCategoryTemplate = async (categories: Category[]) => {
  const clean = cleanList(categories);
  if (clean.length === 0) return;
  const current = await getDoc(templateRef());
  const stored = current.exists() ? cleanList(current.data().categories ?? []) : null;
  if (stored && JSON.stringify(stored) === JSON.stringify(clean)) return;
  await setDoc(templateRef(), { categories: clean, updatedAt: new Date().toISOString() });
};
