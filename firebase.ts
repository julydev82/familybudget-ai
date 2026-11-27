
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, CollectionReference, DocumentReference } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * Cada usuario trabaja dentro de un "hogar" con sus propias colecciones.
 *  - Hogar familiar original (householdId = null): colecciones en la raíz
 *    (expenses, categories, incomes), compartidas por los miembros iniciales.
 *  - Hogares nuevos: households/{householdId}/{expenses|categories|incomes}.
 */
export type HouseholdId = string | null;
type DataCollection = 'expenses' | 'categories' | 'incomes';

const pathOf = (householdId: HouseholdId, name: DataCollection): string =>
  householdId ? `households/${householdId}/${name}` : name;

export interface HouseholdRefs {
  expenses: CollectionReference;
  categories: CollectionReference;
  incomes: CollectionReference;
  doc: (name: DataCollection, id: string) => DocumentReference;
}

export const householdRefs = (householdId: HouseholdId): HouseholdRefs => ({
  expenses: collection(db, pathOf(householdId, 'expenses')),
  categories: collection(db, pathOf(householdId, 'categories')),
  incomes: collection(db, pathOf(householdId, 'incomes')),
  doc: (name, id) => doc(db, pathOf(householdId, name), id),
});
