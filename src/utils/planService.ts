
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp, writeBatch, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface PricingRule {
    mensalidade: {
        ateVencimento: number; // Centavos
        aposVencimento: number; // Centavos
    };
    matricula: number; // Centavos
}

export interface Plan {
    id: string;
    nome: string;
    modalidade: string;
    // New Structure
    valores: PricingRule;

    uniforme?: number; // Optional
    jurosMensais?: number; // Percentage (e.g., 2.0)
    multa?: number; // Percentage (e.g., 2.0)
    frequencia: 'mensal'; // Fixed for now
    active: boolean;
    description?: string;
    isDefault?: boolean; // Marca este plano como padrão para novos contratos
    rescisao?: { tipo: 'fixed' | 'percentage'; valor: number }; // Multa de rescisão
    // Legacy support (optional, can be removed if we migrate data)
    valor?: number;
}

const COLLECTION_NAME = 'rumo_ao_esporte_2026_plans';

export const planService = {
    async getPlans(): Promise<Plan[]> {
        const q = query(collection(db, COLLECTION_NAME), orderBy('nome'));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
    },

    async getDefaultPlan(): Promise<Plan | null> {
        const q = query(collection(db, COLLECTION_NAME), where('isDefault', '==', true));
        const snap = await getDocs(q);
        if (snap.empty) {
            // Fallback: return first active plan
            const allPlans = await this.getPlans();
            return allPlans.find(p => p.active) || null;
        }
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as Plan;
    },

    async getPlanById(id: string): Promise<Plan | null> {
        const q = query(collection(db, COLLECTION_NAME));
        const snap = await getDocs(q);
        const found = snap.docs.find(d => d.id === id);
        return found ? { id: found.id, ...found.data() } as Plan : null;
    },

    async setDefaultPlan(id: string): Promise<void> {
        const batch = writeBatch(db);

        // Remove isDefault from all plans
        const allPlans = await getDocs(collection(db, COLLECTION_NAME));
        allPlans.docs.forEach(docSnap => {
            batch.update(doc(db, COLLECTION_NAME, docSnap.id), { isDefault: false });
        });

        // Set the new default
        batch.update(doc(db, COLLECTION_NAME, id), { isDefault: true });

        await batch.commit();
    },

    async createPlan(plan: Omit<Plan, 'id'>) {
        return await addDoc(collection(db, COLLECTION_NAME), {
            ...plan,
            active: true,
            createdAt: Timestamp.now()
        });
    },

    async updatePlan(id: string, plan: Partial<Plan>) {
        const planRef = doc(db, COLLECTION_NAME, id);
        return await updateDoc(planRef, {
            ...plan,
            updatedAt: Timestamp.now()
        });
    },

    async deletePlan(id: string) {
        const planRef = doc(db, COLLECTION_NAME, id);
        return await deleteDoc(planRef);
    }
};
