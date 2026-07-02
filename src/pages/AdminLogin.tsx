import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useDialog } from '../context/CustomDialogContext';
import { useLoading } from '../components/LoadingService';
import '../App.css';

const MAIN_ADMIN_EMAIL = 'arenasimonesia@admin.com';


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
            localStorage.setItem('uba_admin_auth', 'true'); // Legacy/Simple flag for main admin

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
                        localStorage.setItem('uba_admin_auth', 'true');
                    } else {
                        localStorage.setItem('uba_admin_auth', JSON.stringify(employeeData));
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
                maxWidth: '900px',
                width: '100%',
                display: 'flex',
                flexDirection: 'row', // Default row (desktop)
                flexWrap: 'wrap', // Allow wrap for mobile
                overflow: 'hidden',
                background: '#fff',
                alignItems: 'stretch' // Ensure full height for both sides
            }}>
                {/* Left Side: Brand (Visible on desktop, top on mobile) */}
                <div style={{
                    flex: '1 1 300px',
                    background: 'linear-gradient(135deg, #007d2f 0%, #00451d 100%)',
                    padding: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '180px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <img src="/arena-logo-transparent.png" alt="Arena Simonésia" style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: '8px' }} />
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '10px', textTransform: 'uppercase' }}>Admin Arena Simonésia</h1>
                    <p style={{ opacity: 0.9 }}>Gestão de Inscrições 2026</p>
                </div>

                {/* Right Side: Form */}
                <div style={{
                    flex: '1 1 400px',
                    padding: '50px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    background: '#fff'
                }}>
                    <h2 style={{ color: '#333', marginBottom: '30px', fontWeight: '700', fontSize: '1.5rem' }}>Login</h2>

                    <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="form-group" style={{ width: '100%' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '0.9rem', fontWeight: '600' }}>Email</label>
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
                                    border: '2px solid #eee',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'border-color 0.3s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#007d2f'}
                                onBlur={(e) => e.target.style.borderColor = '#eee'}
                            />
                        </div>

                        <div className="form-group" style={{ width: '100%' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '0.9rem', fontWeight: '600' }}>Senha</label>
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
                                    border: '2px solid #eee',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'border-color 0.3s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#007d2f'}
                                onBlur={(e) => e.target.style.borderColor = '#eee'}
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
                                background: '#007d2f',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '700',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.8 : 1,
                                boxShadow: '0 4px 15px rgba(0, 125, 47, 0.3)',
                                transition: 'all 0.3s'
                            }}
                            onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                            onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
                        >
                            {loading ? 'Entrando...' : 'ACESSAR SISTEMA'}
                        </button>
                    </form>

                    <div style={{ marginTop: '30px', textAlign: 'center' }}>
                        <a href="/" style={{ color: '#888', fontSize: '0.9rem', textDecoration: 'none' }} onMouseOver={e => e.currentTarget.style.color = '#007d2f'} onMouseOut={e => e.currentTarget.style.color = '#888'}>
                            ← Voltar ao Início
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
