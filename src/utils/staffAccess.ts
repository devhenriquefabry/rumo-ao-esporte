import { doc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const STAFF_ACCESS_COLLECTION = 'staff_access';

/**
 * Índice espelho usado pelas regras de segurança do Firestore.
 *
 * `employees` e `teachers` guardam o e-mail como CAMPO, não como id do
 * documento, então as regras não conseguem checar "este e-mail é de um
 * funcionário ativo?" com um `get()` direto — Firestore Rules não fazem query
 * por campo, só leitura por caminho conhecido. Este índice resolve isso: um
 * documento por e-mail (em minúsculas), mantido pelo próprio código sempre
 * que um funcionário/professor é criado, editado ou tem o e-mail/status
 * alterado.
 */
export type StaffKind = 'employee' | 'teacher' | 'diretoria';

const emailKey = (email: string) => (email || '').trim().toLowerCase();

/** Cria/atualiza o índice para este e-mail. Chame após salvar o cadastro real. */
export const syncStaffAccess = async (
    email: string,
    active: boolean,
    kind: StaffKind,
    previousEmail?: string
): Promise<void> => {
    const key = emailKey(email);
    const prevKey = emailKey(previousEmail || '');

    // E-mail mudou: o documento antigo ficaria "fantasma" (continuaria marcado
    // como staff ativo mesmo sem cadastro nenhum apontando pra ele).
    if (prevKey && prevKey !== key) {
        await deleteDoc(doc(db, STAFF_ACCESS_COLLECTION, prevKey)).catch(() => {});
    }

    if (!key) return;
    await setDoc(doc(db, STAFF_ACCESS_COLLECTION, key), { active, kind, updatedAt: serverTimestamp() });
};

/** Remove o índice (cadastro excluído). */
export const removeStaffAccess = async (email: string): Promise<void> => {
    const key = emailKey(email);
    if (!key) return;
    await deleteDoc(doc(db, STAFF_ACCESS_COLLECTION, key)).catch(() => {});
};
