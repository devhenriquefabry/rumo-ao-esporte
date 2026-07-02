import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Plus, Edit2, Trash2, XCircle, Star, User, RefreshCw } from 'lucide-react';
import PageTitle from '../components/PageTitle';
import PageContainer from '../components/PageContainer';
import { useDialog } from '../context/CustomDialogContext';
import { planService } from '../utils/planService';
import type { Plan, PricingRule } from '../utils/planService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';


// Helper to format currency input - improved without leading zeros
const CurrencyInput = ({
    label,
    value,
    onChange,
    required = false
}: {
    label: string,
    value: number,
    onChange: (val: number) => void,
    required?: boolean
}) => {
    const [displayValue, setDisplayValue] = useState('');
    const [hasInitialized, setHasInitialized] = useState(false);

    // Initialize only once with the initial value
    useEffect(() => {
        if (!hasInitialized && value > 0) {
            setDisplayValue((value / 100).toString().replace('.', ','));
            setHasInitialized(true);
        }
    }, [value, hasInitialized]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setDisplayValue(raw);
        const parsed = parseFloat(raw.replace(',', '.') || '0');
        if (!isNaN(parsed)) {
            onChange(Math.round(parsed * 100));
        }
    };

    return (
        <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px' }}>
                {label} {required && '*'}
            </label>
            <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }}>R$</span>
                <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    required={required}
                    value={displayValue}
                    onChange={handleChange}
                    placeholder="0,00"
                    style={{
                        width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px',
                        border: '1px solid #ddd', fontSize: '0.95rem'
                    }}
                />
            </div>
        </div>
    );
};

// Rescission Input - toggles between fixed value and percentage
const RescissionInput = ({
    value,
    type,
    onChangeValue,
    onChangeType
}: {
    value: number,
    type: 'fixed' | 'percentage',
    onChangeValue: (val: number) => void,
    onChangeType: (t: 'fixed' | 'percentage') => void
}) => {
    const [displayValue, setDisplayValue] = useState('');
    const [hasInitialized, setHasInitialized] = useState(false);

    // Initialize only once with the initial value
    useEffect(() => {
        if (!hasInitialized && value > 0) {
            setDisplayValue(
                type === 'fixed'
                    ? (value / 100).toString().replace('.', ',')
                    : value.toString()
            );
            setHasInitialized(true);
        }
    }, [value, type, hasInitialized]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setDisplayValue(raw);
        const parsed = parseFloat(raw.replace(',', '.') || '0');
        if (!isNaN(parsed)) {
            // For fixed: store in cents, for percentage: store as-is
            onChangeValue(type === 'fixed' ? Math.round(parsed * 100) : parsed);
        }
    };

    return (
        <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px' }}>
                Multa de Rescisão
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
                    <button
                        type="button"
                        onClick={() => onChangeType('fixed')}
                        style={{
                            padding: '8px 12px',
                            border: 'none',
                            background: type === 'fixed' ? '#007d2f' : '#f5f5f5',
                            color: type === 'fixed' ? '#fff' : '#666',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        R$
                    </button>
                    <button
                        type="button"
                        onClick={() => onChangeType('percentage')}
                        style={{
                            padding: '8px 12px',
                            border: 'none',
                            background: type === 'percentage' ? '#007d2f' : '#f5f5f5',
                            color: type === 'percentage' ? '#fff' : '#666',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        %
                    </button>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }}>
                        {type === 'fixed' ? 'R$' : '%'}
                    </span>
                    <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={displayValue}
                        onChange={handleChange}
                        placeholder={type === 'fixed' ? '0,00' : '0'}
                        style={{
                            width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px',
                            border: '1px solid #ddd', fontSize: '0.95rem'
                        }}
                    />
                </div>
            </div>
            <small style={{ color: '#888', fontSize: '0.75rem' }}>
                {type === 'fixed' ? 'Valor fixo cobrado na rescisão' : 'Porcentagem sobre o valor restante do contrato'}
            </small>
        </div>
    );
};

const PricingSection = ({
    title,
    data,
    onChange
}: {
    title: string,
    data: PricingRule,
    onChange: (d: PricingRule) => void
}) => (
    <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '10px', border: '1px solid #eee' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#007d2f', textTransform: 'uppercase', fontSize: '0.9rem' }}>{title}</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <CurrencyInput
                label="Até Vencimento"
                value={data.mensalidade.ateVencimento}
                onChange={v => onChange({ ...data, mensalidade: { ...data.mensalidade, ateVencimento: v } })}
                required
            />
            <CurrencyInput
                label="Após Vencimento"
                value={data.mensalidade.aposVencimento}
                onChange={v => onChange({ ...data, mensalidade: { ...data.mensalidade, aposVencimento: v } })}
                required
            />
        </div>

        <CurrencyInput
            label="Valor Matrícula"
            value={data.matricula}
            onChange={v => onChange({ ...data, matricula: v })}
            required
        />
    </div>
);

export default function AdminPlans() {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useDialog();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [planCounts, setPlanCounts] = useState<Record<string, number>>({}); // New state for counts

    // Initial State for Form
    const initialRule: PricingRule = {
        mensalidade: { ateVencimento: 0, aposVencimento: 0 },
        matricula: 0
    };

    const [formData, setFormData] = useState<Omit<Plan, 'id'>>({
        nome: '',
        modalidade: 'futebol',
        active: true,
        frequencia: 'mensal',
        valores: { ...initialRule },
        uniforme: 0,
        jurosMensais: 0,
        rescisao: { tipo: 'percentage', valor: 10 }
    });

    useEffect(() => {
        fetchPlans();
        fetchPlanCounts(); // Fetch counts on load
    }, []);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const data = await planService.getPlans();
            setPlans(data.filter(plan => (plan.modalidade || '').toLowerCase().includes('futebol')));
        } catch (error) {
            console.error(error);
            showAlert('Erro ao carregar planos.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchPlanCounts = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'arena_simonesia_2026_registrations'));
            const counts: Record<string, number> = {};

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.contractStatus === 'desativado') return;
                const pid = data.planId;
                if (!pid) return;
                const numStudents = data.alunos?.length || 1;
                counts[pid] = (counts[pid] || 0) + numStudents;
            });
            setPlanCounts(counts);
        } catch (error) {
            console.error("Erro ao contar alunos por plano:", error);
        }
    };

    const handleDelete = async (id: string) => {
        showConfirm('Tem certeza que deseja excluir este plano?', async () => {
            try {
                await planService.deletePlan(id);
                fetchPlans();
                showAlert('Plano excluído!', 'success');
            } catch (e) {
                showAlert('Erro ao excluir.', 'error');
            }
        });
    };

    const handleSetDefault = async (id: string) => {
        try {
            await planService.setDefaultPlan(id);
            fetchPlans();
            showAlert('Plano definido como padrão!', 'success');
        } catch (e) {
            console.error(e);
            showAlert('Erro ao definir plano padrão.', 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await planService.updatePlan(editingId, formData);
                showAlert('Plano atualizado!', 'success');
            } else {
                await planService.createPlan(formData);
                showAlert('Plano criado!', 'success');
            }
            setShowModal(false);
            resetForm();
            fetchPlans();
        } catch (e) {
            console.error(e);
            showAlert('Erro ao salvar.', 'error');
        }
    };

    const handleEdit = (plan: Plan) => {
        setEditingId(plan.id);
        const valores = plan.valores || { ...initialRule };
        setFormData({
            nome: plan.nome || '',
            modalidade: plan.modalidade || 'futebol',
            active: plan.active !== undefined ? plan.active : true,
            frequencia: plan.frequencia || 'mensal',
            valores: valores,
            uniforme: plan.uniforme || 0,
            jurosMensais: plan.jurosMensais || 0,
            multa: plan.multa || 0,
            rescisao: plan.rescisao || { tipo: 'percentage', valor: 10 }
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({
            nome: '',
            modalidade: 'futebol',
            active: true,
            frequencia: 'mensal',
            valores: { ...initialRule },
            uniforme: 0,
            jurosMensais: 0,
            rescisao: { tipo: 'percentage', valor: 10 }
        });
    };

    return (
        <PageContainer>
            <PageTitle title="GESTÃO DE PLANOS">
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => navigate('/admin/plans/auto-allocation')}
                        style={{
                            padding: '12px 20px', background: '#fff', color: '#007d2f', border: '2px dashed #007d2f',
                            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        <RefreshCw size={18} /> Alocação Automática
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        style={{
                            padding: '12px 20px', background: '#007d2f', color: '#fff', border: 'none',
                            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        <Plus size={18} /> Novo Plano
                    </button>
                </div>
            </PageTitle>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Carregando planos...</div>
            ) : plans.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '2px dashed #eee' }}>
                    <TrendingUp size={40} color="#ddd" style={{ marginBottom: '15px' }} />
                    <h3 style={{ color: '#888' }}>Nenhum plano cadastrado</h3>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {plans.map(plan => (
                        <div key={plan.id} style={{
                            background: '#fff', padding: '20px', borderRadius: '16px',
                            border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                            position: 'relative'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                <div>
                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            display: 'inline-block', padding: '4px 8px', borderRadius: '4px',
                                            background: '#fff0f0', color: '#007d2f', fontSize: '0.7rem', fontWeight: 'bold',
                                            textTransform: 'uppercase'
                                        }}>
                                            {plan.modalidade}
                                        </span>
                                        {plan.isDefault && (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px',
                                                background: '#fff8e1', color: '#ff8f00', fontSize: '0.7rem', fontWeight: 'bold'
                                            }}>
                                                <Star size={12} fill="#ff8f00" /> PADRÃO
                                            </span>
                                        )}
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#333' }}>{plan.nome}</h3>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {!plan.isDefault && (
                                        <button
                                            onClick={() => handleSetDefault(plan.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
                                            title="Definir como Plano Padrão"
                                        >
                                            <Star size={18} />
                                        </button>
                                    )}
                                    <button onClick={() => handleEdit(plan)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(plan.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007d2f' }}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', fontSize: '0.85rem' }}>
                                {/* Valor Mensal Summary */}
                                <div style={{ flex: 1, background: '#f5f5f5', padding: '10px', borderRadius: '8px' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>Mensalidade</div>
                                    <div style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                        {((plan.valores?.mensalidade?.ateVencimento || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#999' }}>Até vencimento</div>

                                    <div style={{ marginTop: '8px', borderTop: '1px dashed #ddd', paddingTop: '4px' }}>
                                        <div style={{ color: '#555', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                            {((plan.valores?.mensalidade?.aposVencimento || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#999' }}>Após vencimento</div>
                                    </div>
                                </div>

                                <div style={{ flex: 1, background: '#f5f5f5', padding: '10px', borderRadius: '8px' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>Matrícula</div>
                                    <div style={{ color: '#333', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        {((plan.valores?.matricula || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </div>
                                </div>
                            </div>

                            {plan.uniforme ? (
                                <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #f0f0f0', fontSize: '0.85rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Uniforme:</span>
                                    <strong>{(plan.uniforme / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                                </div>
                            ) : null}

                            {plan.jurosMensais ? (
                                <div style={{ marginTop: '5px', fontSize: '0.85rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Juros atraso:</span>
                                    <strong>{plan.jurosMensais}%</strong>
                                </div>
                            ) : null}

                            {/* NEW: Student Count Display */}
                            <div style={{
                                marginTop: '15px',
                                paddingTop: '10px',
                                borderTop: '1px solid #f0f0f0',
                                fontSize: '0.85rem',
                                color: '#666',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <User size={16} color="#007d2f" />
                                <span>Alunos utilizando este plano:</span>
                                <strong style={{ color: '#111' }}>{planCounts[plan.id] || 0}</strong>
                            </div>

                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div style={{
                        background: '#fff', width: '100%', maxWidth: '700px', borderRadius: '16px',
                        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{editingId ? 'Editar Plano' : 'Novo Plano'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><XCircle size={24} color="#ccc" /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Nome do Plano</label>
                                    <input
                                        type="text" required
                                        placeholder="Ex: Futebol 2x Semana"
                                        value={formData.nome}
                                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Modalidade</label>
                                    <select
                                        value={formData.modalidade}
                                        onChange={e => setFormData({ ...formData, modalidade: e.target.value })}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                                    >
                                        <option value="futebol">Futebol</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                                <PricingSection
                                    title="Valores do Plano"
                                    data={formData.valores}
                                    onChange={d => setFormData({ ...formData, valores: d })}
                                />
                            </div>

                            <div style={{ background: '#fff', border: '1px solid #eee', padding: '15px', borderRadius: '10px' }}>
                                <h4 style={{ margin: '0 0 15px 0', color: '#555', fontSize: '0.9rem' }}>Extras</h4>
                                <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                                    <CurrencyInput
                                        label="Valor Uniforme (Opcional)"
                                        value={formData.uniforme || 0}
                                        onChange={v => setFormData({ ...formData, uniforme: v })}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px' }}>
                                            Juros mensais por atraso
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={formData.jurosMensais || ''}
                                                onChange={e => setFormData({ ...formData, jurosMensais: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                                                style={{
                                                    width: '100%', padding: '10px', borderRadius: '8px',
                                                    border: '1px solid #ddd', fontSize: '0.95rem'
                                                }}
                                                placeholder="Ex: 2"
                                            />
                                            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.85rem' }}>%</span>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px' }}>
                                            Multa Moratória (fixa)
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={formData.multa || ''}
                                                onChange={e => setFormData({ ...formData, multa: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                                                style={{
                                                    width: '100%', padding: '10px', borderRadius: '8px',
                                                    border: '1px solid #ddd', fontSize: '0.95rem'
                                                }}
                                                placeholder="Ex: 2"
                                            />
                                            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.85rem' }}>%</span>
                                        </div>
                                    </div>
                                </div>
                                <RescissionInput
                                    value={formData.rescisao?.valor || 0}
                                    type={formData.rescisao?.tipo || 'percentage'}
                                    onChangeValue={v => setFormData({ ...formData, rescisao: { ...formData.rescisao!, valor: v } })}
                                    onChangeType={t => setFormData({ ...formData, rescisao: { tipo: t, valor: formData.rescisao?.valor || 0 } })}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '15px', borderRadius: '8px', background: '#f5f5f5', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                                <button type="submit" style={{ flex: 1, padding: '15px', borderRadius: '8px', background: '#007d2f', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                                    Salvar Plano
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
