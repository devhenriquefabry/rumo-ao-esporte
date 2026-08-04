import { collection, doc, getDocs, query, setDoc, where, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { AutorizacaoResposta, Convocacao } from '../types/convocacao';

export const CONVOCACOES_COLLECTION = 'rumo_ao_esporte_2026_convocacoes';
export const AUTORIZACOES_COLLECTION = 'rumo_ao_esporte_2026_convocacao_autorizacoes';

/** Um documento por atleta/convocação — evita reescrever o array `jogadores`. */
export const autorizacaoDocId = (convocacaoId: string, jogadorId: string) =>
    `${convocacaoId}__${jogadorId}`;

export async function salvarAutorizacao(resposta: AutorizacaoResposta): Promise<void> {
    const id = autorizacaoDocId(resposta.convocacaoId, resposta.jogadorId);
    const payload: AutorizacaoResposta = { ...resposta, id };

    // Firestore recusa `undefined`; limpamos os campos não preenchidos.
    const clean = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
    );

    await setDoc(doc(db, AUTORIZACOES_COLLECTION, id), clean, { merge: true });
}

export async function removerAutorizacao(convocacaoId: string, jogadorId: string): Promise<void> {
    await deleteDoc(doc(db, AUTORIZACOES_COLLECTION, autorizacaoDocId(convocacaoId, jogadorId)));
}

export async function listarAutorizacoesDaConvocacao(convocacaoId: string): Promise<AutorizacaoResposta[]> {
    const q = query(collection(db, AUTORIZACOES_COLLECTION), where('convocacaoId', '==', convocacaoId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AutorizacaoResposta));
}

/** Convocações com a autorização liberada para os responsáveis. */
export async function listarConvocacoesComAutorizacao(): Promise<Convocacao[]> {
    const q = query(collection(db, CONVOCACOES_COLLECTION), where('autorizacao.ativa', '==', true));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Convocacao))
        .sort((a, b) => (b.dataUnix || 0) - (a.dataUnix || 0));
}

/** Busca as respostas de uma lista de convocações (chunk de 10 por causa do `in`). */
export async function listarAutorizacoesDeConvocacoes(convocacaoIds: string[]): Promise<AutorizacaoResposta[]> {
    if (convocacaoIds.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < convocacaoIds.length; i += 10) {
        chunks.push(convocacaoIds.slice(i, i + 10));
    }

    const results = await Promise.all(
        chunks.map(async ids => {
            const q = query(collection(db, AUTORIZACOES_COLLECTION), where('convocacaoId', 'in', ids));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as AutorizacaoResposta));
        })
    );

    return results.flat();
}
