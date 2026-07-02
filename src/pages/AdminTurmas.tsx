
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { Users, Plus, RefreshCw } from 'lucide-react';
import PageTitle from '../components/PageTitle';
import PageContainer from '../components/PageContainer';
import { normalizeModality } from '../utils/turmasConstants';


interface Student {
    id: string;
    registrationId: string; // Firestore document ID
    nome: string;
    dataNascimento: string;
    cpf: string;
    responsavel: {
        nome: string;
        celular: string;
    };
    modalidade: string;
    fotoUrl?: string;
    turmaCalculada?: string;
}

interface GroupedData {
    [modalidade: string]: {
        [turma: string]: Student[];
    };
}

export default function AdminTurmas() {
    const navigate = useNavigate();
    const { showAlert } = useDialog();
    const [activeModality, setActiveModality] = useState('Futebol');
    const [loading, setLoading] = useState(true);
    const [groupedData, setGroupedData] = useState<GroupedData>({});

    // CRUD Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingTurma, setEditingTurma] = useState<{ id: string, nome: string, horario: string, dias: string[], responsavel: string, modalidade: string } | null>(null);
    const [formData, setFormData] = useState({ nome: '', horario: '', dias: [] as string[], responsavel: '', modalidade: 'futebol' });

    const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sexta', 'Sáb', 'Dom'];
    const MODALIDADES = ['Futebol'];

    const [teachers, setTeachers] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
        fetchTeachers();
    }, []);

    const fetchTeachers = async () => {
        try {
            const q = query(collection(db, 'teachers'), orderBy('nome'));
            const snap = await getDocs(q);
            setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Error fetching teachers:", error);
        }
    };

    const fetchData = async () => {
        try {
            // 1. Fetch all turmas
            const turmasQuery = query(collection(db, 'turmas'), orderBy('modalidade'), orderBy('horario'));
            const turmasSnapshot = await getDocs(turmasQuery);

            // 2. Fetch all students
            const studentsQuery = query(collection(db, "arena_simonesia_2026_registrations"), orderBy("createdAt", "desc"));
            const studentsSnapshot = await getDocs(studentsQuery);

            // Create a map of turmaId -> turma data
            const turmasMap: Record<string, { nome: string, horario: string, dias: string[], responsavel: string, modalidade: string }> = {};
            turmasSnapshot.docs.forEach(doc => {
                const t = doc.data();
                if (t.ativo === false) return;
                turmasMap[doc.id] = {
                    nome: t.nome,
                    horario: t.horario,
                    dias: t.dias || [],
                    responsavel: t.responsavel || '',
                    modalidade: t.modalidade
                };
            });

            // Build grouped data
            const groups: GroupedData = {};

            // Initialize groups with turmas (empty arrays for now)
            Object.entries(turmasMap).forEach(([turmaId, turma]) => {
                const modKey = normalizeModality(turma.modalidade);
                const turmaLabel = `${turma.horario}|${turma.nome}|${turma.dias.join(',')}|${turma.responsavel}|${turmaId}`;
                if (!groups[modKey]) groups[modKey] = {};
                groups[modKey][turmaLabel] = [];
            });

            // Add students to their assigned turmas
            studentsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const alunosList = data.alunos && Array.isArray(data.alunos) ? data.alunos : [];

                alunosList.forEach((aluno: any, index: number) => {
                    const studentTurmaId = aluno.turmaId;
                    if (!studentTurmaId) return; // Skip students without turma assignment

                    const turma = turmasMap[studentTurmaId];
                    if (!turma) return; // Skip if turma doesn't exist

                    const student: Student = {
                        id: `${doc.id}-${index}`,
                        registrationId: doc.id,
                        nome: aluno.nome,
                        dataNascimento: aluno.dataNascimento,
                        cpf: aluno.cpf,
                        modalidade: turma.modalidade.charAt(0).toUpperCase() + turma.modalidade.slice(1),
                        fotoUrl: aluno.fotoUrl,
                        responsavel: {
                            nome: data.responsavel?.nome || 'Responsável não informado',
                            celular: data.responsavel?.telefonePrincipal || data.responsavel?.telefone || ''
                        }
                    };

                    const modKey = normalizeModality(turma.modalidade);
                    const turmaLabel = `${turma.horario}|${turma.nome}|${turma.dias.join(',')}|${turma.responsavel}|${studentTurmaId}`;

                    if (groups[modKey] && groups[modKey][turmaLabel]) {
                        groups[modKey][turmaLabel].push(student);
                    }
                });
            });

            setGroupedData(groups);
        } catch (error) {
            console.error("Error fetching data: ", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingTurma) {
                await updateDoc(doc(db, 'turmas', editingTurma.id), {
                    ...formData,
                    updatedAt: Timestamp.now()
                });
            } else {
                await addDoc(collection(db, 'turmas'), {
                    ...formData,
                    ativo: true,
                    createdAt: Timestamp.now()
                });
            }
            setShowModal(false);
            resetForm();
            fetchData();
            showAlert(editingTurma ? "Turma atualizada com sucesso!" : "Turma criada com sucesso!", "success");
        } catch (error) {
            console.error('Error saving turma:', error);
            showAlert('Erro ao salvar turma', 'error');
        }
    };

    const resetForm = () => {
        setFormData({ nome: '', horario: '', dias: [], responsavel: '', modalidade: 'futebol' });
        setEditingTurma(null);
    };

    const toggleDia = (dia: string) => {
        setFormData(prev => ({
            ...prev,
            dias: prev.dias.includes(dia)
                ? prev.dias.filter(d => d !== dia)
                : [...prev.dias, dia]
        }));
    };

    return (
        <PageContainer>
            <PageTitle title="GESTÃO DE TURMAS">
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    style={{
                        padding: '12px 20px', background: '#007d2f', color: '#fff', border: 'none',
                        borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Plus size={18} /> Nova Turma
                </button>
            </PageTitle>

            {/* Content for classes list */}
            <div>
                {/* MODALITY TABS */}
                <div style={{ display: 'flex', width: '100%', borderBottom: '2px solid #f0f0f0', marginBottom: '25px', position: 'relative', overflowX: 'auto' }}>
                    {MODALIDADES.map(mod => {
                        const isActive = activeModality === mod;
                        return (
                            <button
                                key={mod}
                                onClick={() => setActiveModality(mod)}
                                style={{
                                    flex: '1 0 auto',
                                    minWidth: '100px',
                                    padding: '15px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: isActive ? '3px solid #007d2f' : '3px solid transparent',
                                    color: isActive ? '#007d2f' : '#888',
                                    cursor: 'pointer',
                                    fontWeight: isActive ? 'bold' : '500',
                                    fontSize: '1rem',
                                    textTransform: 'uppercase',
                                    transition: 'all 0.3s ease',
                                    letterSpacing: '0.5px',
                                    position: 'relative',
                                    bottom: '-2px'
                                }}
                            >
                                {mod}
                            </button>
                        );
                    })}
                </div>

                {normalizeModality(activeModality) === 'Futebol' && (
                    <button
                        onClick={() => navigate('/admin/turmas/auto-allocation')}
                        style={{
                            width: '100%',
                            padding: '15px',
                            background: '#fff',
                            border: '2px dashed #007d2f',
                            borderRadius: '12px',
                            color: '#007d2f',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            marginBottom: '20px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontSize: '1rem'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fff5f5';
                            e.currentTarget.style.transform = 'scale(1.01)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fff';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        <RefreshCw size={20} /> Configurar Alocação Automática
                    </button>
                )}

                {loading ? <p>Carregando...</p> : (
                    <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                        {(!groupedData[activeModality.charAt(0).toUpperCase() + activeModality.slice(1)] && !groupedData[activeModality]) ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                                <Users size={40} color="#ddd" style={{ marginBottom: '10px' }} />
                                <div>Nenhuma turma encontrada para {activeModality}.</div>
                                <button
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, modalidade: activeModality }));
                                        setShowModal(true);
                                    }}
                                    style={{ marginTop: '15px', padding: '10px 20px', background: '#007d2f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    Criar Turma de {activeModality.charAt(0).toUpperCase() + activeModality.slice(1)}
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="turmas-grid">
                                    {Object.entries(groupedData[activeModality.charAt(0).toUpperCase() + activeModality.slice(1)] || groupedData[activeModality] || {}).map(([turmaLabel, students]) => {
                                        const [horario, nome, diasStr, responsavel, turmaId] = turmaLabel.split('|');
                                        const dias = diasStr ? diasStr.split(',').filter(d => d) : [];

                                        return (
                                            <div
                                                key={turmaId}
                                                onClick={() => navigate(`/admin/turmas/${turmaId}`)}
                                                className="turma-card"
                                                style={{
                                                    background: '#fff',
                                                    borderRadius: '12px',
                                                    border: '2px solid #eee',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    position: 'relative',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (window.innerWidth > 768) {
                                                        e.currentTarget.style.borderColor = '#007d2f';
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (window.innerWidth > 768) {
                                                        e.currentTarget.style.borderColor = '#eee';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.boxShadow = 'none';
                                                    }
                                                }}
                                            >
                                                <div style={{ textAlign: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0' }}>
                                                    <div className="turma-time" style={{ fontSize: 'clamp(1.2rem, 4vw, 1.8rem)', fontWeight: 'bold', color: '#333' }}>
                                                        {horario || '--:--'}
                                                    </div>
                                                    <div className="turma-name" style={{ marginTop: '5px', fontSize: 'clamp(0.8rem, 3vw, 1.1rem)', color: '#555', lineHeight: '1.2' }}>
                                                        <span style={{ color: '#007d2f', fontWeight: 'bold' }}>Turma:</span> {nome}
                                                    </div>
                                                    <div className="turma-details" style={{ marginTop: '5px', fontSize: '0.85rem', color: '#666' }}>
                                                        <div><span style={{ fontWeight: 'bold' }}>Dias:</span> {dias.length > 0 ? dias.join(', ') : '-'}</div>
                                                        <div style={{ marginTop: '2px' }}><span style={{ fontWeight: 'bold' }}>Resp.:</span> {responsavel || '-'}</div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                    <div style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Users size={14} color="#007d2f" />
                                                        <span className="turma-count" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#333' }}>{students.length} Alunos</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <style>{`
                                    .turmas-grid {
                                        display: grid;
                                        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                                        gap: 20px;
                                    }
                                    .turma-card {
                                        padding: 20px;
                                    }
                                    @media (max-width: 600px) {
                                        .turmas-grid {
                                            grid-template-columns: repeat(2, 1fr);
                                            gap: 8px;
                                        }
                                        .turma-card {
                                            padding: 10px 5px;
                                        }
                                        .turma-details {
                                            display: none;
                                        }
                                        .turma-time { font-size: 1.1rem !important; }
                                        .turma-name { font-size: 0.8rem !important; }
                                        .turma-count { font-size: 0.75rem !important; }
                                    }
                                `}</style>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* CRUD Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '10px'
                }}>
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ margin: '0 0 25px 0', color: '#333' }}>
                            {editingTurma ? 'Editar Turma' : 'Nova Turma'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>Modalidade</label>
                                <select
                                    value={formData.modalidade}
                                    onChange={e => setFormData({ ...formData, modalidade: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
                                    required
                                >
                                    {MODALIDADES.map(mod => (
                                        <option key={mod} value={mod}>{mod.charAt(0).toUpperCase() + mod.slice(1)}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>Nome da Turma</label>
                                <input
                                    type="text"
                                    value={formData.nome}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                    placeholder="Ex: FUTSAL SUB 05"
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
                                    required
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>Horário</label>
                                <input
                                    type="time"
                                    value={formData.horario}
                                    onChange={e => setFormData({ ...formData, horario: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
                                    required
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>Dias da Semana</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {DIAS_SEMANA.map(dia => (
                                        <button
                                            key={dia}
                                            type="button"
                                            onClick={() => toggleDia(dia)}
                                            style={{
                                                padding: '10px 15px', borderRadius: '8px', border: '1px solid #ddd',
                                                background: formData.dias.includes(dia) ? '#007d2f' : '#fff',
                                                color: formData.dias.includes(dia) ? '#fff' : '#333',
                                                cursor: 'pointer', fontWeight: 'bold'
                                            }}
                                        >
                                            {dia}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>Responsável</label>
                                <select
                                    value={formData.responsavel}
                                    onChange={e => setFormData({ ...formData, responsavel: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
                                >
                                    <option value="">Selecione um professor...</option>
                                    {teachers.map(t => (
                                        <option key={t.id} value={t.nome}>{t.nome}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); resetForm(); }}
                                    style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', background: '#007d2f', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    {editingTurma ? 'Salvar' : 'Criar Turma'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
