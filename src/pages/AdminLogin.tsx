import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useDialog } from '../context/CustomDialogContext';
import { useLoading } from '../components/LoadingService';
import RememberSessionCheckbox from '../components/RememberSessionCheckbox';
import { configureAuthPersistence } from '../utils/authPersistence';
import { DIRETORIA_EMAIL, DIRETORIA_PROFILE, DIRETORIA_PASSWORD, isDiretoriaEmail } from '../config/accessProfiles';
import { authenticateTeacher, isResponsibleEmail } from '../utils/teacherAuth';
import { authenticateEmployee } from '../utils/employeeAuth';
import { syncStaffAccess } from '../utils/staffAccess';
import '../App.css';

const MAIN_ADMIN_EMAIL = ((import.meta.env.VITE_MAIN_ADMIN_EMAIL as string) || 'rumoaoesporte@admin.com').trim().toLowerCase();


export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [keepSignedIn, setKeepSignedIn] = useState(() => localStorage.getItem('rae_admin_keep_signed_in') !== 'false');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { showAlert } = useDialog();
    const { showLoading } = useLoading();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const normalizedEmail = email.trim().toLowerCase();

        try {
            await configureAuthPersistence(auth, keepSignedIn);
            localStorage.setItem('rae_admin_keep_signed_in', String(keepSignedIn));

            if (keepSignedIn) {
                sessionStorage.removeItem('rae_admin_session_active');
            } else {
                sessionStorage.setItem('rae_admin_session_active', 'true');
            }
        } catch (error) {
            console.error('Admin persistence error:', error);
            showAlert('Não foi possível configurar a duração da sessão. Tente novamente.', 'error');
            setLoading(false);
            return;
        }

        // 0. Perfil "Diretoria" (login fixo compartilhado, acesso restrito).
        // A senha é fixa e definida aqui no código, mas por trás disso também
        // abrimos uma sessão real no Firebase Auth (mesma conta sempre) — sem
        // isso, o acesso da diretoria seria anônimo para o Firestore, e as
        // regras de segurança não teriam como reconhecê-lo.
        if (isDiretoriaEmail(normalizedEmail) && password.trim() === DIRETORIA_PASSWORD) {
            try {
                try {
                    await signInWithEmailAndPassword(auth, DIRETORIA_EMAIL, DIRETORIA_PASSWORD);
                } catch {
                    await createUserWithEmailAndPassword(auth, DIRETORIA_EMAIL, DIRETORIA_PASSWORD);
                }
                await syncStaffAccess(DIRETORIA_EMAIL, true, 'diretoria');
            } catch (error) {
                console.error('Erro ao autenticar sessão da diretoria:', error);
                showAlert('Não foi possível acessar. Tente novamente.', 'error');
                setLoading(false);
                return;
            }

            localStorage.setItem('rae_admin_auth', JSON.stringify(DIRETORIA_PROFILE));
            showLoading(3000, 'Acessando Painel da Diretoria...');
            setTimeout(() => {
                navigate('/admin/aniversariantes');
            }, 3000);
            setLoading(false);
            return;
        }

        try {
            // 1. Professores entram com o mesmo e-mail/senha do cadastro e vão
            // para o portal deles. Vem antes do Firebase Auth porque professor
            // com conta no Auth cairia no painel administrativo por engano.
            const teacherResult = await authenticateTeacher(normalizedEmail, password);

            if (teacherResult.status === 'inactive') {
                showAlert('Seu acesso de professor está desativado. Entre em contato com a secretaria.', 'error');
                setLoading(false);
                return;
            }

            if (teacherResult.status === 'authenticated') {
                showLoading(3000, `Bem-vindo(a), ${teacherResult.nome?.split(' ')[0] || 'Professor'}!`);
                setTimeout(() => {
                    navigate('/professor/turmas');
                }, 3000);
                setLoading(false);
                return;
            }

            if (teacherResult.status === 'wrong-password') {
                showAlert('Senha incorreta. Confira a senha cadastrada com a secretaria.', 'error');
                setLoading(false);
                return;
            }

            if (teacherResult.status === 'auth-out-of-sync') {
                showAlert('Não foi possível entrar com a senha do cadastro. Peça à secretaria para redefinir sua senha para rumo2026 e tente de novo.', 'error');
                setLoading(false);
                return;
            }

            // 2. Funcionários com acesso administrativo (coleção employees).
            // Mesmo padrão do professor: a senha cadastrada é a fonte da verdade,
            // e por trás disso mantemos uma sessão real no Firebase Auth.
            const employeeResult = await authenticateEmployee(normalizedEmail, password);

            if (employeeResult.status === 'inactive') {
                showAlert('Seu acesso está desativado. Entre em contato com a administração.', 'error');
                setLoading(false);
                return;
            }

            if (employeeResult.status === 'wrong-password') {
                showAlert('Senha incorreta.', 'error');
                setLoading(false);
                return;
            }

            if (employeeResult.status === 'authenticated') {
                const employeeData = employeeResult.employee;
                if (normalizedEmail === MAIN_ADMIN_EMAIL) {
                    localStorage.setItem('rae_admin_auth', 'true');
                } else {
                    localStorage.setItem('rae_admin_auth', JSON.stringify(employeeData));
                }

                showLoading(3000, `Bem-vindo(a), ${employeeData.nome?.split(' ')[0] || 'Funcionário'}!`);
                setTimeout(() => {
                    navigate('/admin/stats');
                }, 3000);
                setLoading(false);
                return;
            }

            // 3. Administração autenticada pelo Firebase Auth.
            try {
                await signInWithEmailAndPassword(auth, normalizedEmail, password);
            } catch (authError: any) {
                console.log('Firebase Auth falhou:', authError?.code);
                showAlert('Credenciais inválidas ou acesso não autorizado.', 'error');
                setLoading(false);
                return;
            }

            // Ter conta no Firebase Auth não é permissão de administrador: todo
            // responsável do portal tem uma. Sem esta checagem, qualquer pai
            // entraria no painel usando o mesmo login do portal do aluno.
            // Quem está cadastrado em 'employees' é equipe e passa direto.
            const isRegisteredEmployee = !(await getDocs(query(
                collection(db, 'employees'),
                where('email', '==', normalizedEmail)
            ))).empty;

            if (normalizedEmail !== MAIN_ADMIN_EMAIL && !isRegisteredEmployee && await isResponsibleEmail(normalizedEmail)) {
                await auth.signOut();
                localStorage.removeItem('rae_admin_auth');
                showAlert('Este acesso é do portal do responsável. Entre em rumoaoesporte.com.br/aluno/login.', 'info');
                setTimeout(() => navigate('/aluno/login'), 2500);
                setLoading(false);
                return;
            }

            localStorage.setItem('rae_admin_auth', 'true');
            showLoading(3000, 'Acessando Painel Administrativo...');
            setTimeout(() => {
                navigate('/admin/stats');
            }, 3000);
        } catch (error: any) {
            console.error('Erro no login administrativo:', error);
            showAlert(error.message || 'Erro ao realizar login.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="landing-page" style={{ padding: '20px' }}>
            <div className="landing-content" style={{
                padding: '0',
                maxWidth: '980px',
                width: '100%',
                display: 'flex',
                flexDirection: 'row', // Default row (desktop)
                flexWrap: 'wrap', // Allow wrap for mobile
                overflow: 'hidden',
                background: '#fff',
                alignItems: 'stretch', // Ensure full height for both sides
                border: '1px solid rgba(255,255,255,0.28)',
                boxShadow: '0 30px 80px rgba(6, 26, 64, 0.32)'
            }}>
                {/* Left Side: Brand (Visible on desktop, top on mobile) */}
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
                        <img src="/rumo-ao-esporte-logo.png" alt="Rumo ao Esporte" style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: '8px', display: 'block' }} />
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Painel Rumo ao Esporte</h1>
                    <p style={{ opacity: 0.92, maxWidth: '320px', lineHeight: 1.5 }}>Gestão organizada para matrículas, turmas, financeiro e comunicação.</p>
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
                    <h2 style={{ color: '#10213f', marginBottom: '8px', fontWeight: '900', fontSize: '1.6rem' }}>Login administrativo</h2>
                    <p style={{ margin: '0 0 28px', color: '#63708a', fontSize: '0.95rem' }}>Acesse o centro de controle do projeto.</p>

                    <form
                        onSubmit={handleLogin}
                        autoComplete="on"
                        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}
                    >
                        <div className="form-group" style={{ width: '100%' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#17428f', fontSize: '0.82rem', fontWeight: '800' }}>Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                placeholder="seu@email.com"
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
                            id="admin-keep-signed-in"
                            checked={keepSignedIn}
                            onChange={setKeepSignedIn}
                        />

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '15px',
                                fontSize: '1rem',
                                marginTop: '10px',
                                color: '#fff',
                                background: 'linear-gradient(135deg, #00a63a 0%, #17428f 100%)',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '700',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.8 : 1,
                                boxShadow: '0 14px 28px rgba(0, 166, 58, 0.24)',
                                transition: 'all 0.3s'
                            }}
                            onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                            onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
                        >
                            {loading ? 'Entrando...' : 'ACESSAR SISTEMA'}
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
