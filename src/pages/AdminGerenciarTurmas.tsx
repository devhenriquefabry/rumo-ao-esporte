import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit2, Trash2, ArrowLeft, Clock, Users, Calendar, User } from 'lucide-react';

interface Turma {
    id: string;
    nome: string;
    horario: string;
    dias: string[];
    responsavel: string;
    modalidade: string;
    ativo: boolean;
    createdAt: Timestamp;
}

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sexta', 'Sáb', 'Dom'];
const MODALIDADES = ['futebol'];

export default function AdminGerenciarTurmas() {
    const navigate = useNavigate();
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTurma, setEditingTurma] = useState<Turma | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        nome: '',
        horario: '',
        dias: [] as string[],
        responsavel: '',
        modalidade: 'futebol'
    });

    useEffect(() => {
        fetchTurmas();
    }, []);

    const fetchTurmas = async () => {
        try {
            const q = query(collection(db, 'turmas'), orderBy('modalidade'), orderBy('horario'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Turma[];
            setTurmas(data.filter(t => t.ativo !== false));
        } catch (error) {
            console.error('Error fetching turmas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingTurma) {
                // Update
                await updateDoc(doc(db, 'turmas', editingTurma.id), {
                    ...formData,
                    updatedAt: Timestamp.now()
                });
            } else {
                // Create
                await addDoc(collection(db, 'turmas'), {
                    ...formData,
                    ativo: true,
                    createdAt: Timestamp.now()
                });
            }
            setShowModal(false);
            resetForm();
            fetchTurmas();
        } catch (error) {
            console.error('Error saving turma:', error);
            alert('Erro ao salvar turma');
        }
    };

    const handleDelete = async (turma: Turma) => {
        if (!confirm(`Excluir a turma "${turma.nome}"?`)) return;
        try {
            await updateDoc(doc(db, 'turmas', turma.id), { ativo: false });
            fetchTurmas();
        } catch (error) {
            console.error('Error deleting turma:', error);
            alert('Erro ao excluir turma');
        }
    };

    const handleEdit = (turma: Turma) => {
        setEditingTurma(turma);
        setFormData({
            nome: turma.nome,
            horario: turma.horario,
            dias: turma.dias || [],
            responsavel: turma.responsavel || '',
            modalidade: turma.modalidade
        });
        setShowModal(true);
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

    const groupedTurmas = turmas.reduce((acc, turma) => {
        const mod = turma.modalidade || 'Outros';
        if (!acc[mod]) acc[mod] = [];
        acc[mod].push(turma);
        return acc;
    }, {} as Record<string, Turma[]>);

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={() => navigate(-1)} style={{ background: '#f5f5f5', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <ArrowLeft size={18} /> Voltar
                    </button>
                    <h1 style={{ margin: 0, color: '#333' }}>Gerenciar Turmas</h1>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    style={{
                        background: '#007d2f', color: '#fff', border: 'none', padding: '12px 20px',
                        borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Plus size={18} /> Nova Turma
                </button>
            </div>

            {/* List */}
            {loading ? (
                <p>Carregando...</p>
            ) : (
                Object.entries(groupedTurmas).map(([modalidade, turmasList]) => (
                    <div key={modalidade} style={{ marginBottom: '40px' }}>
                        <h2 style={{ color: '#007d2f', textTransform: 'uppercase', borderBottom: '2px solid #f0f0f0', paddingBottom: '10px', marginBottom: '20px' }}>
                            {modalidade}
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                            {turmasList.map(turma => (
                                <div key={turma.id} style={{
                                    background: '#fff', borderRadius: '12px', padding: '20px',
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #eee'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                        <div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Clock size={20} color="#007d2f" />
                                                {turma.horario}
                                            </div>
                                            <div style={{ fontSize: '1.1rem', color: '#555', marginTop: '5px' }}>
                                                <strong>Turma:</strong> {turma.nome}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => handleEdit(turma)} style={{ background: '#e3f2fd', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                                                <Edit2 size={16} color="#1565c0" />
                                            </button>
                                            <button onClick={() => handleDelete(turma)} style={{ background: '#ffebee', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                                                <Trash2 size={16} color="#007d2f" />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.95rem', color: '#666' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Calendar size={16} />
                                            <strong>Dias:</strong> {turma.dias?.join(', ') || '-'}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <User size={16} />
                                            <strong>Resp.:</strong> {turma.responsavel || '-'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}

            {turmas.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                    <Users size={48} style={{ marginBottom: '15px', opacity: 0.5 }} />
                    <p>Nenhuma turma cadastrada ainda.</p>
                    <p>Clique em "Nova Turma" para começar.</p>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
                }}>
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '30px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
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
                                <input
                                    type="text"
                                    value={formData.responsavel}
                                    onChange={e => setFormData({ ...formData, responsavel: e.target.value })}
                                    placeholder="Nome do professor/responsável"
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
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
        </div>
    );
}
