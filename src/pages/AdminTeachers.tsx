import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { useLoading } from '../components/LoadingService';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import { Plus, Search } from 'lucide-react';
import TeacherCard from '../components/teachers/TeacherCard';
import TeacherFormModal from '../components/teachers/TeacherFormModal';
import AssignClassModal from '../components/teachers/AssignClassModal';
import { useAdminPermissions } from '../hooks/useAdminPermissions';

export default function AdminTeachers() {
    const { showAlert, showConfirm } = useDialog();
    const { showLoading } = useLoading();
    const { canEdit } = useAdminPermissions();

    const [teachers, setTeachers] = useState<any[]>([]);
    const [turmas, setTurmas] = useState<any[]>([]);
    const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Assign Class Modal State
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignTargetTeacher, setAssignTargetTeacher] = useState<any>(null);

    // Form Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        telefone: '',
        cpf: '',
        active: true,
        senha: 'rumo2026'
    });

    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchTeachers(), fetchTurmas(), fetchStudentCounts()]);
        setLoading(false);
    };

    const fetchTeachers = async () => {
        try {
            const q = query(collection(db, 'teachers'), orderBy('nome'));
            const snap = await getDocs(q);
            setTeachers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching teachers:", error);
            showAlert('Erro ao carregar professores.', 'error');
        }
    };

    const fetchTurmas = async () => {
        try {
            const snap = await getDocs(collection(db, 'turmas'));
            setTurmas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Error fetching turmas:", error);
        }
    };

    const fetchStudentCounts = async () => {
        try {
            const snap = await getDocs(collection(db, 'rumo_ao_esporte_2026_registrations'));
            const counts: Record<string, number> = {};
            snap.docs.forEach(doc => {
                const data = doc.data();
                if (data.alunos && Array.isArray(data.alunos)) {
                    data.alunos.forEach((aluno: any) => {
                        if (aluno.turmaId) {
                            counts[aluno.turmaId] = (counts[aluno.turmaId] || 0) + 1;
                        }
                    });
                }
            });
            setStudentCounts(counts);
        } catch (error) {
            console.error("Error fetching student counts:", error);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) return;

        try {
            if (editingId) {
                await updateDoc(doc(db, 'teachers', editingId), { ...formData, updatedAt: Timestamp.now() });
                showAlert('Professor atualizado com sucesso!', 'success');
            } else {
                await addDoc(collection(db, 'teachers'), { ...formData, createdAt: Timestamp.now() });
                showAlert('Professor cadastrado com sucesso!', 'success');
            }
            setShowModal(false);
            resetForm();
            fetchTeachers();
        } catch (error) {
            console.error("Error saving teacher:", error);
            showAlert('Erro ao salvar professor.', 'error');
        }
    };

    const handleDelete = (id: string) => {
        if (!canEdit) return;
        showConfirm('Tem certeza que deseja remover este professor?', async () => {
            try {
                await deleteDoc(doc(db, 'teachers', id));
                showAlert('Professor removido com sucesso!', 'success');
                fetchTeachers();
            } catch (error) {
                console.error("Error deleting teacher:", error);
                showAlert('Erro ao remover professor.', 'error');
            }
        });
    };

    const resetForm = () => {
        setFormData({ nome: '', email: '', telefone: '', cpf: '', active: true, senha: 'rumo2026' });
        setEditingId(null);
    };

    const openEdit = (teacher: any) => {
        setFormData({
            nome: teacher.nome,
            email: teacher.email,
            telefone: teacher.telefone,
            cpf: teacher.cpf,
            active: teacher.active !== false,
            senha: teacher.senha || 'rumo2026'
        });
        setEditingId(teacher.id);
        setShowModal(true);
    };

    const handleAssignClass = async (turmaIds: string[]) => {
        if (turmaIds.length === 0 || !assignTargetTeacher) return;
        showLoading(3000, `Vinculando ${assignTargetTeacher.nome} às turmas selecionadas...`);
        try {
            const batch = writeBatch(db);
            turmaIds.forEach(id => {
                batch.update(doc(db, 'turmas', id), {
                    responsavel: assignTargetTeacher.nome,
                    responsavelId: assignTargetTeacher.id,
                    updatedAt: Timestamp.now()
                });
            });
            await batch.commit();
            setTimeout(() => {
                setShowAssignModal(false);
                setAssignTargetTeacher(null);
                fetchData();
                showAlert(`${turmaIds.length} turma(s) vinculada(s) com sucesso!`, 'success');
            }, 3000);
        } catch (e) {
            console.error(e);
            showAlert('Erro ao vincular turmas.', 'error');
        }
    };

    const handleUnassignClass = (turmaId: string, teacherName: string) => {
        if (!canEdit) return;
        showConfirm(`Deseja remover ${teacherName} como responsável desta turma?`, async () => {
            try {
                showLoading(2000, 'Removendo vínculo...');
                await updateDoc(doc(db, 'turmas', turmaId), { responsavel: '', responsavelId: '', updatedAt: Timestamp.now() });
                setTimeout(() => {
                    fetchData();
                    showAlert('Vínculo removido com sucesso!', 'success');
                }, 2000);
            } catch (error) {
                console.error("Error unassigning teacher:", error);
                showAlert('Erro ao remover vínculo.', 'error');
            }
        });
    };

    const toggleStatus = async (teacher: any) => {
        if (!canEdit) return;

        if (teacher.active) {
            showConfirm('Atenção: Ao desativar este professor, ele será removido como responsável de todas as turmas. Deseja continuar?', async () => {
                showLoading(3000, 'Processando alteração e removendo vínculos...');
                try {
                    const batch = writeBatch(db);
                    batch.update(doc(db, 'teachers', teacher.id), { active: false, updatedAt: Timestamp.now() });
                    turmas.filter(t => t.responsavel === teacher.nome).forEach(t => {
                        batch.update(doc(db, 'turmas', t.id), { responsavel: '', responsavelId: '' });
                    });
                    await batch.commit();
                    setTimeout(() => { fetchData(); showAlert('Professor desativado e turmas atualizadas.', 'success'); }, 3000);
                } catch (e) {
                    console.error(e);
                    showAlert('Erro ao desativar professor.', 'error');
                }
            });
        } else {
            try {
                await updateDoc(doc(db, 'teachers', teacher.id), { active: true, updatedAt: Timestamp.now() });
                fetchTeachers();
            } catch (e) {
                showAlert('Erro ao ativar professor.', 'error');
            }
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => showAlert(`${label} copiado!`, 'success')).catch(() => showAlert('Erro ao copiar.', 'error'));
    };

    const filteredTeachers = teachers.filter(t =>
        t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <PageContainer>
            <PageTitle title="GESTÃO DE PROFESSORES">
                {canEdit && (
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        style={{
                            padding: '12px 24px', background: '#00a63a', color: '#fff', border: 'none',
                            borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px',
                            boxShadow: '0 4px 12px rgba(0, 125, 47, 0.2)'
                        }}
                    >
                        <Plus size={20} /> Novo Professor
                    </button>
                )}
            </PageTitle>

            <div style={{ marginBottom: '30px', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                <input
                    type="text"
                    placeholder="Buscar por nome ou email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                        width: '100%', padding: '15px 15px 15px 50px', borderRadius: '15px', border: '1px solid #eee', fontSize: '1rem',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.02)', outline: 'none', transition: 'all 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#00a63a'}
                    onBlur={(e) => e.target.style.borderColor = '#eee'}
                />
            </div>

            {loading ? (
                <div className="loading-container">Carregando professores...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '25px' }}>
                    {filteredTeachers.map(teacher => (
                        <TeacherCard
                            key={teacher.id}
                            teacher={teacher}
                            classes={turmas.filter(t => t.responsavel === teacher.nome)}
                            studentCounts={studentCounts}
                            isPasswordVisible={visiblePasswords[teacher.id] || false}
                            onEdit={() => openEdit(teacher)}
                            onDelete={() => handleDelete(teacher.id)}
                            onToggleStatus={() => toggleStatus(teacher)}
                            onTogglePassword={() => setVisiblePasswords(prev => ({ ...prev, [teacher.id]: !prev[teacher.id] }))}
                            onCopyToClipboard={copyToClipboard}
                            onAssignClass={() => { setAssignTargetTeacher(teacher); setShowAssignModal(true); }}
                            onUnassignClass={handleUnassignClass}
                            onCredentialsUpdated={() => fetchTeachers()}
                            readOnly={!canEdit}
                        />
                    ))}
                </div>
            )}

            <AssignClassModal
                isOpen={showAssignModal}
                teacherName={assignTargetTeacher?.nome || ''}
                turmas={turmas}
                onAssign={handleAssignClass}
                onClose={() => { setShowAssignModal(false); setAssignTargetTeacher(null); }}
            />

            <TeacherFormModal
                isOpen={showModal}
                editingId={editingId}
                formData={formData}
                setFormData={setFormData}
                onSave={handleSave}
                onClose={() => setShowModal(false)}
                readOnly={!canEdit}
            />
        </PageContainer>
    );
}