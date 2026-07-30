import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Lock } from 'lucide-react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import Sidebar, { MobileHeader, SidebarOverlay } from '../components/Sidebar';
import SidebarItem from '../components/SidebarItem';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import { ADMIN_MENU_ITEMS } from '../config/menu';
import { useGlobalQRScanner } from '../hooks/useGlobalQRScanner';
import GlobalScannerModal from '../components/GlobalScannerModal';


export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [collapsed, setCollapsed] = useState(false);
    const [showAdvancedFinanceMenu, setShowAdvancedFinanceMenu] = useState(false);

    const { isAllowed, user, loading: permissionsLoading } = useAdminPermissions();

    // Global QR Scanner - works from any page
    const { modalData: scannerModalData, loading: scannerLoading, closeModal: closeScannerModal } = useGlobalQRScanner();

    const [birthdayCount, setBirthdayCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [activeCount, setActiveCount] = useState(0);
    const [inactiveCount, setInactiveCount] = useState(0);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            setIsMobile(width < 1024);

            // Auto-collapse logic on resize if needed
            const isTablet = width >= 1024 && width <= 1366;
            if (isTablet && location.pathname.includes('/financeiro')) {
                setCollapsed(true);
            }
        };

        window.addEventListener('resize', handleResize);

        // Compute Birthday Badge
        const fetchBirthdays = async () => {
            try {
                const q = query(collection(db, "rumo_ao_esporte_2026_registrations"));
                const snap = await getDocs(q);
                let bCount = 0;
                let aCount = 0;
                let pCount = 0;
                let iCount = 0;
                const currentMonth = new Date().getMonth() + 1; // 1-12

                snap.docs.forEach(doc => {
                    const data = doc.data();
                    const alunos = Array.isArray(data.alunos) ? data.alunos : [];
                    alunos.forEach((aluno: any) => {
                        if (aluno.dataNascimento) {
                            const parts = aluno.dataNascimento.split('/');
                            if (parts.length === 3) {
                                const [, month] = parts;
                                if (parseInt(month) === currentMonth) bCount++;
                            }
                        }
                    });

                    // Compute Category Counts
                    const isArchived = data.contractStatus === 'desativado' || data.status === 'desativado';
                    if (isArchived) {
                        iCount++;
                    } else if (data.contractStatus === 'aprovado') {
                        aCount++;
                    } else {
                        pCount++;
                    }
                });
                setBirthdayCount(bCount);
                setActiveCount(aCount);
                setPendingCount(pCount);
                setInactiveCount(iCount);
            } catch (error) {
                console.error("Error fetching birthdays:", error);
            }
        };
        fetchBirthdays();

        return () => window.removeEventListener('resize', handleResize);
    }, [location.pathname]);

    // Effect to handle path changes for auto-collapse
    useEffect(() => {
        const width = window.innerWidth;
        const isTablet = width >= 1024 && width <= 1366;

        if (isTablet && location.pathname.includes('/financeiro')) {
            setCollapsed(true);
        } else {
            if (isTablet && !location.pathname.includes('/financeiro')) {
                setCollapsed(false);
            }
        }
    }, [location.pathname]);

    useEffect(() => {
        const checkAuth = async () => {
            const localAuth = localStorage.getItem('rae_admin_auth');
            if (!localAuth) navigate('/admin/login');
        };
        checkAuth();
    }, [navigate]);

    useEffect(() => {
        const handleAdvancedMenuShortcut = (event: KeyboardEvent) => {
            if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;
            if (event.code !== 'Quote' && event.key !== "'") return;

            event.preventDefault();
            setShowAdvancedFinanceMenu((current) => !current);
        };

        window.addEventListener('keydown', handleAdvancedMenuShortcut);
        return () => window.removeEventListener('keydown', handleAdvancedMenuShortcut);
    }, []);

    const handleLogout = async () => {
        await signOut(auth);
        localStorage.removeItem('rae_admin_auth');
        sessionStorage.removeItem('rae_admin_session_active');
        navigate('/admin/login');
    };

    if (permissionsLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(180deg, #f4f8fc 0%, #eef8ff 100%)', color: '#63708a', flexDirection: 'column', gap: '15px' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #dce7f3', borderTop: '4px solid #00a63a', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <span style={{ fontWeight: 'bold' }}>Verificando permissões...</span>
            </div>
        );
    }

    // Route Guard: Protect against URL manipulation
    // We check if the current path is allowed.
    // Exception: /admin/login is not covered here (it's outside layout).
    // Exception: /admin root usually redirects to dashboard, which is checked.
    // Route Guard: Protect against URL manipulation
    // We check if the current path is allowed.
    // Exception: /admin/login is not covered here (it's outside layout).
    // Exception: /admin root usually redirects to dashboard, which is checked.
    if (!isAllowed(location.pathname) && location.pathname !== '/admin') {
        const firstAllowed = ADMIN_MENU_ITEMS.find(item => isAllowed(item.path));

        if (firstAllowed) {
            return <Navigate to={firstAllowed.path} replace />;
        } else {
            return (
                <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(180deg, #f4f8fc 0%, #eef8ff 100%)', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', padding: '40px', borderRadius: '8px', boxShadow: '0 18px 50px rgba(9,36,92,0.16)', textAlign: 'center', maxWidth: '500px', border: '1px solid #dce7f3' }}>
                        <div style={{ background: '#eef8ff', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                            <Lock size={40} color="#00a63a" />
                        </div>
                        <h2 style={{ color: '#00a63a', margin: '0 0 10px 0' }}>Acesso Restrito</h2>
                        <p style={{ color: '#666', lineHeight: '1.6' }}>
                            Sua conta não possui permissão para acessar nenhuma área do sistema.
                            <br />Contate o administrador.
                        </p>
                        <button onClick={handleLogout} style={{ marginTop: '20px', padding: '12px 24px', background: '#333', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Sair do Sistema
                        </button>
                    </div>
                </div>
            );
        }
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(180deg, #f4f8fc 0%, #eef8ff 100%)', flexDirection: 'column' }}>

            {/* Global QR Scanner Modal */}
            <GlobalScannerModal
                modalData={scannerModalData}
                loading={scannerLoading}
                onClose={closeScannerModal}
            />

            {/* Mobile Header */}
            {isMobile && (
                <MobileHeader
                    title="ADMIN"
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    isOpen={sidebarOpen}
                />
            )}

            <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                {/* Sidebar Overlay */}
                <SidebarOverlay isOpen={isMobile && sidebarOpen} onClose={() => setSidebarOpen(false)} />

                {/* Sidebar */}
                <Sidebar
                    isOpen={sidebarOpen}
                    collapsed={collapsed}
                    setCollapsed={setCollapsed}
                    isMobile={isMobile}
                    onLogout={handleLogout}
                    logoutLabel={user?.nome ? `Sair (${user.nome.split(' ')[0]})` : "Sair do Sistema"}
                >
                    {ADMIN_MENU_ITEMS.map((item) => {
                        // Check permission for top-level item
                        if (!isAllowed(item.path)) return null;

                        // Add badges dynamically if needed
                        let badgeValue = undefined;
                        if (item.path === '/admin/aniversariantes') badgeValue = birthdayCount;

                        // Filter subitems based on permissions
                        const allowedSubItems = item.subItems?.filter(sub => {
                            if (sub.to === '/admin/financeiro/bancos' && !showAdvancedFinanceMenu) {
                                return false;
                            }

                            return isAllowed(sub.to);
                        }) || [];

                        // Handle subItems badges (e.g. Pendentes, Cadastrados, Desativados)
                        const subItemsWithBadges = allowedSubItems.map(sub => {
                            if (sub.to === '/admin/dashboard') {
                                return { ...sub, badge: activeCount };
                            }
                            if (sub.to === '/admin/cadastros/pendentes') {
                                return { ...sub, badge: pendingCount };
                            }
                            if (sub.to === '/admin/cadastros/desativados') {
                                return { ...sub, badge: inactiveCount };
                            }
                            return sub;
                        });

                        // If item has subItems but none are allowed, hide the whole group
                        if (item.subItems && item.subItems.length > 0 && subItemsWithBadges.length === 0) {
                            return null;
                        }

                        return (
                            <SidebarItem
                                key={item.path}
                                to={item.path}
                                label={item.label}
                                icon={<item.icon size={20} />}
                                badge={badgeValue}
                                collapsed={collapsed}
                                isMobile={isMobile}
                                onNavigate={() => isMobile && setSidebarOpen(false)}
                                subItems={item.subItems ? subItemsWithBadges : undefined}
                            />
                        );
                    })}

                    {/* Employee Management - Removed by user request */}
                </Sidebar>

                {/* Main Content */}
                {/* minWidth: 0 é necessário para o item flex poder encolher; sem isso, ele
                    nunca cede espaço para conteúdo largo (como a tabela do financeiro) e o
                    overflowX: hidden acaba cortando em vez de deixar o filho rolar. */}
                <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '10px' : '10px', overflowX: 'hidden' }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
