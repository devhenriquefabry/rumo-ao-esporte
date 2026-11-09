import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const COL_CONTAS = 'rae_evento_contas';

/** Perfil do responsável por equipe / corredor (dados usados na inscrição e no PIX). */
export interface ContaEvento {
    nome: string;
    email: string;
    telefone: string;
    cpf: string;
    createdAt?: string;
    updatedAt?: string;
}

export async function salvarContaEvento(uid: string, conta: ContaEvento) {
    const agora = new Date().toISOString();
    await setDoc(doc(db, COL_CONTAS, uid), { ...conta, email: conta.email.toLowerCase().trim(), updatedAt: agora, createdAt: conta.createdAt || agora }, { merge: true });
}

/** Sessão do Firebase Auth + perfil da conta de eventos. */
export function useEventoConta() {
    const [user, setUser] = useState<User | null>(auth.currentUser);
    const [conta, setConta] = useState<ContaEvento | null>(null);
    const [loading, setLoading] = useState(true);

    const carregarConta = useCallback(async (u: User | null) => {
        if (!u) { setConta(null); return; }
        try {
            const snap = await getDoc(doc(db, COL_CONTAS, u.uid));
            setConta(snap.exists() ? (snap.data() as ContaEvento) : null);
        } catch (e) {
            console.error('Erro ao carregar conta de eventos:', e);
            setConta(null);
        }
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            await carregarConta(u);
            setLoading(false);
        });
        return unsub;
    }, [carregarConta]);

    const recarregar = useCallback(() => carregarConta(auth.currentUser), [carregarConta]);

    return { user, conta, loading, recarregar };
}
