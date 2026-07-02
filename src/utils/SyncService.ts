import { collection, query, where, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION_NAME = 'financial_payments';

export const SyncService = {
    /**
     * Propaga um pagamento do Asaas para o Firestore
     */
    async savePaymentToFirestore(payment: any, studentId: string) {
        if (!payment || !payment.id) return;

        const ref = doc(db, COLLECTION_NAME, payment.id);

        // Normaliza os dados para garantir consistência
        const dataToSave = {
            id: payment.id,
            studentId: studentId, // Link vital para nossa busca local
            customer: payment.customer || payment.customerId || null,
            value: payment.value || 0,
            netValue: payment.netValue || 0,
            dueDate: payment.dueDate || null,
            status: payment.status || 'UNKNOWN',
            description: payment.description || '',
            billingType: payment.billingType || null,
            invoiceUrl: payment.invoiceUrl || null,
            externalReference: payment.externalReference || null,
            discount: payment.discount || null,
            fine: payment.fine || null,
            interest: payment.interest || null,
            originalValue: payment.originalValue || null,
            dateCreated: payment.dateCreated || new Date().toISOString(),
            paymentDate: payment.paymentDate || null,
            lastUpdate: new Date().toISOString()
        };

        await setDoc(ref, dataToSave, { merge: true });
        console.log(`[Sync] Pagamento ${payment.id} salvo no Firestore.`);
    },

    /**
     * Salva multiplos pagamentos (Batch)
     */
    async saveBatchPaymentsToFirestore(payments: any[], studentId: string) {
        if (!payments.length) return;

        const batch = writeBatch(db);

        payments.forEach(payment => {
            if (!payment.id) return;
            const ref = doc(db, COLLECTION_NAME, payment.id);
            const dataToSave = {
                ...payment,
                studentId: studentId,
                lastUpdate: new Date().toISOString()
            };
            batch.set(ref, dataToSave, { merge: true });
        });

        await batch.commit();
        console.log(`[Sync] Batch de ${payments.length} pagamentos salvo.`);
    },

    /**
     * Remove do Firestore
     */
    async deletePaymentFromFirestore(paymentId: string) {
        if (!paymentId) return;
        await deleteDoc(doc(db, COLLECTION_NAME, paymentId));
        console.log(`[Sync] Pagamento ${paymentId} removido do Firestore.`);
    },

    /**
     * Estratégia Cache-First:
     * 1. Busca no Firestore pelo studentId
     * 2. Se tiver dados, retorna eles
     * 3. Se não, retorna null (sinalizando que deve buscar no Asaas)
     */
    async getCachedPayments(studentId: string) {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("studentId", "==", studentId)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) return null;

            return snapshot.docs.map(d => d.data());
        } catch (error) {
            console.error("[Sync] Erro ao ler cache:", error);
            return null;
        }
    },

    /**
     * Remove todas as cobranças de um aluno do cache local
     */
    async clearStudentPayments(studentId: string) {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("studentId", "==", studentId)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) return;

            const batch = writeBatch(db);
            snapshot.docs.forEach(d => {
                batch.delete(d.ref);
            });
            await batch.commit();
            console.log(`[Sync] Cache limpo para aluno ${studentId}.`);
        } catch (error) {
            console.error("[Sync] Erro ao limpar cache:", error);
        }
    }
};
