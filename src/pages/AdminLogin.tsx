import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useDialog } from '../context/CustomDialogContext';
import { useLoading } from '../components/LoadingService';
import '../App.css';

const MAIN_ADMIN_EMAIL = ((import.meta.env.VITE_MAIN_ADMIN_EMAIL as string) || 'rumoaoesporte@admin.com').trim().toLowerCase();


export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { showAlert } = useDialog();
    const { showLoading } = useLoading();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const normalizedEmail = email.trim().toLowerCase();

        try {
            // 1. Try Firebase Auth (Main Admin)
            await signInWithEmailAndPassword(auth, normalizedEmail, password);
            localStorage.setItem('rae_admin_auth', 'true'); // Legacy/Simple flag for main admin

            console.log("DEBUG: Login ADMIN sucesso. Disparando loading...");
            showLoading(3000, 'Acessando Painel Administrativo...');
            setTimeout(() => {
                navigate('/admin/dashboard');
            }, 3000);
        } catch (authError: any) {
            console.log("Firebase Auth failed, checking Employee DB...", authError);

            // 2. If blocked or not found, try Employee Collection
            try {
                const q = query(
                    collection(db, 'employees'),
                    where('email', '==', normalizedEmail),
                    where('senha', '==', password), // Plain text match
                    where('active', '==', true)
                );
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const employeeDoc = snapshot.docs[0];
                    const employeeData = { id: employeeDoc.id, ...employeeDoc.data() } as any;

                    // Store full employee object in auth
                    if (normalizedEmail === MAIN_ADMIN_EMAIL) {
                        localStorage.setItem('rae_admin_auth', 'true');
                    } else {
                        localStorage.setItem('rae_admin_auth', JSON.stringify(employeeData));
                    }

                    showLoading(3000, `Bem-vindo(a), ${employeeData.nome?.split(' ')[0] || 'Funcionário'}!`);
                    setTimeout(() => {
                        navigate('/admin/dashboard');
                    }, 3000);
                } else {
                    // Both failed
                    throw new Error('Credenciais inválidas ou acesso não autorizado.');
                }
            } catch (dbError: any) {
                console.error('Employee Login error:', dbError);
                showAlert(dbError.message || 'Erro ao realizar login.', 'error');
            }
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

                    <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="form-group" style={{ width: '100%' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#17428f', fontSize: '0.82rem', fontWeight: '800' }}>Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                placeholder="seu@email.com"
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
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
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
