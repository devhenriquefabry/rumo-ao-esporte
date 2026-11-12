/**
 * Acesso ao Firestore e ao Worker para o módulo de eventos.
 */
import {
    addDoc, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch, deleteDoc,
} from 'firebase/firestore';
import type { DocumentData, UpdateData } from 'firebase/firestore';
import { db } from '../../firebase';
import type {
    Evento, EquipeEvento, InscricaoIndividual, JogoEvento, VagaPublica, PagamentoInscricao,
} from '../../types/eventos';
import { getPaymentProviderConfig, withPaymentProviderPayload, withPaymentProviderQuery } from '../paymentProviderConfig';

export const COL_EVENTOS = 'rae_eventos';
export const COL_EQUIPES = 'rae_evento_equipes';
export const COL_INSCRICOES = 'rae_evento_inscricoes';
export const COL_VAGAS = 'rae_evento_vagas';
export const COL_JOGOS = 'rae_evento_jogos';
export const COL_OPERADORES = 'rae_evento_staff';

const workerUrl = import.meta.env.VITE_WORKER_URL as string;

/** Remove `undefined` (o Firestore rejeita) mantendo null. */
export const limpar = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

const comId = <T>(snap: { id: string; data: () => DocumentData | undefined }) => ({ id: snap.id, ...snap.data() } as T);

// ---------- Eventos ----------

export async function listarEventos(): Promise<Evento[]> {
    const snap = await getDocs(collection(db, COL_EVENTOS));
    return snap.docs.map(d => comId<Evento>(d)).sort((a, b) => (b.dataInicio || '').localeCompare(a.dataInicio || ''));
}

export async function buscarEvento(id: string): Promise<Evento | null> {
    const snap = await getDoc(doc(db, COL_EVENTOS, id));
    return snap.exists() ? comId<Evento>(snap) : null;
}

export async function salvarEvento(evento: Evento): Promise<string> {
    const { id, ...dados } = evento;
    const agora = new Date().toISOString();
    if (id) {
        await setDoc(doc(db, COL_EVENTOS, id), limpar({ ...dados, updatedAt: agora }), { merge: true });
        return id;
    }
    const ref = await addDoc(collection(db, COL_EVENTOS), limpar({ ...dados, createdAt: agora, updatedAt: agora }));
    return ref.id;
}

export async function atualizarEvento(id: string, dados: Partial<Evento>) {
    await updateDoc(doc(db, COL_EVENTOS, id), limpar({ ...dados, updatedAt: new Date().toISOString() }) as UpdateData<DocumentData>);
}

// ---------- Vagas (resumo público) ----------

export async function listarVagas(eventId: string): Promise<VagaPublica[]> {
    const snap = await getDocs(query(collection(db, COL_VAGAS), where('eventId', '==', eventId)));
    return snap.docs.map(d => comId<VagaPublica>(d));
}

export const contarOcupadas = (vagas: VagaPublica[], categoriaId: string) =>
    vagas.filter(v => v.categoriaId === categoriaId && v.status !== 'cancelada').length;

// ---------- Equipes ----------

export async function listarEquipesDoEvento(eventId: string): Promise<EquipeEvento[]> {
    const snap = await getDocs(query(collection(db, COL_EQUIPES), where('eventId', '==', eventId)));
    return snap.docs.map(d => comId<EquipeEvento>(d)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function listarMinhasEquipes(uid: string): Promise<EquipeEvento[]> {
    const snap = await getDocs(query(collection(db, COL_EQUIPES), where('ownerUid', '==', uid)));
    return snap.docs.map(d => comId<EquipeEvento>(d));
}

export async function buscarEquipe(id: string): Promise<EquipeEvento | null> {
    const snap = await getDoc(doc(db, COL_EQUIPES, id));
    return snap.exists() ? comId<EquipeEvento>(snap) : null;
}

const vagaDeEquipe = (e: EquipeEvento): VagaPublica => ({
    eventId: e.eventId, categoriaId: e.categoriaId, tipo: 'equipe', nome: e.nome,
    status: e.status, ownerUid: e.ownerUid, grupo: e.grupo || '', createdAt: e.createdAt,
});

/** Cria a equipe e o resumo público com o mesmo id, na mesma transação. */
export async function criarEquipe(equipe: EquipeEvento): Promise<string> {
    const ref = doc(collection(db, COL_EQUIPES));
    const batch = writeBatch(db);
    batch.set(ref, limpar(equipe));
    batch.set(doc(db, COL_VAGAS, ref.id), limpar(vagaDeEquipe(equipe)));
    await batch.commit();
    return ref.id;
}

/** Atualiza a equipe e espelha nome/status/grupo no resumo público. */
export async function atualizarEquipe(id: string, dados: Partial<EquipeEvento>) {
    const batch = writeBatch(db);
    const agora = new Date().toISOString();
    batch.update(doc(db, COL_EQUIPES, id), limpar({ ...dados, updatedAt: agora }) as UpdateData<DocumentData>);
    const espelho: Partial<VagaPublica> = {};
    if (dados.nome !== undefined) espelho.nome = dados.nome;
    if (dados.status !== undefined) espelho.status = dados.status;
    if (dados.grupo !== undefined) espelho.grupo = dados.grupo;
    if (dados.categoriaId !== undefined) espelho.categoriaId = dados.categoriaId;
    if (Object.keys(espelho).length) batch.update(doc(db, COL_VAGAS, id), limpar(espelho) as UpdateData<DocumentData>);
    await batch.commit();
}

export async function excluirEquipe(id: string) {
    const batch = writeBatch(db);
    batch.delete(doc(db, COL_EQUIPES, id));
    batch.delete(doc(db, COL_VAGAS, id));
    await batch.commit();
}

// ---------- Inscrições individuais ----------

export async function listarInscricoesDoEvento(eventId: string): Promise<InscricaoIndividual[]> {
    const snap = await getDocs(query(collection(db, COL_INSCRICOES), where('eventId', '==', eventId)));
    return snap.docs.map(d => comId<InscricaoIndividual>(d))
        .sort((a, b) => a.participante.nome.localeCompare(b.participante.nome, 'pt-BR'));
}

export async function listarMinhasInscricoes(uid: string): Promise<InscricaoIndividual[]> {
    const snap = await getDocs(query(collection(db, COL_INSCRICOES), where('ownerUid', '==', uid)));
    return snap.docs.map(d => comId<InscricaoIndividual>(d));
}

export async function buscarInscricao(id: string): Promise<InscricaoIndividual | null> {
    const snap = await getDoc(doc(db, COL_INSCRICOES, id));
    return snap.exists() ? comId<InscricaoIndividual>(snap) : null;
}

const vagaDeInscricao = (i: InscricaoIndividual): VagaPublica => ({
    eventId: i.eventId, categoriaId: i.categoriaId, tipo: 'atleta', nome: i.participante.nome,
    status: i.status, ownerUid: i.ownerUid, numeroPeito: i.numeroPeito ?? null,
    resultado: i.resultado ?? null, createdAt: i.createdAt,
});

export async function criarInscricao(insc: InscricaoIndividual): Promise<string> {
    const ref = doc(collection(db, COL_INSCRICOES));
    const batch = writeBatch(db);
    batch.set(ref, limpar(insc));
    batch.set(doc(db, COL_VAGAS, ref.id), limpar(vagaDeInscricao(insc)));
    await batch.commit();
    return ref.id;
}

export async function atualizarInscricao(id: string, dados: Partial<InscricaoIndividual>) {
    const batch = writeBatch(db);
    batch.update(doc(db, COL_INSCRICOES, id), limpar({ ...dados, updatedAt: new Date().toISOString() }) as UpdateData<DocumentData>);
    const espelho: Partial<VagaPublica> = {};
    if (dados.status !== undefined) espelho.status = dados.status;
    if (dados.numeroPeito !== undefined) espelho.numeroPeito = dados.numeroPeito;
    if (dados.resultado !== undefined) espelho.resultado = dados.resultado;
    if (dados.participante?.nome !== undefined) espelho.nome = dados.participante.nome;
    if (dados.categoriaId !== undefined) espelho.categoriaId = dados.categoriaId;
    if (Object.keys(espelho).length) batch.update(doc(db, COL_VAGAS, id), limpar(espelho) as UpdateData<DocumentData>);
    await batch.commit();
}

export async function excluirInscricao(id: string) {
    const batch = writeBatch(db);
    batch.delete(doc(db, COL_INSCRICOES, id));
    batch.delete(doc(db, COL_VAGAS, id));
    await batch.commit();
}

// ---------- Jogos ----------

export async function listarJogos(eventId: string): Promise<JogoEvento[]> {
    const snap = await getDocs(query(collection(db, COL_JOGOS), where('eventId', '==', eventId)));
    return snap.docs.map(d => comId<JogoEvento>(d)).sort((a, b) => a.numero - b.numero);
}

export async function buscarJogo(id: string): Promise<JogoEvento | null> {
    const snap = await getDoc(doc(db, COL_JOGOS, id));
    return snap.exists() ? comId<JogoEvento>(snap) : null;
}

export async function salvarJogo(jogo: JogoEvento): Promise<string> {
    const { id, ...dados } = jogo;
    if (id) {
        await setDoc(doc(db, COL_JOGOS, id), limpar({ ...dados, updatedAt: new Date().toISOString() }), { merge: true });
        return id;
    }
    const ref = await addDoc(collection(db, COL_JOGOS), limpar(dados));
    return ref.id;
}

export async function criarJogosEmLote(jogos: JogoEvento[]) {
    // writeBatch suporta até 500 operações
    for (let i = 0; i < jogos.length; i += 400) {
        const batch = writeBatch(db);
        jogos.slice(i, i + 400).forEach(j => batch.set(doc(collection(db, COL_JOGOS)), limpar(j)));
        await batch.commit();
    }
}

export async function atualizarJogo(id: string, dados: Partial<JogoEvento>) {
    await updateDoc(doc(db, COL_JOGOS, id), limpar({ ...dados, updatedAt: new Date().toISOString() }) as UpdateData<DocumentData>);
}

export async function excluirJogo(id: string) {
    await deleteDoc(doc(db, COL_JOGOS, id));
}

// ---------- Upload (Worker / KV) ----------

export const LIMITE_UPLOAD_MB = 5;

/** Envia um arquivo (PDF ou imagem) ao Worker e devolve a URL pública. */
export async function enviarArquivo(file: File, pasta: string): Promise<string> {
    if (file.size > LIMITE_UPLOAD_MB * 1024 * 1024) {
        throw new Error(`Arquivo muito grande. O limite é ${LIMITE_UPLOAD_MB}MB.`);
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', pasta);
    const res = await fetch(`${workerUrl}/images/upload`, { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    const url = data?.url || data?.data?.url;
    if (!res.ok || !url) throw new Error(data?.error || 'Não foi possível enviar o arquivo.');
    return url;
}

// ---------- Pagamento PIX ----------

export interface CobrancaPix {
    transacaoId: string;
    pixCopiaECola: string;
    pixQrCodeUrl: string;
}

export async function gerarCobrancaPix(params: {
    valor: number;
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    descricao: string;
    referencia: string;
}): Promise<CobrancaPix> {
    const config = await getPaymentProviderConfig();
    const payload = withPaymentProviderPayload({
        amount: Math.round(params.valor * 100),
        billingType: 'PIX',
        responsibleName: params.nome,
        responsibleCpf: params.cpf.replace(/\D/g, ''),
        responsibleEmail: params.email,
        responsiblePhone: params.telefone.replace(/\D/g, ''),
        childName: 'Inscrição em evento',
        description: params.descricao,
        registrationId: params.referencia,
    }, config);

    const res = await fetch(`${workerUrl}/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!data?.success || !data?.payment?.id) {
        throw new Error(data?.error || 'Não foi possível gerar a cobrança PIX.');
    }
    return {
        transacaoId: data.payment.id,
        pixCopiaECola: data.payment.pixQrCode || '',
        pixQrCodeUrl: data.payment.pixQrCodeUrl || '',
    };
}

const STATUS_PAGO = ['RECEIVED', 'CONFIRMED', 'AVAILABLE', 'RECEIVED_IN_CASH', 'PAID'];

export async function consultarPagamentoPix(transacaoId: string): Promise<boolean> {
    const config = await getPaymentProviderConfig();
    const res = await fetch(withPaymentProviderQuery(`${workerUrl}/payment-status?paymentId=${encodeURIComponent(transacaoId)}`, config));
    const data = await res.json().catch(() => ({}));
    const status = String(data?.payment?.status || '').toUpperCase();
    return STATUS_PAGO.includes(status);
}

export const pagamentoConfirmado = (p?: PagamentoInscricao) => p?.status === 'confirmado' || p?.status === 'isento';


// ---------- Operadores de eventos (só o administrador principal gerencia) ----------

export interface OperadorEvento {
    email: string;
    nome: string;
    active: boolean;
    adicionadoPor?: string;
    adicionadoEm?: string;
}

const chaveEmail = (email: string) => email.trim().toLowerCase();

export async function listarOperadores(): Promise<OperadorEvento[]> {
    const snap = await getDocs(collection(db, COL_OPERADORES));
    return snap.docs.map(d => ({ email: d.id, ...(d.data() as Omit<OperadorEvento, 'email'>) }))
        .sort((a, b) => a.email.localeCompare(b.email));
}

export async function adicionarOperador(email: string, nome: string, por: string) {
    await setDoc(doc(db, COL_OPERADORES, chaveEmail(email)), {
        nome: nome.trim(), active: true, adicionadoPor: por, adicionadoEm: new Date().toISOString(),
    });
}

export async function removerOperador(email: string) {
    await deleteDoc(doc(db, COL_OPERADORES, chaveEmail(email)));
}
