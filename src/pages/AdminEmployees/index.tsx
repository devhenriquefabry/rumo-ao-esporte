import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useDialog } from '../../context/CustomDialogContext';
import { useLoading } from '../../components/LoadingService';
import PageContainer from '../../components/PageContainer';
import PageTitle from '../../components/PageTitle';
import { Plus, Search, Trash2, Edit2, Eye, Lock, CheckCircle, XCircle } from 'lucide-react';
import { type Employee } from '../../types/user';
import EmployeeFormModal from '../../components/employees/EmployeeFormModal';
import { removeStaffAccess, syncStaffAccess } from '../../utils/staffAccess';


export default function AdminEmployees() {
    const { showAlert, showConfirm } = useDialog();
    const { showLoading } = useLoading();

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Form Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Employee>>({
        nome: '',
        email: '',
        active: true,
        senha: 'rumo2026',
        role: 'employee',
        permissions: { canEdit: false, allowedRoutes: [] }
    });

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'employees'), orderBy('nome'));
            const snap = await getDocs(q);
            setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
        } catch (error) {
            console.error("Error fetching employees:", error);
            showAlert('Erro ao carregar funcionários.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            showLoading(2000, 'Salvando...');

            if (editingId) {
                const previousEmail = employees.find(e => e.id === editingId)?.email;
                await updateDoc(doc(db, 'employees', editingId), {
                    ...formData,
                    updatedAt: Timestamp.now()
                });
                await syncStaffAccess(formData.email || '', formData.active !== false, 'employee', previousEmail);
                showAlert('Funcionário atualizado com sucesso!', 'success');
            } else {
                await addDoc(collection(db, 'employees'), {
                    ...formData,
                    createdAt: Timestamp.now()
                });
                await syncStaffAccess(formData.email || '', formData.active !== false, 'employee');
                showAlert('Funcionário cadastrado com sucesso!', 'success');
            }
            setShowModal(false);
            resetForm();
            fetchEmployees();
        } catch (error) {
            console.error("Error saving employee:", error);
            showAlert('Erro ao salvar funcionário.', 'error');
        }
    };

    const handleDelete = (id: string) => {
        showConfirm('Tem certeza que deseja remover este funcionário? O acesso dele será revogado imediatamente.', async () => {
            try {
                const email = employees.find(e => e.id === id)?.email || '';
                await deleteDoc(doc(db, 'employees', id));
                await removeStaffAccess(email);
                showAlert('Funcionário removido com sucesso!', 'success');
                fetchEmployees();
            } catch (error) {
                console.error("Error deleting employee:", error);
                showAlert('Erro ao remover funcionário.', 'error');
            }
        });
    };

    const resetForm = () => {
        setFormData({
            nome: '',
            email: '',
            active: true,
            senha: 'rumo2026',
            role: 'employee',
            permissions: { canEdit: false, allowedRoutes: [] }
        });
        setEditingId(null);
    };

    const openEdit = (emp: Employee) => {
        setFormData({
            nome: emp.nome,
            email: emp.email,
            active: emp.active,
            senha: emp.senha,
            role: emp.role,
            permissions: emp.permissions || { canEdit: false, allowedRoutes: [] }
        });
        setEditingId(emp.id);
        setShowModal(true);
    };

    const toggleStatus = async (emp: Employee) => {
        try {
            await updateDoc(doc(db, 'employees', emp.id), { active: !emp.active });
            await syncStaffAccess(emp.email, !emp.active, 'employee');
            fetchEmployees();
        } catch (e) {
            showAlert('Erro ao alterar status.', 'error');
        }
    };

    const filtered = employees.filter(e =>
        e.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <PageContainer>
            <PageTitle title="GESTÃO DE FUNCIONÁRIOS">
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    style={{
                        padding: '12px 24px', background: '#00a63a', color: '#fff', border: 'none',
                        borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px',
                        boxShadow: '0 4px 12px rgba(0, 125, 47, 0.2)'
                    }}
                >
                    <Plus size={20} /> Novo Funcionário
                </button>
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
                <div className="loading-container">Carregando equipe...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Nenhum funcionário encontrado.</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' }}>
                    {filtered.map(emp => (
                        <div key={emp.id} className="native-card" style={{ padding: '25px', borderRadius: '20px', background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: '#333', fontSize: '1.2rem', fontWeight: '800' }}>{emp.nome}</h3>
                                    <span style={{ color: '#888', fontSize: '0.9rem' }}>{emp.email}</span>
                                </div>
                                <div
                                    onClick={() => toggleStatus(emp)}
                                    style={{
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                                        fontSize: '0.8rem', fontWeight: 'bold', padding: '5px 10px', borderRadius: '20px',
                                        background: emp.active ? '#e6fffa' : '#eef8ff', color: emp.active ? '#2ecc71' : '#e74c3c'
                                    }}
                                >
                                    {emp.active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                    {emp.active ? 'Ativo' : 'Inativo'}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                <div style={{
                                    flex: 1, background: '#f8f9fa', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px',
                                    fontSize: '0.85rem', color: '#555', border: '1px solid #eee'
                                }}>
                                    {emp.permissions?.canEdit ? <Lock size={16} color="#2ecc71" /> : <Eye size={16} color="#00a63a" />}
                                    {emp.permissions?.canEdit ? 'Editor (Total)' : 'Somente Leitura'}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '20px' }}>
                                {(emp.permissions?.allowedRoutes || []).length === 0 && <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Sem acesso ao menu</span>}
                                {(emp.permissions?.allowedRoutes || []).length > 0 && <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'bold' }}>Acesso:</span>}
                                {(emp.permissions?.allowedRoutes || []).slice(0, 3).map(r => (
                                    <span key={r} style={{ fontSize: '0.75rem', background: '#eee', padding: '2px 8px', borderRadius: '4px', color: '#555' }}>
                                        {r.replace('/admin/', '')}
                                    </span>
                                ))}
                                {(emp.permissions?.allowedRoutes || []).length > 3 && (
                                    <span style={{ fontSize: '0.75rem', background: '#eee', padding: '2px 8px', borderRadius: '4px', color: '#555' }}>
                                        +{(emp.permissions?.allowedRoutes || []).length - 3}
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                                <button
                                    onClick={() => openEdit(emp)}
                                    style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#f0f4f8', color: '#2c3e50', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <Edit2 size={16} /> Editar
                                </button>
                                <button
                                    onClick={() => handleDelete(emp.id)}
                                    style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#fff0f0', color: '#00a63a', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <Trash2 size={16} /> Remover
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <EmployeeFormModal
                isOpen={showModal}
                editingId={editingId}
                formData={formData}
                setFormData={setFormData}
                onSave={handleSave}
                onClose={() => setShowModal(false)}
            />
        </PageContainer>
    );
}
