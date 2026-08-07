import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { syncStaffAccess } from './staffAccess';

export type EmployeeAuthStatus =
    | 'authenticated'
    | 'not-employee'
    | 'inactive'
    | 'wrong-password'
    | 'error';

export interface EmployeeAuthResult {
    status: EmployeeAuthStatus;
    employee?: any;
}

const findEmployeeDoc = async (email: string) => {
    const variants = Array.from(new Set([email.trim().toLowerCase(), email.trim()]));

    const snapshots = await Promise.all(
        variants.map((variant) => getDocs(query(collection(db, 'employees'), where('email', '==', variant))))
    );

    return snapshots.flatMap((snapshot) => snapshot.docs)[0] ?? null;
};

/**
 * Autentica um funcionário cadastrado na coleção 'employees'.
 *
 * Espelha exatamente `authenticateTeacher` (utils/teacherAuth.ts): o cadastro
 * no Firestore é a fonte da verdade da senha (texto puro, definida pela
 * secretaria), e esta função garante que por trás disso exista também uma
 * sessão real no Firebase Auth — necessária para que as regras de segurança
 * do Firestore consigam reconhecer o funcionário (`request.auth`). Sem isso,
 * o acesso de funcionário seria só uma flag no localStorage, indistinguível
 * de um visitante anônimo para o banco de dados.
 */
export const authenticateEmployee = async (rawEmail: string, password: string): Promise<EmployeeAuthResult> => {
    const email = rawEmail.trim().toLowerCase();
    const typedPassword = password.trim();

    try {
        const employeeDoc = await findEmployeeDoc(rawEmail);
        if (!employeeDoc) return { status: 'not-employee' };

        const employee = { id: employeeDoc.id, ...employeeDoc.data() } as any;
        if (employee.active === false) return { status: 'inactive' };

        // 1. Caminho normal: a senha já vale no Firebase Auth.
        try {
            await signInWithEmailAndPassword(auth, email, password);
            await syncStaffAccess(email, true, 'employee');
            return { status: 'authenticated', employee };
        } catch {
            // Segue para a validação pelo cadastro.
        }

        // 2. Confere com o que está cadastrado: senha em texto puro (plaintext).
        const storedPassword = (employee.senha || '').trim();
        if (!storedPassword || storedPassword !== typedPassword) return { status: 'wrong-password' };

        // 3. Primeiro acesso: a conta ainda não existe no Firebase Auth.
        try {
            await createUserWithEmailAndPassword(auth, email, typedPassword);
            await syncStaffAccess(email, true, 'employee');
            return { status: 'authenticated', employee };
        } catch (createError: any) {
            if (createError.code !== 'auth/email-already-in-use') {
                console.error('Erro ao criar acesso do funcionário:', createError);
                return { status: 'error' };
            }
        }

        // 4. A conta existe com uma senha anterior (a secretaria trocou a senha
        // no painel, que só grava no Firestore). Entra com a senha antiga
        // conhecida e realinha para a atual.
        const previousPasswords = Array.from(new Set(['rumo2026', storedPassword].filter(
            (candidate) => candidate && candidate !== typedPassword
        )));

        for (const previousPassword of previousPasswords) {
            try {
                const credential = await signInWithEmailAndPassword(auth, email, previousPassword);
                await updatePassword(credential.user, typedPassword);
                await syncStaffAccess(email, true, 'employee');
                return { status: 'authenticated', employee };
            } catch {
                // Tenta a próxima senha conhecida.
            }
        }

        return { status: 'error' };
    } catch (error) {
        console.error('Erro na autenticação do funcionário:', error);
        return { status: 'error' };
    }
};
