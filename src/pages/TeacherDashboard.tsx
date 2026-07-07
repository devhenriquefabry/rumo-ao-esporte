
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import { Users, Calendar, Clock, CheckCircle } from 'lucide-react';

export default function TeacherDashboard() {
    const [turmas, setTurmas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const [teacherName, setTeacherName] = useState(localStorage.getItem('rae_teacher_name') || 'Professor');

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user && user.email) {
                try {
                    // 1. Get Teacher Doc
                    const qTeacher = query(collection(db, 'teachers'), where('email', '==', user.email));
                    const snapTeacher = await getDocs(qTeacher);

                    if (snapTeacher.empty) {
                        setLoading(false);
                        return;
                    }

                    const teacherData = snapTeacher.docs[0].data();

                    // Security check: Is this teacher active?
                    if (teacherData.active === false) {
                        localStorage.removeItem('rae_teacher_name');
                        localStorage.removeItem('rae_teacher_role');
                        await auth.signOut();
                        alert("Seu acesso de professor foi desativado. Entre em contato com a secretaria.");
                        navigate('/aluno/login');
                        return;
                    }

                    const myName = teacherData.nome;
                    if (myName) {
                        setTeacherName(myName);
                        localStorage.setItem('rae_teacher_name', myName);
                    }

                    // 2. Fetch Turmas where responsavel == myName
                    const qTurmas = query(collection(db, 'turmas'), where('responsavel', '==', myName));
                    const snapTurmas = await getDocs(qTurmas);

                    const list = snapTurmas.docs
                        .map(d => ({ id: d.id, ...d.data() }))
                        .filter((t: any) => t.ativo !== false);

                    // Fetch student counts
                    const studentsQuery = query(collection(db, "rumo_ao_esporte_2026_registrations"));
                    const studentsSnap = await getDocs(studentsQuery);

                    const counts: Record<string, number> = {};
                    studentsSnap.docs.forEach(doc => {
                        const data = doc.data();
                        if (Array.isArray(data.alunos)) {
                            data.alunos.forEach((aluno: any) => {
                                if (aluno.turmaId) {
                                    counts[aluno.turmaId] = (counts[aluno.turmaId] || 0) + 1;
                                }
                            });
                        }
                    });

                    // 3. Check Today's Attendance
                    // Use local date string (YYYY-MM-DD) to avoid UTC rollover issues
                    const today = new Date().toLocaleDateString('en-CA');
                    const qChamadas = query(
                        collection(db, 'rumo_ao_esporte_2026_chamadas'),
                        where('data', '==', today)
                    );
                    const snapChamadas = await getDocs(qChamadas);
                    const doneTurmaIds = new Set(snapChamadas.docs.map(doc => doc.data().turmaId));

                    const turmasWithStatus = list.map((t: any) => ({
                        ...t,
                        studentCount: counts[t.id] || 0,
                        attendanceDone: doneTurmaIds.has(t.id)
                    }));

                    setTurmas(turmasWithStatus);

                } catch (error) {
                    console.error("Error fetching turmas:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <PageContainer>
            <div style={{ position: 'relative', minHeight: '80vh' }}>
                {/* Background Image Overlay */}
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100vw',
                    height: '100vh',
                    backgroundImage: 'url(/logo-dashboard.png)',
                    backgroundSize: '400px',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    opacity: 0.05,
                    pointerEvents: 'none',
                    zIndex: 0
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <PageTitle title={`Olá, ${teacherName.split(' ')[0]}!`} />
                    <p style={{ color: '#666', marginBottom: '30px' }}>Selecione uma turma para gerenciar.</p>

                    {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Carregando turmas...</div> : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                            {turmas.map(turma => (
                                <div
                                    key={turma.id}
                                    onClick={() => navigate(`/professor/turmas/${turma.id}`)}
                                    className="native-card touch-feedback"
                                    style={{ cursor: 'pointer', borderLeft: `4px solid #00a63a`, position: 'relative' }}
                                >
                                    <div style={{ position: 'absolute', top: '15px', right: '15px', background: '#f5f5f5', padding: '5px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>
                                        {turma.modalidade?.toUpperCase()}
                                    </div>

                                    <h3 style={{ marginTop: '0', fontSize: '1.2rem', color: '#333', paddingRight: '60px' }}>{turma.nome}</h3>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555' }}>
                                            <Clock size={18} color="#00a63a" />
                                            <span style={{ fontWeight: 'bold' }}>{turma.horario}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555' }}>
                                            <Calendar size={18} color="#00a63a" />
                                            <span>{turma.dias?.join(', ')}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555', marginTop: '5px' }}>
                                            <Users size={18} color="#17428f" />
                                            <span style={{ fontWeight: 'bold', color: '#17428f' }}>{turma.studentCount} Alunos</span>
                                        </div>

                                        {turma.attendanceDone && (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                color: '#2e7d32',
                                                fontSize: '0.8rem',
                                                marginTop: '10px',
                                                background: '#e8f5e9',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                width: 'fit-content',
                                                fontWeight: 'bold'
                                            }}>
                                                <CheckCircle size={14} />
                                                CHAMADA REALIZADA
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {turmas.length === 0 && (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px', color: '#888', background: '#fff', borderRadius: '12px' }}>
                                    <Users size={48} color="#ddd" style={{ marginBottom: '15px' }} />
                                    <h3>Nenhuma turma atribuída a você.</h3>
                                    <p>Entre em contato com a secretaria se achar que isso é um erro.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
