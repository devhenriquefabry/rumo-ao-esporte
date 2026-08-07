import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizeNameKey, isUsableCpf, buildSyntheticEmail } from './nameUtils';

export const REGISTRATIONS_COLLECTION = 'rumo_ao_esporte_2026_registrations';

const IMPERSONATED_EMAIL_KEY = 'rae_impersonated_student_email';
const IMPERSONATED_BACK_ID_KEY = 'rae_impersonated_student_back_id';
const RESPONSAVEL_KEY = 'rae_responsavel_key';

const onlyDigits = (value: string | undefined | null) => (value || '').replace(/\D/g, '');

/**
 * Identidade do responsável dentro de um e-mail de acesso.
 *
 * O portal do aluno sempre carregou as matrículas apenas por `responsavel.email`.
 * Quando dois cadastros de famílias diferentes acabam com o mesmo e-mail (e-mail
 * fictício digitado na secretaria, por exemplo), os dois viram "a mesma conta":
 * o responsável enxerga atletas, carteirinhas e faturas que não são dele.
 *
 * O CPF é a chave real da família. Sem CPF utilizável, cai para o nome normalizado.
 */
export const buildResponsavelKey = (responsavel: any): string => {
    const cpf = onlyDigits(responsavel?.cpf);
    if (isUsableCpf(cpf)) return `cpf:${cpf}`;

    const nome = normalizeNameKey(responsavel?.nomeBusca || responsavel?.nome || '');
    return nome ? `nome:${nome}` : '';
};

/** Fixa qual responsável está usando a sessão (chamado no login e na impersonação). */
export const rememberResponsavelKey = (responsavel: any): void => {
    const key = buildResponsavelKey(responsavel);
    if (key) localStorage.setItem(RESPONSAVEL_KEY, key);
    else localStorage.removeItem(RESPONSAVEL_KEY);
};

export const clearResponsavelKey = (): void => localStorage.removeItem(RESPONSAVEL_KEY);

/** E-mail em uso na sessão: o do admin simulando acesso, ou o do usuário logado. */
export const getSessionStudentEmail = (userEmail?: string | null): string => {
    const impersonated = localStorage.getItem(IMPERSONATED_EMAIL_KEY);
    return (impersonated || userEmail || '').toLowerCase().trim();
};

/** Já existe outro responsável (CPF/nome diferente) usando este e-mail? */
export const isEmailUsedByAnotherResponsavel = async (
    email: string,
    responsavel: any
): Promise<boolean> => {
    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail) return false;

    try {
        const snap = await getDocs(
            query(collection(db, REGISTRATIONS_COLLECTION), where('responsavel.email', '==', normalizedEmail))
        );
        const key = buildResponsavelKey(responsavel);
        return snap.docs.some(d => buildResponsavelKey(d.data().responsavel) !== key);
    } catch (error) {
        console.error('Erro ao verificar e-mail do responsável:', error);
        return false;
    }
};

/**
 * E-mail seguro para gravar em um cadastro novo.
 *
 * Se o e-mail informado já pertence a OUTRO responsável, gravá-lo aqui juntaria as
 * duas famílias na mesma conta do portal (e na mesma conta do Firebase Auth). Nesse
 * caso trocamos pelo e-mail interno determinístico, que o login por nome já usa.
 */
export const resolveSafeResponsavelEmail = async (responsavel: any): Promise<string> => {
    const email = (responsavel?.email || '').toLowerCase().trim();
    const cpf = onlyDigits(responsavel?.cpf);
    const fallback = () => buildSyntheticEmail(cpf, crypto.randomUUID());

    if (!email.includes('@')) return fallback();

    try {
        const snap = await getDocs(
            query(collection(db, REGISTRATIONS_COLLECTION), where('responsavel.email', '==', email))
        );
        const key = buildResponsavelKey(responsavel);
        const conflita = snap.docs.some(d => buildResponsavelKey(d.data().responsavel) !== key);
        if (conflita) {
            console.warn(`[IDENTIDADE] E-mail "${email}" já pertence a outro responsável; usando e-mail interno.`);
            return fallback();
        }
    } catch (error) {
        console.error('Erro ao verificar e-mail do responsável:', error);
    }

    return email;
};

const resolveAnchorKey = async (docs: QueryDocumentSnapshot<DocumentData>[]): Promise<string> => {
    // Admin simulando acesso: a âncora é a matrícula que ele abriu no painel.
    const backId = localStorage.getItem(IMPERSONATED_BACK_ID_KEY);
    if (localStorage.getItem(IMPERSONATED_EMAIL_KEY) && backId) {
        const inList = docs.find(d => d.id === backId);
        if (inList) return buildResponsavelKey(inList.data().responsavel);

        try {
            const snap = await getDoc(doc(db, REGISTRATIONS_COLLECTION, backId));
            if (snap.exists()) return buildResponsavelKey(snap.data().responsavel);
        } catch (error) {
            console.error('Erro ao resolver matrícula de origem da simulação:', error);
        }
    }

    return localStorage.getItem(RESPONSAVEL_KEY) || '';
};

/**
 * Matrículas do responsável logado — já filtradas para conter só a família dele.
 * Substitui a busca crua por `responsavel.email`, que agrupava famílias distintas
 * que dividiam o mesmo e-mail.
 */
export const fetchResponsavelRegistrations = async (
    email: string
): Promise<QueryDocumentSnapshot<DocumentData>[]> => {
    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail) return [];

    const snap = await getDocs(
        query(collection(db, REGISTRATIONS_COLLECTION), where('responsavel.email', '==', normalizedEmail))
    );
    const docs = snap.docs;
    if (docs.length <= 1) return docs;

    const keys = new Set(docs.map(d => buildResponsavelKey(d.data().responsavel)));
    if (keys.size <= 1) return docs; // e-mail compartilhado pela mesma família: nada a filtrar

    const anchorKey = await resolveAnchorKey(docs);
    if (!anchorKey) {
        console.warn(
            `[IDENTIDADE] E-mail "${normalizedEmail}" é usado por ${keys.size} responsáveis diferentes ` +
            `e a sessão não sabe qual deles está acessando. Exibindo todos os cadastros.`
        );
        return docs;
    }

    const filtered = docs.filter(d => buildResponsavelKey(d.data().responsavel) === anchorKey);
    return filtered.length > 0 ? filtered : docs;
};
