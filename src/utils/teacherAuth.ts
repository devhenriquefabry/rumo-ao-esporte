import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type TeacherAuthStatus =
    | 'authenticated'
    | 'not-teacher'
    | 'inactive'
    | 'wrong-password'
    | 'auth-out-of-sync'
    | 'error';

export interface TeacherAuthResult {
    status: TeacherAuthStatus;
    nome?: string;
}

/**
 * Cadastros antigos foram gravados com o e-mail exatamente como a secretaria
 * digitou, então a busca precisa cobrir as duas grafias.
 */
const findTeacherDoc = async (email: string) => {
    const variants = Array.from(new Set([email.trim().toLowerCase(), email.trim()]));

    const snapshots = await Promise.all(
        variants.map((variant) => getDocs(query(collection(db, 'teachers'), where('email', '==', variant))))
    );

    return snapshots.flatMap((snapshot) => snapshot.docs)[0] ?? null;
};

const startTeacherSession = (nome: string) => {
    localStorage.removeItem('rae_admin_auth');
    localStorage.removeItem('rae_student_auth');
    localStorage.setItem('rae_teacher_auth', 'true');
    localStorage.setItem('teacherName', nome || 'Professor');
};

/**
 * Autentica um professor cadastrado na coleção 'teachers'.
 *
 * O cadastro no Firestore é a fonte da verdade: quem define a senha é a
 * secretaria. O Firebase Auth é apenas a sessão, e pode estar defasado — o
 * Worker não tem service account para alterar senhas lá. Por isso, quando a
 * senha digitada confere com o cadastro, esta função abre a conta com a senha
 * antiga conhecida e realinha as duas.
 */
export const authenticateTeacher = async (rawEmail: string, password: string): Promise<TeacherAuthResult> => {
    const email = rawEmail.trim().toLowerCase();
    const typedPassword = password.trim();

    try {
        const teacherDoc = await findTeacherDoc(rawEmail);

        if (!teacherDoc) return { status: 'not-teacher' };

        const teacher = teacherDoc.data() as any;

        if (teacher.active === false) return { status: 'inactive' };

        const nome = teacher.nome || 'Professor';

        // 1. Caminho normal: a senha já vale no Firebase Auth.
        try {
            await signInWithEmailAndPassword(auth, email, password);
            startTeacherSession(nome);
            return { status: 'authenticated', nome };
        } catch {
            // Segue para a validação pelo cadastro.
        }

        // 2. Confere com o que a secretaria cadastrou: senha do cadastro ou CPF.
        const storedPassword = (teacher.senha || '').trim();
        const storedCpf = (teacher.cpf || '').replace(/\D/g, '');
        const typedDigits = password.replace(/\D/g, '');
        const matchesRecord = (storedPassword && storedPassword === typedPassword)
            || (storedCpf.length >= 11 && storedCpf === typedDigits);

        if (!matchesRecord) return { status: 'wrong-password' };

        // 3. Primeiro acesso: a conta ainda não existe no Firebase Auth.
        try {
            await createUserWithEmailAndPassword(auth, email, typedPassword);
            startTeacherSession(nome);
            return { status: 'authenticated', nome };
        } catch (createError: any) {
            if (createError.code !== 'auth/email-already-in-use') {
                console.error('Erro ao criar acesso do professor:', createError);
                return { status: 'error' };
            }
        }

        // 4. A conta existe com uma senha anterior (a secretaria trocou a senha
        // no painel, que só grava no Firestore). Entra com a senha antiga
        // conhecida e passa a valer a senha do cadastro.
        const previousPasswords = Array.from(new Set([
            storedCpf.length >= 11 ? storedCpf : '',
            'rumo2026',
            storedPassword
        ].filter((candidate) => candidate && candidate !== typedPassword)));

        for (const previousPassword of previousPasswords) {
            try {
                const credential = await signInWithEmailAndPassword(auth, email, previousPassword);
                await updatePassword(credential.user, typedPassword);
                startTeacherSession(nome);
                return { status: 'authenticated', nome };
            } catch {
                // Tenta a próxima senha conhecida.
            }
        }

        return { status: 'auth-out-of-sync' };
    } catch (error) {
        console.error('Erro na autenticação do professor:', error);
        return { status: 'error' };
    }
};

/** Um e-mail de responsável nunca pode virar sessão de administrador. */
export const isResponsibleEmail = async (rawEmail: string) => {
    const variants = Array.from(new Set([rawEmail.trim().toLowerCase(), rawEmail.trim()]));

    const snapshots = await Promise.all(
        variants.map((variant) => getDocs(query(
            collection(db, 'rumo_ao_esporte_2026_registrations'),
            where('responsavel.email', '==', variant)
        )))
    );

    return snapshots.some((snapshot) => !snapshot.empty);
};
