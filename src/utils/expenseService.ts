import { db } from '../firebase';
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy
} from 'firebase/firestore';

const COLLECTION = 'uba_gastos';

export interface ExpenseInput {
    description: string;
    value: number;    // em centavos
    dueDate: string;  // YYYY-MM-DD
    observations?: string;
    category?: string;
    transactionReceiptUrl?: string;
}

export const expenseService = {
    async createExpense(_workerUrl: string, data: ExpenseInput) {
        const valueInReais = data.value / 100;
        const docRef = await addDoc(collection(db, COLLECTION), {
            description: data.description,
            value: valueInReais,
            dueDate: data.dueDate,
            scheduleDate: data.dueDate, // alias para compatibilidade com exibição
            observations: data.observations || '',
            category: data.category || '',
            transactionReceiptUrl: data.transactionReceiptUrl || '',
            createdAt: new Date().toISOString(),
        });
        return { success: true, expense: { id: docRef.id } };
    },

    async deleteExpense(_workerUrl: string, id: string) {
        await deleteDoc(doc(db, COLLECTION, id));
        return { success: true };
    },

    async listExpenses(_workerUrl: string, _limit = 50) {
        const q = query(collection(db, COLLECTION), orderBy('dueDate', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                scheduleDate: data.scheduleDate || data.dueDate || '', // normaliza
            };
        });
    }
};
