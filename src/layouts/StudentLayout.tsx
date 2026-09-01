import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { isRunningAsInstalledApp, openPWAInstallPrompt } from '../utils/pwaInstall';
import { configureAuthPersistence } from '../utils/authPersistence';
import {
    clearResponsavelKey,
    fetchResponsavelRegistrations,
    getSessionStudentEmail
} from '../utils/responsavelIdentity';
import '../App.css';
import {
    Settings,
    MessageCircle,
    LogOut,
    Menu,
    X,
    User,
    Users,
    History,
    Lock,
    Instagram,
    Home,
    ChevronRight,
    DollarSign,
    QrCode,
    Clock,
    Store,
    Download,
    FileSignature,
    CreditCard,
    Handshake
} from 'lucide-react';

const MAIN_ADMIN_EMAIL = ((import.meta.env.VITE_MAIN_ADMIN_EMAIL as string) || 'rumoaoesporte@admin.com').trim().toLowerCase();

export default function StudentLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [collapsed, setCollapsed] = useState(false);
    const [studentName, setStudentName] = useState('Aluno / Responsável');
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [selectedStudentIndex, setSelectedStudentIndex] = useState(0);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [isInstalledApp] = useState(isRunningAsInstalledApp);
    const [checkingSavedSession, setCheckingSavedSession] = useState(true);

    const [storeEnabled, setStoreEnabled] = useState(false);

    useEffect(() => {
        const fetchSystemStatus = async () => {
            try {


                const snapStore = await getDoc(doc(db, 'system_settings', 'store'));
                if (snapStore.exists()) setStoreEnabled(snapStore.data().enabled);
            } catch (err) {
                console.error("Error fetching system status", err);
            }
        };
        fetchSystemStatus();
    }, []);


    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Security Check
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            const impersonatedEmail = localStorage.getItem('rae_impersonated_student_email');
            if (impersonatedEmail) {
                // Skip normal security redirects while impersonating
                setCheckingSavedSession(false);
                return;
            }

            const localAuth = localStorage.getItem('rae_student_auth');
            const currentEmail = user?.email?.toLowerCase().trim();

            if (currentEmail === MAIN_ADMIN_EMAIL) {
                localStorage.removeItem('rae_student_auth');
                localStorage.removeItem('rae_teacher_auth');
                localStorage.setItem('rae_admin_auth', 'true');
                // Sessão Firebase viva no relançamento => persistência durável.
                // Cura um 'false' antigo que faria o main.tsx derrubar o admin.
                if (sessionStorage.getItem('rae_admin_session_active') !== 'true') {
                    localStorage.setItem('rae_admin_keep_signed_in', 'true');
                }
                navigate('/admin/dashboard');
                return;
            }

            // Sessão de admin/funcionário/diretoria salva: envia para o painel correto
            // em vez de derrubar a sessão (o PWA abre em /aluno/dashboard para todos).
            if (localStorage.getItem('rae_admin_auth')) {
                navigate('/admin/dashboard', { replace: true });
                return;
            }

            // Sessão de professor salva: idem, redireciona sem deslogar.
            if (localStorage.getItem('rae_teacher_auth')) {
                navigate('/professor/turmas', { replace: true });
                return;
            }

            if (!user) {
                localStorage.removeItem('rae_student_auth');
                navigate('/aluno/login');
                return;
            }

            if (!localAuth) {
                localStorage.setItem('rae_student_auth', 'true');
            }

            const shouldKeepSession = localStorage.getItem('rae_keep_signed_in') !== 'false';
            try {
                await configureAuthPersistence(auth, shouldKeepSession);
            } catch (error) {
                console.error('Session persistence restore error:', error);
            } finally {
                setCheckingSavedSession(false);
            }
        });

        return unsubscribe;
    }, [navigate]);

    // Fetch basic info
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            const impersonatedEmail = localStorage.getItem('rae_impersonated_student_email');
            const normalizedEmail = getSessionStudentEmail(user?.email);
            if (normalizedEmail) {
                try {
                    const registrationDocs = await fetchResponsavelRegistrations(normalizedEmail);

                    const studentsAggregated: any[] = [];
                    let firstName = 'Aluno';

                    if (registrationDocs.length > 0) {
                        registrationDocs.forEach((doc) => {
                            const data = doc.data();
                            if (data.responsavel && data.responsavel.nome) {
                                firstName = data.responsavel.nome.split(' ')[0];
                            }

                            if (data.alunos && Array.isArray(data.alunos)) {
                                data.alunos.forEach((aluno: any) => {
                                    studentsAggregated.push({
                                        ...aluno,
                                        parentCota: data.numeroCota,
                                        contractGenerated: data.contractGenerated !== false // Default to true for legacy data
                                    });
                                });
                            }
                        });
                    }

                    setStudentName(firstName);
                    setAllStudents(studentsAggregated);

                    // SIGNATURE CHECK: Only check for students who HAVE a generated contract but haven't signed yet
                    const hasPendingSignature = studentsAggregated.some(s => s.contractGenerated && !s.signatureData);
                    if (hasPendingSignature && !impersonatedEmail) {
                        navigate('/aluno/contrato-obrigatorio');
                    }

                } catch (error) {
                    console.error("Error fetching info:", error);
                }
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    // Generate QR Code
    useEffect(() => {
        const generateQR = async () => {
            const student = allStudents[selectedStudentIndex];
            if (student) {
                try {
                    const cpfToUse = student.cpf || student.parentResponsavel?.cpf || '000.000.000-00';
                    const data = `${cpfToUse}|${student.dataNascimento || ''}|${student.nome}`;
                    const url = await QRCode.toDataURL(data, { margin: 1, width: 256 });
                    setQrCodeUrl(url);
                } catch (err) {
                    console.error("Error generating QR code:", err);
                }
            }
        };
        generateQR();
    }, [allStudents, selectedStudentIndex]);




    const handleLogout = async () => {
        await signOut(auth);
        localStorage.removeItem('rae_student_auth');
        localStorage.removeItem('rae_impersonated_student_email');
        localStorage.removeItem('rae_impersonated_student_back_id');
        clearResponsavelKey();
        navigate('/aluno/login');
    };

    const NavItem = ({ to, label, icon, badge, subItems }: any) => {
        const normalizePath = (p: string) => p.endsWith('/') ? p.slice(0, -1) : p;
        const currentPath = normalizePath(location.pathname);
        const targetPath = normalizePath(to);

        const isPathActive = currentPath === targetPath || (targetPath !== '/aluno/dashboard' && currentPath.startsWith(`${targetPath}/`)) || (targetPath !== '/aluno/dashboard' && currentPath === targetPath);

        const isSubItemActive = subItems?.some((sub: any) => {
            const subTo = normalizePath(sub.to);
            return currentPath === subTo || currentPath.startsWith(`${subTo}/`);
        });

        const isActive = isPathActive || isSubItemActive;

        const [isOpen, setIsOpen] = useState(isActive);

        useEffect(() => {
            if (isActive) setIsOpen(true);
        }, [isActive]);

        if (subItems) {
            return (
                <>
                    <div style={{ marginBottom: '4px', padding: collapsed ? '0 5px' : '0 10px' }}>
                        <button
                            className="touch-feedback"
                            onClick={() => {
                                if (collapsed) {
                                    navigate(to);
                                } else {
                                    setIsOpen(!isOpen);
                                }
                            }}
                            title={collapsed ? label : ''}
                            style={{
                                width: '100%',
                                padding: collapsed ? '12px 0' : '8px 16px',
                                border: 'none',
                                background: isActive ? '#eef8ff' : 'transparent',
                                color: isActive ? '#00a63a' : '#17428f',
                                textAlign: collapsed ? 'center' : 'left',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                gap: collapsed ? '0' : '10px',
                                borderRadius: '6px'
                            }}
                        >
                            <span style={{ color: isActive ? '#00a63a' : '#17428f', display: 'flex' }}>{icon}</span>
                            {!collapsed && <span style={{ flex: 1, textTransform: 'uppercase' }}>{label}</span>}
                            {!collapsed && <ChevronRight size={16} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />}
                        </button>
                        {isOpen && !collapsed && (
                            <div style={{ paddingLeft: '20px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {subItems.map((sub: any) => {
                                    const isSubActive = location.pathname === sub.to;
                                    return (
                                        <button
                                            key={sub.to}
                                            onClick={() => {
                                                navigate(sub.to);
                                                if (isMobile) setSidebarOpen(false);
                                            }}
                                            style={{
                                                padding: '6px 15px',
                                                border: 'none',
                                                background: isSubActive ? '#00a63a' : 'transparent',
                                                color: isSubActive ? '#fff' : '#17428f',
                                                borderRadius: '6px',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                fontSize: '0.78rem',
                                                fontWeight: isSubActive ? '700' : '500',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            <div style={{ width: '6px', height: '6px', background: isSubActive ? '#fff' : '#17428f', borderRadius: '50%', opacity: isSubActive ? 1 : 0.4 }} />
                                            <span style={{ textTransform: 'uppercase' }}>{sub.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {!collapsed && <div style={{ height: '1px', background: 'rgba(23, 66, 143, 0.10)', margin: '4px -10px' }} />}
                </>
            );
        }

        return (
            <div style={{ marginBottom: '4px', padding: collapsed ? '0 5px' : '0 10px' }}>
                <button
                    className="touch-feedback"
                    onClick={() => {
                        navigate(to);
                        if (isMobile) setSidebarOpen(false);
                    }}
                    title={collapsed ? label : ''}
                    style={{
                        width: '100%',
                        padding: collapsed ? '12px 0' : '8px 16px',
                        border: 'none',
                        background: isActive ? '#00a63a' : 'transparent',
                        color: isActive ? '#fff' : '#17428f',
                        textAlign: collapsed ? 'center' : 'left',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: isActive ? '700' : '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        gap: collapsed ? '0' : '10px',
                        minHeight: '36px',
                        borderRadius: '6px'
                    }}
                    onMouseOver={e => !isActive && (e.currentTarget.style.background = '#f0f4ff')}
                    onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
                >
                    <span style={{ color: isActive ? '#fff' : '#17428f', display: 'flex' }}>{icon}</span>
                    {!collapsed && <span style={{ flex: 1, textTransform: 'uppercase' }}>{label}</span>}
                    {badge > 0 && !collapsed && (
                        <span style={{
                            background: isActive ? '#fff' : '#17428f',
                            color: isActive ? '#00a63a' : '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            borderRadius: '10px'
                        }}>
                            {badge}
                        </span>
                    )}
                </button>
                {!collapsed && <div style={{ height: '1px', background: 'rgba(23, 66, 143, 0.10)', margin: '4px -10px' }} />}
            </div>
        );
    };

    // Bottom Sheet State
    const [activeSheet, setActiveSheet] = useState<'menu' | 'gate' | null>(null);

    // Close sheet when navigating
    useEffect(() => {
        setActiveSheet(null);
    }, [location.pathname]);

    // Responsive Panel (Drawer on Desktop, Bottom Sheet on Mobile)
    const ResponsivePanel = ({ title, children, onClose }: any) => (
        <>
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.4)',
                    zIndex: 400,
                    backdropFilter: 'blur(3px)'
                }}
            />
            <div className={isMobile ? "animate-slide-up" : "animate-slide-left"} style={{
                position: 'fixed',
                bottom: isMobile ? 0 : 'auto',
                top: isMobile ? 'auto' : 0,
                right: 0,
                left: isMobile ? 0 : 'auto',
                width: isMobile ? '100%' : '400px',
                height: isMobile ? 'auto' : '100vh',
                background: '#f8f9fa',
                borderTopLeftRadius: isMobile ? '20px' : '0',
                borderTopRightRadius: isMobile ? '20px' : '0',
                padding: '20px',
                paddingBottom: isMobile ? '80px' : '20px',
                zIndex: 401,
                maxHeight: isMobile ? '85vh' : '100vh',
                overflowY: 'auto',
                boxShadow: isMobile ? '0 -4px 20px rgba(0,0,0,0.1)' : '-4px 0 20px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: '#17428f', fontSize: '1.2rem', textTransform: 'uppercase' }}>{title}</h3>
                    <button onClick={onClose} style={{ background: '#eee', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}>
                        <X size={20} color="#555" />
                    </button>
                </div>
                {children}
            </div>
        </>
    );

    const MenuGridItem = ({ icon: Icon, label, onClick, link }: any) => (
        <div
            onClick={() => {
                if (link) navigate(link);
                if (onClick) onClick();
            }}
            className="touch-feedback"
            style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '16px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                border: '1px solid rgba(238, 242, 255, 0.8)',
                cursor: 'pointer',
                textAlign: 'center',
                aspectRatio: '1/1',
                transition: 'all 0.2s ease'
            }}
        >
            <div style={{ color: '#00a63a', background: '#eef8ff', padding: '12px', borderRadius: '14px', display: 'flex' }}>
                <Icon size={22} strokeWidth={2.5} />
            </div>
            <span style={{
                fontSize: '0.68rem',
                fontWeight: '800',
                color: '#334155',
                lineHeight: '1.2',
                textTransform: 'uppercase',
                maxWidth: '100%'
            }}>
                {label}
            </span>
        </div>
    );

    if (checkingSavedSession) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                padding: '24px',
                background: 'linear-gradient(180deg, #f4f8fc 0%, #eef8ff 100%)',
                color: '#17428f',
                textAlign: 'center'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
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
        <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(180deg, #f4f8fc 0%, #eef8ff 100%)', flexDirection: 'column' }}>
            {localStorage.getItem('rae_impersonated_student_email') && (
                <div style={{
                    background: '#1e293b',
                    color: '#fff',
                    padding: '10px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    position: 'sticky',
                    top: 0,
                    zIndex: 9999,
                    borderBottom: '2px solid #ef4444'
                }}>
                    <span>👁️ MODO VISUALIZAÇÃO: Simulando acesso do atleta ({studentName})</span>
                    <button
                        onClick={async () => {
                            localStorage.removeItem('rae_impersonated_student_email');
                            clearResponsavelKey();
                            const backId = localStorage.getItem('rae_impersonated_student_back_id');
                            if (backId) {
                                localStorage.removeItem('rae_impersonated_student_back_id');
                                window.location.href = `/admin/details/${backId}`;
                            } else {
                                window.location.href = '/admin/dashboard';
                            }
                        }}
                        style={{
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
                    >
                        Voltar ao Painel
                    </button>
                </div>
            )}

            {/* Mobile Header (Only visible on mobile) */}
            {isMobile && (
                <div style={{
                    padding: '15px 20px',
                    background: 'linear-gradient(135deg, #17428f 0%, #09245c 100%)',
                    borderBottom: '1px solid rgba(255,255,255,0.14)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    zIndex: 90
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src="/rumo-ao-esporte-logo.png" alt="Rumo ao Esporte" style={{ height: '34px', borderRadius: '6px' }} />
                        <span style={{ fontWeight: 'bold', color: '#fff' }}>ÁREA DO ALUNO</span>
                    </div>
                    {/* User Avatar Placeholder */}
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f4c20d', color: '#09245c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                        {studentName.charAt(0)}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flex: 1, position: 'relative', paddingBottom: '70px' }}>
                {/* Sidebar Overlay (Desktop Mobile behavior kept for compatibility, though hidden normally by Nav) */}
                {isMobile && sidebarOpen && (
                    <div
                        onClick={() => setSidebarOpen(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
                    />
                )}

                {/* Sidebar (Desktop Only) */}
                {!isMobile && (
                    <aside style={{
                        width: collapsed ? '80px' : '260px',
                        background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
                        borderRight: '1px solid #dce7f3',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'sticky',
                        top: 0,
                        height: '100vh',
                        zIndex: 100,
                        transition: 'all 0.3s ease'
                    }}>
                        {/* Sidebar Header */}
                        <div style={{ width: '100%', borderBottom: '1px solid #dce7f3', overflow: 'hidden', padding: collapsed ? '8px' : '14px', background: 'radial-gradient(circle at 22% 8%, rgba(244, 194, 13, 0.24), transparent 34%), linear-gradient(135deg, #17428f 0%, #09245c 100%)' }}>
                            <img src="/rumo-ao-esporte-logo.png" alt="Rumo ao Esporte" style={{ width: '100%', display: 'block', objectFit: 'contain', height: collapsed ? '56px' : 'auto', borderRadius: '8px', boxShadow: collapsed ? 'none' : '0 14px 28px rgba(6, 26, 64, 0.28)' }} />
                        </div>

                        {/* Nav */}
                        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
                            <NavItem to="/aluno/dashboard" label="Meu Atleta" icon={<Home size={20} />} />
                            <NavItem to="/aluno/perfil" label="Meus Dados" icon={<User size={20} />} />
                            <NavItem to="/aluno/carteirinha" label="Carteirinha" icon={<CreditCard size={20} />} />
                            <NavItem to="/aluno/financeiro" label="Pagamentos" icon={<DollarSign size={20} />} />
                            <NavItem to="/aluno/autorizacoes" label="Autorizações" icon={<FileSignature size={20} />} />
                            {storeEnabled && <NavItem to="/aluno/loja" label="Loja do Clube" icon={<Store size={20} />} />}
                            <NavItem to="/aluno/horarios" label="Horários" icon={<Clock size={20} />} />
                            <NavItem to="/aluno/patrocinadores" label="Patrocinadores" icon={<Handshake size={20} />} />
                            <NavItem to="/aluno/configuracoes" label="Configurações" icon={<Settings size={20} />} />
                            <NavItem to="/aluno/whatsapp" label="Fale Conosco" icon={<MessageCircle size={20} />} />


                        </nav>

                        {/* Sidebar Footer */}
                        <div style={{ padding: collapsed ? '20px 5px' : '20px', borderTop: '1px solid #dce7f3', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                onClick={() => setCollapsed(!collapsed)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    background: '#eef8ff',
                                    border: 'none',
                                    color: '#17428f',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold'
                                }}
                            >
                                {collapsed ? <ChevronRight size={20} /> : "RECOLHER"}
                            </button>
                            <button
                                onClick={handleLogout}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#fff',
                                    border: '1px solid #dce7f3',
                                    color: '#17428f',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <LogOut size={18} />
                                {!collapsed && "Sair"}
                            </button>
                        </div>
                    </aside>
                )}

                {/* Main Content */}
                <main style={{ flex: 1, padding: isMobile ? '15px' : '20px', overflowX: 'hidden' }}>
                    <Outlet />
                </main>
            </div>

            {/* Bottom Navigation (Always Visible) */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: isMobile ? 0 : (collapsed ? '80px' : '260px'),
                right: 0,
                background: 'rgba(255,255,255,0.96)',
                borderTop: '1px solid #dce7f3',
                display: 'flex',
                height: '70px',
                zIndex: 300,
                boxShadow: '0 -10px 28px rgba(6, 26, 64, 0.10)',
                transition: 'left 0.3s ease'
            }}>
                <button
                    onClick={() => setActiveSheet('menu')}
                    className="touch-feedback"
                    style={{
                        flex: 1,
                        border: 'none',
                        background: activeSheet === 'menu' ? 'linear-gradient(180deg, #eef8ff, #f2fff7)' : 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        color: activeSheet === 'menu' ? '#17428f' : '#63708a',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    <Menu size={22} />
                    MENU
                </button>
                <div style={{ width: '1px', background: '#dce7f3', height: '30px', alignSelf: 'center' }} />

                {storeEnabled && (
                    <>
                        <button
                            onClick={() => navigate('/aluno/loja')}
                            className="touch-feedback"
                            style={{
                                flex: 1,
                                border: 'none',
                                background: location.pathname === '/aluno/loja' ? 'linear-gradient(180deg, #eef8ff, #f2fff7)' : 'transparent',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                color: location.pathname === '/aluno/loja' ? '#17428f' : '#63708a',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            <Store size={22} />
                            LOJA
                        </button>
                        <div style={{ width: '1px', background: '#dce7f3', height: '30px', alignSelf: 'center' }} />
                    </>
                )}

                <button
                    onClick={() => setActiveSheet('gate')}
                    className="touch-feedback"
                    style={{
                        flex: 1,
                        border: 'none',
                        background: activeSheet === 'gate' ? 'linear-gradient(180deg, #eef8ff, #f2fff7)' : 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        color: activeSheet === 'gate' ? '#17428f' : '#63708a',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{
                        background: 'linear-gradient(135deg, #00a63a 0%, #17428f 100%)',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <QrCode size={16} color="#fff" />
                    </div>
                    ACESSO
                </button>
            </div>

            {/* Bottom Sheet: Menu */}
            {activeSheet === 'menu' && (
                <ResponsivePanel title="Menu Principal" onClose={() => setActiveSheet(null)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', paddingBottom: '30px' }}>

                        {/* Section 1: Gestão */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            <MenuGridItem icon={User} label="Meus Dados" link="/aluno/perfil" />
                            <MenuGridItem icon={CreditCard} label="Carteirinha" link="/aluno/carteirinha" />
                            <MenuGridItem icon={Users} label="Dependentes" link="/aluno/dashboard" />
                            <MenuGridItem icon={History} label="Meus Acessos" link="/aluno/acessos" />
                            <MenuGridItem icon={DollarSign} label="Meus Débitos" link="/aluno/financeiro" />
                            <MenuGridItem icon={FileSignature} label="Autorizações" link="/aluno/autorizacoes" />
                            {storeEnabled && <MenuGridItem icon={Store} label="Loja" link="/aluno/loja" />}
                            <MenuGridItem icon={Lock} label="Trocar Senha" link="/aluno/configuracoes" />
                            <MenuGridItem icon={Clock} label="Horários" link="/aluno/horarios" />
                            {!isInstalledApp && (
                                <MenuGridItem
                                    icon={Download}
                                    label="Instalar App"
                                    onClick={() => {
                                        // Fecha o menu antes: senão a caixa de instalação
                                        // abre atrás do painel e parece que nada aconteceu.
                                        setActiveSheet(null);
                                        openPWAInstallPrompt();
                                    }}
                                />
                            )}
                        </div>

                        <div style={{ height: '1px', background: 'rgba(0,0,0,0.05)', margin: '0 10px' }} />

                        {/* Section 2: Comunicação */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            <MenuGridItem icon={MessageCircle} label="Whats Portaria" link="/aluno/whats-portaria" />
                            <MenuGridItem icon={Users} label="Grupo Whats" link="/aluno/whats-grupo" />
                        </div>

                        <div style={{ height: '1px', background: 'rgba(0,0,0,0.05)', margin: '0 10px' }} />

                        {/* Section 3: Institucional */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            <MenuGridItem icon={Instagram} label="Instagram" onClick={() => window.open('https://www.instagram.com/rumoaoesporte2025/', '_blank')} />
                            <MenuGridItem icon={Handshake} label="Patrocinadores" link="/aluno/patrocinadores" />
                        </div>

                        <div style={{ marginTop: '10px' }}>
                            <button
                                onClick={handleLogout}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    background: '#fff',
                                    border: '1px solid #c9f2d6',
                                    color: '#00a63a',
                                    borderRadius: '12px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px'
                                }}
                            >
                                <LogOut size={20} />
                                ENCERRAR SESSÃO
                            </button>
                        </div>
                    </div>
                </ResponsivePanel>
            )}

            {/* Bottom Sheet: Gate Access */}
            {activeSheet === 'gate' && (
                <ResponsivePanel title="Acesso Portaria" onClose={() => setActiveSheet(null)}>
                    <div style={{ textAlign: 'center', padding: '10px 0 30px 0' }}>

                        {allStudents.length > 1 && (
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                overflowX: 'auto',
                                paddingBottom: '15px',
                                marginBottom: '15px',
                                justifyContent: 'center'
                            }}>
                                {allStudents.map((student, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedStudentIndex(idx)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '20px',
                                            border: 'none',
                                            background: selectedStudentIndex === idx ? '#00a63a' : '#eee',
                                            color: selectedStudentIndex === idx ? '#fff' : '#666',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {student.nome.split(' ')[0]}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div style={{ marginBottom: '15px' }}>
                            <h4 style={{ margin: 0, color: '#17428f', textTransform: 'uppercase', fontSize: '1rem' }}>
                                {allStudents[selectedStudentIndex]?.nome || studentName}
                            </h4>
                        </div>

                        <p style={{ color: '#666', marginBottom: '25px', fontSize: '0.9rem' }}>Aproxime o QR Code do leitor da portaria.</p>

                        <div style={{
                            background: '#fff',
                            padding: '15px',
                            borderRadius: '16px',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                            display: 'inline-block',
                            marginBottom: '20px',
                            lineHeight: 0
                        }}>
                            {qrCodeUrl ? (
                                <img
                                    src={qrCodeUrl}
                                    alt="Gate Access QR"
                                    style={{ width: '200px', height: '200px', display: 'block' }}
                                />
                            ) : (
                                <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                    Gerando...
                                </div>
                            )}
                        </div>

                        <div style={{
                            background: '#eef8ff',
                            padding: '12px',
                            borderRadius: '10px',
                            border: '1px dashed #c9f2d6',
                            margin: '0 20px'
                        }}>
                            <p style={{ fontSize: '0.75rem', color: '#00a63a', margin: 0, fontWeight: 'bold' }}>
                                CÓDIGO DE ACESSO INDIVIDUAL
                            </p>
                        </div>

                        <button
                            onClick={() => navigate('/aluno/carteirinha')}
                            className="touch-feedback"
                            style={{
                                margin: '18px 20px 0 20px',
                                width: 'calc(100% - 40px)',
                                padding: '12px',
                                background: '#fff',
                                border: '1px solid #dce7f3',
                                color: '#17428f',
                                borderRadius: '10px',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            <CreditCard size={18} />
                            VER CARTEIRINHA
                        </button>
                    </div>
                </ResponsivePanel>
            )}

        </div>
    );
}
