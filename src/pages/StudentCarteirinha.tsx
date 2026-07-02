import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import StudentCard from '../components/StudentCard';
import StudentAccessHistory from '../components/StudentAccessHistory';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';

export default function StudentCarteirinha() {
    // Store all students with their context (responsible, cota) attached
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            const impersonatedEmail = localStorage.getItem('uba_impersonated_student_email');
            if (impersonatedEmail || (user && user.email)) {
                try {
                    // 1. Fetch ALL Registrations for this email (normalized)
                    const normalizedEmail = (impersonatedEmail || user!.email!).toLowerCase().trim();
                    const q = query(collection(db, "arena_simonesia_2026_registrations"), where("responsavel.email", "==", normalizedEmail));
                    const snap = await getDocs(q);

                    const studentsAggregated: any[] = [];

                    if (!snap.empty) {
                        snap.forEach((doc) => {
                            const data = doc.data();
                            const responsavel = data.responsavel;
                            const numeroCota = data.numeroCota;

                            if (data.alunos && Array.isArray(data.alunos)) {
                                data.alunos.forEach((aluno: any) => {
                                    const studentName = (aluno.nome || '').trim().replace(/\s+/g, ' ').toUpperCase();
                                    const birthDate = (aluno.dataNascimento || '').trim();
                                    const rawModality = (data.modalidade || '').trim().replace(/\s+/g, ' ');

                                    const existingStudent = studentsAggregated.find(s =>
                                        s.nome.toUpperCase() === studentName &&
                                        (s.dataNascimento || '').trim() === birthDate
                                    );

                                    if (existingStudent) {
                                        if (rawModality && !existingStudent.modalidades.includes(rawModality)) {
                                            existingStudent.modalidades.push(rawModality);
                                        }
                                        if (!existingStudent.registrationIds.includes(doc.id)) {
                                            existingStudent.registrationIds.push(doc.id);
                                        }
                                    } else {
                                        studentsAggregated.push({
                                            ...aluno,
                                            nome: (aluno.nome || '').trim().replace(/\s+/g, ' '),
                                            parentResponsavel: responsavel,
                                            parentCota: numeroCota,
                                            registrationIds: [doc.id],
                                            modalidades: rawModality ? [rawModality] : []
                                        });
                                    }
                                });
                            }
                        });
                    }
                    setAllStudents(studentsAggregated);
                } catch (error) {
                    console.error("Error:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // State for selected tab
    const [selectedIndex, setSelectedIndex] = useState(0);



    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando carteirinhas...</div>;

    if (allStudents.length === 0) return (
        <PageContainer>
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <h2 style={{ color: '#007d2f' }}>Nenhuma carteirinha disponível.</h2>
                <p style={{ color: '#666' }}>Entre em contato com a secretaria se acreditar que isso é um erro.</p>
            </div>
        </PageContainer>
    );

    const selectedStudent = allStudents[selectedIndex];

    return (
        <PageContainer>
            <PageTitle
                title="MINHA CARTEIRINHA"
                subtitle="Identificação oficial do clube"
            />

            {/* TAB SELECTOR for Multiple Students */}
            {allStudents.length > 1 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '10px',
                    marginBottom: '20px',
                    flexWrap: 'wrap'
                }}>
                    {allStudents.map((aluno, index) => (
                        <button
                            key={index}
                            onClick={() => setSelectedIndex(index)}
                            style={{
                                padding: '8px 16px',
                                background: selectedIndex === index ? '#00237f' : '#eef2ff',
                                color: selectedIndex === index ? '#fff' : '#00237f',
                                border: 'none',
                                borderRadius: '20px',
                                fontWeight: 'bold',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: selectedIndex === index ? '0 3px 8px rgba(0,35,127,0.3)' : 'none'
                            }}
                        >
                            {aluno.nome.split(' ')[0]} {/* First name only for tab */}
                        </button>
                    ))}
                </div>
            )}

            <div className="native-card animate-scale-in" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '40px 20px',
                gap: '30px',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '5px' }}>
                    <h3 style={{ color: '#00237f', margin: 0, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {selectedStudent.nome}
                    </h3>
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>
                        {selectedStudent.modalidades.join(', ')}
                    </span>
                </div>

                {/* Visual Representation */}
                <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
                    <StudentCard
                        student={selectedStudent}
                        responsavel={selectedStudent.parentResponsavel}
                        numeroCota={selectedStudent.parentCota}
                    />
                </div>

                <div style={{ maxWidth: '400px', textAlign: 'center', width: '100%' }}>
                    <p style={{ color: '#666', marginBottom: '20px', fontSize: '0.9rem' }}>
                        Esta carteirinha é pessoal e intransferível.
                    </p>

                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '12px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#1e293b',
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Clock size={18} color="#007d2f" />
                        {showHistory ? 'Ocultar Histórico' : 'Ver meu histórico de acesso'}
                        {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showHistory && (
                        <div style={{ marginTop: '20px', textAlign: 'left' }}>
                            <h4 style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '0.5px' }}>
                                Entradas Recentes
                            </h4>
                            <StudentAccessHistory registrationId={selectedStudent.registrationIds} />
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
