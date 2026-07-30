import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useDialog } from '../context/CustomDialogContext';
import { useLoading } from '../components/LoadingService';
import RememberSessionCheckbox from '../components/RememberSessionCheckbox';
import { configureAuthPersistence } from '../utils/authPersistence';
import { normalizeNameKey, buildSyntheticEmail } from '../utils/nameUtils';
import { DIRETORIA_PROFILE, DIRETORIA_PASSWORD, isDiretoriaEmail } from '../config/accessProfiles';
import '../App.css';

const MAIN_ADMIN_EMAIL = ((import.meta.env.VITE_MAIN_ADMIN_EMAIL as string) || 'rumoaoesporte@admin.com').trim().toLowerCase();

export default function StudentLogin() {
    const [loginInput, setLoginInput] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [keepSignedIn, setKeepSignedIn] = useState(true);
    const [loading, setLoading] = useState(false);
    const [checkingSavedSession, setCheckingSavedSession] = useState(true);
    const loginAttemptStarted = useRef(false);
    const navigate = useNavigate();
    const { showAlert } = useDialog();
    const { showLoading } = useLoading();

    const workerUrl = import.meta.env.VITE_WORKER_URL;

    const proceedToDashboard = useCallback(async (userEmail: string, restoredSession = false) => {
        showLoading(restoredSession ? 900 : 3500, restoredSession ? 'Restaurando seu acesso...' : 'Identificando perfil de acesso...');
        const normalizedEmail = userEmail.toLowerCase().trim();

        if (restoredSession) {
            const hasStudentRole = Boolean(localStorage.getItem('rae_student_auth'));
            const hasTeacherRole = Boolean(localStorage.getItem('rae_teacher_auth'));

            if (hasStudentRole && !hasTeacherRole) {
                localStorage.removeItem('rae_admin_auth');
                navigate('/aluno/dashboard', { replace: true });
                return;
            }

            if (hasTeacherRole && !hasStudentRole) {
                localStorage.removeItem('rae_admin_auth');
                navigate('/professor/turmas', { replace: true });
                return;
            }
        }

        if (normalizedEmail === MAIN_ADMIN_EMAIL) {
            localStorage.removeItem('rae_student_auth');
            localStorage.removeItem('rae_teacher_auth');
            localStorage.setItem('rae_admin_auth', 'true');
            // Sessão Firebase restaurada => persistência durável estava ativa.
            // Cura um 'false' antigo da chave, que faria o main.tsx apagar a
            // sessão na próxima abertura do app.
            if (sessionStorage.getItem('rae_admin_session_active') !== 'true') {
                localStorage.setItem('rae_admin_keep_signed_in', 'true');
            }
            if (restoredSession) {
                navigate('/admin/dashboard', { replace: true });
            } else {
                showLoading(1500, 'Acessando Painel Administrativo...');
                setTimeout(() => navigate('/admin/dashboard'), 1500);
            }
            return;
        }

        const emailVariants = Array.from(new Set([normalizedEmail, userEmail.trim()]));

        const teacherQueries = emailVariants.map(v => query(collection(db, "teachers"), where("email", "==", v)));
        const teacherSnaps = await Promise.all(teacherQueries.map(q => getDocs(q)));
        const teacherDocs = teacherSnaps.flatMap(s => s.docs);

        localStorage.removeItem('rae_admin_auth');

        if (teacherDocs.length > 0) {
            const teacher = teacherDocs[0].data() as any;
            if (teacher.active === false) {
                await auth.signOut();
                localStorage.removeItem('rae_teacher_auth');
                localStorage.removeItem('teacherName');
                showAlert("Seu acesso de professor está desativado.", "error");
                return;
            }
            localStorage.removeItem('rae_student_auth');
            localStorage.setItem('rae_teacher_auth', 'true');
            localStorage.setItem('teacherName', teacher.nome);
            if (restoredSession) {
                navigate('/professor/turmas', { replace: true });
            } else {
                showLoading(3000, 'Acessando Portal do Professor...');
                setTimeout(() => navigate('/professor/turmas'), 3000);
            }
        } else {
            localStorage.removeItem('rae_teacher_auth');
            localStorage.setItem('rae_student_auth', 'true');
            if (restoredSession) {
                navigate('/aluno/dashboard', { replace: true });
            } else {
                showLoading(1500, 'Acessando Painel do Aluno...');
                setTimeout(() => navigate('/aluno/dashboard'), 1500);
            }
        }
    }, [navigate, showAlert, showLoading]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (loginAttemptStarted.current) return;

            if (!user?.email) {
                setCheckingSavedSession(false);
                return;
            }

            loginAttemptStarted.current = true;
            setLoading(true);

            const shouldKeepSession = localStorage.getItem('rae_keep_signed_in') !== 'false';

            void configureAuthPersistence(auth, shouldKeepSession)
                .then(() => proceedToDashboard(user.email!, true))
                .catch((error) => {
                    console.error('Session restore error:', error);
                    showAlert('Não foi possível restaurar sua sessão. Tente entrar novamente.', 'error');
                })
                .finally(() => {
                    loginAttemptStarted.current = false;
                    setCheckingSavedSession(false);
                    setLoading(false);
                });
        });

        return unsubscribe;
    }, [proceedToDashboard, showAlert]);

    // Login por Nome completo do Responsável (fluxo principal para pais/responsáveis)
    const handleNameLogin = async (rawName: string) => {
        const nomeBusca = normalizeNameKey(rawName);
        const cleanPassword = password.replace(/\D/g, '');

        const q = query(collection(db, "rumo_ao_esporte_2026_registrations"), where("responsavel.nomeBusca", "==", nomeBusca));
        const snap = await getDocs(q);

        if (snap.empty) {
            showAlert("Nome não encontrado. Digite o nome completo do responsável exatamente como no cadastro.", "error");
            return;
        }

        // 1. Tenta login direto: cobre o caso do responsável já ter trocado a senha antes.
        const candidateEmails = Array.from(new Set(snap.docs.map(d => {
            const data = d.data() as any;
            const email = (data.responsavel?.email || '').toLowerCase().trim();
            if (email) return email;
            const cpfClean = (data.responsavel?.cpf || '').replace(/\D/g, '');
            return buildSyntheticEmail(cpfClean, d.id);
        })));

        for (const candidateEmail of candidateEmails) {
            try {
                await signInWithEmailAndPassword(auth, candidateEmail, password);
                await proceedToDashboard(candidateEmail);
                return;
            } catch { /* tenta o próximo ou cai no fluxo de primeiro acesso */ }
        }

        // 2. Ainda não tem conta (ou senha digitada não confere): valida contra a senha
        // padrão (CPF) ou senha customizada salva no cadastro.
        const matchedDoc = snap.docs.find(d => {
            const data = d.data() as any;
            const cpfClean = (data.responsavel?.cpf || '').replace(/\D/g, '');
            return (data.senha && data.senha === password) || (cpfClean.length === 11 && cpfClean === cleanPassword);
        });

        if (!matchedDoc) {
            showAlert("Senha incorreta. Se for seu primeiro acesso, use seu CPF (somente números) como senha.", "error");
            return;
        }

        const matchedData = matchedDoc.data() as any;
        const cpfClean = (matchedData.responsavel?.cpf || '').replace(/\D/g, '');
        const usingCustomSenha = Boolean(matchedData.senha) && matchedData.senha === password;
        const passwordForAuth = usingCustomSenha ? password : cleanPassword;

        let targetEmail = (matchedData.responsavel?.email || '').toLowerCase().trim();
        if (!targetEmail) {
            targetEmail = buildSyntheticEmail(cpfClean, matchedDoc.id);
            // Persiste o e-mail (interno) em todos os cadastros da mesma família para
            // manter consistente o resto do sistema, que identifica o responsável pelo e-mail.
            const siblingIds = snap.docs
                .filter(d => ((d.data() as any).responsavel?.cpf || '').replace(/\D/g, '') === cpfClean)
                .map(d => d.id);
            await Promise.all(siblingIds.map(id =>
                updateDoc(doc(db, 'rumo_ao_esporte_2026_registrations', id), { 'responsavel.email': targetEmail })
            ));
        }

        // A senha digitada é válida (CPF ou senha customizada), mas pode estar em um
        // formato diferente do que foi realmente salvo no Firebase Auth (ex: CPF com
        // pontuação). Tenta a forma canônica antes de assumir que é primeiro acesso.
        if (passwordForAuth !== password) {
            try {
                await signInWithEmailAndPassword(auth, targetEmail, passwordForAuth);
                await proceedToDashboard(targetEmail);
                return;
            } catch { /* conta ainda não existe com essa senha: segue para criação */ }
        }

        try {
            await createUserWithEmailAndPassword(auth, targetEmail, passwordForAuth);
            showAlert("Primeiro acesso confirmado! Sua conta foi criada.", "success");
            await proceedToDashboard(targetEmail);
        } catch (createError: any) {
            if (createError.code === 'auth/email-already-in-use') {
                showAlert("Senha incorreta. Se você já alterou sua senha antes, use a nova senha. Esqueceu? Contate a secretaria.", "error");
            } else {
                throw createError;
            }
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        loginAttemptStarted.current = true;
        setLoading(true);

        const rawInput = loginInput.trim();
        const isEmailInput = rawInput.includes('@');

        try {
            await configureAuthPersistence(auth, keepSignedIn);
            localStorage.setItem('rae_keep_signed_in', String(keepSignedIn));

            if (!isEmailInput) {
                // Fluxo novo: login de responsáveis pelo Nome Completo
                await handleNameLogin(rawInput);
                return;
            }

            // === Fluxo por e-mail (professores, administração e compatibilidade) ===
            const normalizedEmail = rawInput.toLowerCase();
            const rawEmail = rawInput;
            const cleanPassword = password.replace(/\D/g, '');

            if (normalizedEmail === MAIN_ADMIN_EMAIL) {
                // Autentica no Firebase de verdade: valida a senha e cria uma sessão
                // durável, que sobrevive ao fechamento do aplicativo.
                try {
                    await signInWithEmailAndPassword(auth, normalizedEmail, password);
                } catch {
                    showAlert('Senha incorreta. Redirecionando para o Login Administrativo...', 'error');
                    setTimeout(() => navigate('/admin/login'), 2000);
                    return;
                }
                localStorage.removeItem('rae_student_auth');
                localStorage.removeItem('rae_teacher_auth');
                localStorage.setItem('rae_admin_auth', 'true');
                // Grava a preferência na MESMA chave que o main.tsx usa na limpeza de
                // sessão de admin. Sem isso, um 'false' antigo dessa chave derruba o
                // login a cada abertura do app, mesmo com "manter conectado" marcado.
                localStorage.setItem('rae_admin_keep_signed_in', String(keepSignedIn));
                if (keepSignedIn) {
                    sessionStorage.removeItem('rae_admin_session_active');
                } else {
                    sessionStorage.setItem('rae_admin_session_active', 'true');
                }
                showLoading(1500, 'Acessando Painel Administrativo...');
                setTimeout(() => navigate('/admin/dashboard'), 1500);
                return;
            }

            // Perfil "Diretoria": login fixo compartilhado, acesso restrito a poucos painéis
            if (isDiretoriaEmail(normalizedEmail)) {
                if (password.trim() === DIRETORIA_PASSWORD) {
                    localStorage.removeItem('rae_student_auth');
                    localStorage.removeItem('rae_teacher_auth');
                    localStorage.setItem('rae_admin_auth', JSON.stringify(DIRETORIA_PROFILE));
                    localStorage.setItem('rae_admin_keep_signed_in', String(keepSignedIn));
                    if (keepSignedIn) {
                        sessionStorage.removeItem('rae_admin_session_active');
                    } else {
                        sessionStorage.setItem('rae_admin_session_active', 'true');
                    }
                    showLoading(1500, 'Acessando Painel da Diretoria...');
                    setTimeout(() => navigate('/admin/aniversariantes'), 1500);
                } else {
                    showAlert('Senha incorreta.', 'error');
                    setLoading(false);
                }
                return;
            }

            // 0. Pre-check: Is this an inactive teacher? (Multi-casing)
            const teacherPreCheckVariants = Array.from(new Set([normalizedEmail, rawEmail]));
            const teacherPreCheckQueries = teacherPreCheckVariants.map(v => query(collection(db, "teachers"), where("email", "==", v)));
            const teacherPreCheckSnaps = await Promise.all(teacherPreCheckQueries.map((q: any) => getDocs(q)));
            const teacherPreCheckDocs = teacherPreCheckSnaps.flatMap(s => s.docs);

            if (teacherPreCheckDocs.length > 0) {
                const teacherData = teacherPreCheckDocs[0].data() as any;
                if (teacherData.active === false) {
                    showAlert("Seu acesso de professor está desativado. Entre em contato com a secretaria.", "error");
                    setLoading(false);
                    return;
                }
            }

            // 1. Try standard Firebase Auth login
            try {
                await signInWithEmailAndPassword(auth, normalizedEmail, password);
                await proceedToDashboard(normalizedEmail);
                return;
            } catch (authError: any) {
                console.log("Standard auth failed, checking database for robust access/sync...");
            }

            // CHECK: Is this an Employee trying to login here?
            const employeeQ = query(collection(db, "employees"), where("email", "==", normalizedEmail));
            const employeeSnap = await getDocs(employeeQ);
            if (!employeeSnap.empty) {
                showAlert("Este email pertence a um funcionário/admin. Redirecionando para Login Administrativo...", "info");
                setTimeout(() => navigate('/admin/login'), 2000);
                return;
            }

            // 2. Aggregate Credentials from Teachers AND Students (Robust Lookup)
            const emailVariants = Array.from(new Set([normalizedEmail, rawEmail]));
            const teacherQueries = emailVariants.map(v => query(collection(db, "teachers"), where("email", "==", v)));
            const studentQueries = emailVariants.map(v => query(collection(db, "rumo_ao_esporte_2026_registrations"), where("responsavel.email", "==", v)));

            // Robust Fallback: Search by CPF directly if password looks like a CPF
            let cpfFallbackQueries: any[] = [];
            if (cleanPassword.length >= 11) {
                cpfFallbackQueries = [
                    query(collection(db, "rumo_ao_esporte_2026_registrations"), where("responsavel.cpf", "==", cleanPassword)),
                ];
            }

            const allSnaps = await Promise.all([
                ...teacherQueries.map(q => getDocs(q)),
                ...studentQueries.map(q => getDocs(q)),
                ...cpfFallbackQueries.map(q => getDocs(q))
            ]);

            const teacherDocs = allSnaps.slice(0, teacherQueries.length).flatMap(s => s.docs);
            const studentDocs = allSnaps.slice(teacherQueries.length, teacherQueries.length + studentQueries.length).flatMap(s => s.docs);
            const cpfFallbackDocs = allSnaps.slice(teacherQueries.length + studentQueries.length).flatMap(s => s.docs);

            // Filter CPF matches to only those that match entered email case-insensitively
            const validCpfMatches = cpfFallbackDocs.filter(docSnap => {
                const data = docSnap.data() as any;
                const storedEmail = (data.responsavel?.email || '').toLowerCase().trim();
                return storedEmail === normalizedEmail;
            });

            // Final set of documents (deduplicated)
            const finalStudentDocsMap = new Map();
            [...studentDocs, ...validCpfMatches].forEach(d => finalStudentDocsMap.set(d.id, d));
            const finalStudentDocs = Array.from(finalStudentDocsMap.values());

            if (teacherDocs.length > 0 || finalStudentDocs.length > 0) {
                const potentialPasswords = new Set<string>();
                let matchType: 'teacher' | 'student' | null = null;
                let matchDocId: string | null = null;

                // Helper to add valid passwords
                const addPotentialPassword = (p: string | undefined | null) => {
                    if (p && typeof p === 'string' && p.trim().length > 0) {
                        potentialPasswords.add(p.trim());
                        const clean = p.replace(/\D/g, '');
                        if (clean.length >= 11) potentialPasswords.add(clean);
                    }
                };

                // Harvest from Teachers
                teacherDocs.forEach(docSnap => {
                    const tData = docSnap.data() as any;
                    addPotentialPassword(tData.senha);
                    addPotentialPassword(tData.cpf);
                    addPotentialPassword('rumo2026');
                    const tCpfClean = (tData.cpf || '').replace(/\D/g, '');
                    if (tData.senha === password || (tCpfClean && tCpfClean === cleanPassword)) {
                        matchType = 'teacher';
                        matchDocId = docSnap.id;
                    }
                });

                // Harvest from Students
                finalStudentDocs.forEach(docSnap => {
                    const sData = docSnap.data() as any;
                    addPotentialPassword(sData.senha);
                    addPotentialPassword(sData.responsavel?.cpf);

                    if (sData.alunos && Array.isArray(sData.alunos)) {
                        sData.alunos.forEach((aluno: any) => addPotentialPassword(aluno.cpf));
                    }

                    const sCpfClean = (sData.responsavel?.cpf || '').replace(/\D/g, '');
                    const hasMatchWithInput = (sData.senha && sData.senha === password) ||
                        (sCpfClean && sCpfClean === cleanPassword);

                    if (hasMatchWithInput) {
                        matchType = 'student';
                        matchDocId = docSnap.id;
                    }
                });

                if (matchType && matchDocId) {
                    // WE HAVE A MATCH IN FIRESTORE!
                    // If Auth failed, we should sync Auth with the entered password.
                    showLoading(5000, 'Sincronizando credenciais...');

                    try {
                        const payload: any = {
                            newPassword: password,
                            [matchType === 'teacher' ? 'teacherId' : 'registrationId']: matchDocId
                        };

                        const endpoint = matchType === 'teacher' ? '/update-teacher-credentials' : '/update-student-credentials';

                        // Abort fetch after 8 seconds to prevent infinite hang
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 8000);

                        const response = await fetch(`${workerUrl}${endpoint}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                            signal: controller.signal
                        });
                        clearTimeout(timeoutId);

                        const result = await response.json();
                        if (response.ok && result.success) {
                            console.log("DEBUG: Auth synced successfully. Retrying login...");
                            // Retry login after sync
                            try {
                                await signInWithEmailAndPassword(auth, normalizedEmail, password);
                                await proceedToDashboard(normalizedEmail);
                                return;
                            } catch (retryErr) {
                                console.error("DEBUG: Retry login after sync failed:", retryErr);
                            }
                        } else {
                            console.error("DEBUG: Sync endpoint returned error:", result);
                        }
                    } catch (syncError: any) {
                        console.error("DEBUG: Sync failed:", syncError);
                        if (syncError.name === 'AbortError') {
                            console.error("DEBUG: Sync request timed out after 8s");
                        }
                    }
                }

                // Fallback: try harvested passwords (maybe it's a first access with default)
                for (const p of Array.from(potentialPasswords)) {
                    try {
                        await signInWithEmailAndPassword(auth, normalizedEmail, p);
                        await proceedToDashboard(normalizedEmail);
                        return;
                    } catch (e) { /* ignore */ }
                }

                // Create account if match found but no Auth exist
                if (matchType) {
                    try {
                        const finalPasswordToCreate = password.trim().length >= 6 ? password.trim() : (cleanPassword.length >= 11 ? cleanPassword : password);
                        await createUserWithEmailAndPassword(auth, normalizedEmail, finalPasswordToCreate);
                        showAlert("Primeiro acesso confirmado! Sua conta foi criada.", "success");
                        await proceedToDashboard(normalizedEmail);
                        return;
                    } catch (createError: any) {
                        if (createError.code === 'auth/email-already-in-use') {
                            showAlert("Acesso não autorizado ou senha incorreta. Se você esqueceu sua senha, contate a secretaria.", "error");
                            return;
                        }
                        throw createError;
                    }
                }
            }

            showAlert("Dados não conferem ou cadastro não encontrado.", "error");

        } catch (error: any) {
            console.error('Login error:', error);
            showAlert('Erro no sistema: ' + error.message, 'error');
        } finally {
            loginAttemptStarted.current = false;
            setLoading(false);
        }
    };

    if (checkingSavedSession) {
        return (
            <div
                className="landing-page"
                style={{
                    minHeight: '100vh',
                    display: 'grid',
                    placeItems: 'center',
                    padding: '24px',
                    textAlign: 'center'
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', color: '#17428f' }}>
                    <img
                        src="/pwa/icon-192.png"
                        alt=""
                        aria-hidden="true"
                        style={{ width: '76px', height: '76px', borderRadius: '18px' }}
                    />
                    <strong>Restaurando seu acesso...</strong>
                </div>
            </div>
        );
    }

    return (
        <div className="landing-page" style={{ padding: '20px' }}>
            <div className="landing-content" style={{
                padding: '0',
                maxWidth: '980px',
                width: '100%',
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                overflow: 'hidden',
                background: '#fff',
                alignItems: 'stretch',
                border: '1px solid rgba(255,255,255,0.28)',
                boxShadow: '0 30px 80px rgba(6, 26, 64, 0.32)'
            }}>
                {/* Left Side: Brand */}
                <div style={{
                    flex: '1 1 300px',
                    background: 'radial-gradient(circle at 20% 12%, rgba(244, 194, 13, 0.32), transparent 30%), radial-gradient(circle at 82% 20%, rgba(0, 166, 58, 0.24), transparent 28%), linear-gradient(135deg, #17428f 0%, #09245c 100%)',
                    padding: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: 'min(280px, 82%)',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        boxShadow: '0 22px 48px rgba(6, 26, 64, 0.28)'
                    }}>
                        <img src="/rumo-ao-esporte-logo.png" alt="Rumo ao Esporte" style={{ width: '100%', height: 'auto', borderRadius: '8px', display: 'block' }} />
                    </div>
                    <h1 style={{ fontSize: '1.85rem', fontWeight: '900', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Área do Usuário</h1>
                    <p style={{ opacity: 0.92, maxWidth: '320px', lineHeight: 1.5 }}>Portal do aluno, responsável e professor.</p>
                </div>

                {/* Right Side: Form */}
                <div style={{
                    flex: '1 1 400px',
                    padding: '50px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)'
                }}>
                    <h2 style={{ color: '#10213f', marginBottom: '8px', fontWeight: '900', fontSize: '1.6rem' }}>Acesso ao portal</h2>
                    <p style={{ margin: '0 0 28px', color: '#63708a', fontSize: '0.95rem' }}>Entre para acompanhar pagamentos, dados, turmas e comunicação.</p>

                    <form
                        onSubmit={handleLogin}
                        autoComplete="on"
                        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}
                    >
                        <div className="form-group" style={{ width: '100%' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#17428f', fontSize: '0.82rem', fontWeight: '800' }}>Nome completo do responsável</label>
                            <input
                                type="text"
                                value={loginInput}
                                onChange={e => setLoginInput(e.target.value)}
                                required
                                placeholder="Ex: Maria da Silva"
                                autoCapitalize="words"
                                autoComplete="username"
                                name="username"
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '8px',
                                    border: '2px solid #dce7f3',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'border-color 0.3s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#17428f'}
                                onBlur={(e) => e.target.style.borderColor = '#dce7f3'}
                            />
                            <span style={{ display: 'block', marginTop: '6px', color: '#95a1b8', fontSize: '0.75rem' }}>
                                Professores e funcionários: use seu e-mail de cadastro.
                            </span>
                        </div>

                        <div className="form-group" style={{ width: '100%' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#17428f', fontSize: '0.82rem', fontWeight: '800' }}>Senha</label>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    name="password"
                                    style={{
                                        width: '100%',
                                        padding: '14px',
                                        paddingRight: '46px',
                                        borderRadius: '8px',
                                        border: '2px solid #dce7f3',
                                        fontSize: '1rem',
                                        outline: 'none',
                                        transition: 'border-color 0.3s',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#17428f'}
                                    onBlur={(e) => e.target.style.borderColor = '#dce7f3'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(prev => !prev)}
                                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        padding: '4px',
                                        cursor: 'pointer',
                                        color: '#63708a',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <RememberSessionCheckbox
                            id="student-keep-signed-in"
                            checked={keepSignedIn}
                            onChange={setKeepSignedIn}
                        />

                        <div style={{
                            display: 'flex', gap: '8px', padding: '10px 12px',
                            background: '#fff9e6', border: '1px solid #ffeeba', borderRadius: '8px'
                        }}>
                            <span style={{ fontSize: '0.78rem', color: '#856404', lineHeight: 1.4 }}>
                                <strong>Primeiro acesso?</strong> Use seu CPF (somente números) como senha. Depois você pode trocá-la em Configurações.
                            </span>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '15px',
                                fontSize: '1rem',
                                marginTop: '10px',
                                color: '#fff',
                                background: 'linear-gradient(135deg, #17428f 0%, #00a63a 100%)',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '700',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.8 : 1,
                                boxShadow: '0 14px 28px rgba(23, 66, 143, 0.24)',
                                transition: 'all 0.3s'
                            }}
                            onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                            onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
                        >
                            {loading ? 'Verificando...' : 'ACESSAR PORTAL'}
                        </button>
                    </form>

                    <div style={{ marginTop: '30px', textAlign: 'center' }}>
                        <a href="/" style={{ color: '#63708a', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 700 }} onMouseOver={e => e.currentTarget.style.color = '#17428f'} onMouseOut={e => e.currentTarget.style.color = '#63708a'}>
                            ← Voltar ao Início
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
