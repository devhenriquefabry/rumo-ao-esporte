import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Users, Calendar, Trophy } from 'lucide-react';
import { query, collection, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Sidebar, { MobileHeader, SidebarOverlay } from '../components/Sidebar';
import SidebarItem from '../components/SidebarItem';
import '../App.css';

export default function TeacherLayout() {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [collapsed, setCollapsed] = useState(false);
    const [teacherName, setTeacherName] = useState('');
    const [loading, setLoading] = useState(true);
    const [rentalsEnabled, setRentalsEnabled] = useState(true);

    useEffect(() => {
        const fetchRentalsStatus = async () => {
            try {
                const snap = await getDoc(doc(db, 'system_settings', 'rentals'));
                if (snap.exists()) {
                    setRentalsEnabled(snap.data().enabled);
                }
            } catch (err) {
                console.error("Error fetching rentals status", err);
            }
        };
        fetchRentalsStatus();
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);

        const name = localStorage.getItem('teacherName');
        if (name) setTeacherName(name);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user && user.email) {
                try {
                    // Centralized Guard: Check if teacher is active in Firestore
                    const qTeacher = query(collection(db, 'teachers'), where('email', '==', user.email));
                    const snapTeacher = await getDocs(qTeacher);

                    if (snapTeacher.empty) {
                        console.log("Teacher record not found");
                        handleLogout();
                        return;
                    }

                    const teacherData = snapTeacher.docs[0].data();

                    if (teacherData.active === false) {
                        alert("Seu acesso de professor foi desativado. Entre em contato com a secretaria.");
                        handleLogout();
                        return;
                    }

                    // Double check localStorage role just in case
                    const role = localStorage.getItem('rae_teacher_auth');
                    if (!role) {
                        handleLogout();
                        return;
                    }

                    // Pre-fill name if not in state
                    if (!teacherName) setTeacherName(teacherData.nome);

                } catch (error) {
                    console.error("Auth Guard Error:", error);
                    handleLogout();
                } finally {
                    setLoading(false);
                }
            } else {
                // Not authenticated at all
                console.log("Not authenticated, redirecting...");
                handleLogout();
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    const handleLogout = async () => {
        localStorage.removeItem('rae_teacher_auth');
        localStorage.removeItem('teacherName');
        localStorage.removeItem('rae_teacher_name');
        localStorage.removeItem('rae_teacher_role');

        try {
            await auth.signOut();
        } catch (e) {
            console.error("SignOut error:", e);
        }

        navigate('/aluno/login');
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #f4f8fc 0%, #eef8ff 100%)' }}>
                <div style={{ color: '#00a63a', fontWeight: 'bold' }}>Validando acesso...</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(180deg, #f4f8fc 0%, #eef8ff 100%)', flexDirection: 'column' }}>

            {/* Mobile Header */}
            {isMobile && (
                <MobileHeader
                    title={teacherName ? `Professor: ${teacherName.split(' ')[0]}` : "PORTAL DO PROFESSOR"}
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    isOpen={sidebarOpen}
                />
            )}

            <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                <SidebarOverlay isOpen={isMobile && sidebarOpen} onClose={() => setSidebarOpen(false)} />

                <Sidebar
                    isOpen={sidebarOpen}
                    collapsed={collapsed}
                    setCollapsed={setCollapsed}
                    isMobile={isMobile}
                    onLogout={handleLogout}
                    logoutLabel="Sair"
                >
                    <SidebarItem
                        to="/professor/turmas"
                        label="Minhas Turmas"
                        icon={<Users size={20} />}
                        collapsed={collapsed}
                        isMobile={isMobile}
                        onNavigate={() => isMobile && setSidebarOpen(false)}
                    />
                    {rentalsEnabled && (
                        <SidebarItem
                            to="/professor/reservas"
                            label="Reservas"
                            icon={<Calendar size={20} />}
                            collapsed={collapsed}
                            isMobile={isMobile}
                            onNavigate={() => isMobile && setSidebarOpen(false)}
                        />
                    )}
                    <SidebarItem
                        to="/professor/jogos/convocacao"
                        label="Convocação"
                        icon={<Trophy size={20} />}
                        collapsed={collapsed}
                        isMobile={isMobile}
                        onNavigate={() => isMobile && setSidebarOpen(false)}
                    />
                </Sidebar>

                <main style={{ flex: 1, padding: '20px', overflowX: 'hidden' }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
