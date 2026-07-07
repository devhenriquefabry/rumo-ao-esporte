import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

export const RUMO_REGISTRATIONS_COLLECTION = 'rumo_ao_esporte_2026_registrations';

export type RegistrationSource = 'rumo';

export interface RegistrationRecord<T = any> {
    id: string;
    source: RegistrationSource;
    data: T;
}

export async function getRegistrationById(id: string): Promise<RegistrationRecord | null> {
    const rumoSnap = await getDoc(doc(db, RUMO_REGISTRATIONS_COLLECTION, id));
    if (rumoSnap.exists()) {
        return { id: rumoSnap.id, source: 'rumo', data: rumoSnap.data() };
    }

    return null;
}

export async function getRegistrationsFromSource(_source: RegistrationSource = 'rumo', orderByCreatedAt = true): Promise<RegistrationRecord[]> {
    const ref = collection(db, RUMO_REGISTRATIONS_COLLECTION);
    const snap = orderByCreatedAt
        ? await getDocs(query(ref, orderBy('createdAt', 'desc')))
        : await getDocs(query(ref));

    return snap.docs.map(docSnap => ({
        id: docSnap.id,
        source: 'rumo',
        data: docSnap.data()
    }));
}

export async function getRumoRegistrations(orderByCreatedAt = true): Promise<RegistrationRecord[]> {
    return getRegistrationsFromSource('rumo', orderByCreatedAt);
}
