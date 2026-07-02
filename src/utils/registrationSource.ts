import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

export const ARENA_REGISTRATIONS_COLLECTION = 'arena_simonesia_2026_registrations';

export type RegistrationSource = 'arena';

export interface RegistrationRecord<T = any> {
    id: string;
    source: RegistrationSource;
    data: T;
}

export async function getRegistrationById(id: string): Promise<RegistrationRecord | null> {
    const arenaSnap = await getDoc(doc(db, ARENA_REGISTRATIONS_COLLECTION, id));
    if (arenaSnap.exists()) {
        return { id: arenaSnap.id, source: 'arena', data: arenaSnap.data() };
    }

    return null;
}

export async function getRegistrationsFromSource(_source: RegistrationSource = 'arena', orderByCreatedAt = true): Promise<RegistrationRecord[]> {
    const ref = collection(db, ARENA_REGISTRATIONS_COLLECTION);
    const snap = orderByCreatedAt
        ? await getDocs(query(ref, orderBy('createdAt', 'desc')))
        : await getDocs(query(ref));

    return snap.docs.map(docSnap => ({
        id: docSnap.id,
        source: 'arena',
        data: docSnap.data()
    }));
}

export async function getArenaRegistrations(orderByCreatedAt = true): Promise<RegistrationRecord[]> {
    return getRegistrationsFromSource('arena', orderByCreatedAt);
}
