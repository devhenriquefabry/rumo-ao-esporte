import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FileText, Trash2, Search, AlertTriangle, Check } from 'lucide-react';
import { useDialog } from '../context/CustomDialogContext';
import PageContainer from '../components/PageContainer';
import { planService } from '../utils/planService';
import type { Plan } from '../utils/planService';
import { normalizeModality, MODALIDADES } from '../utils/turmasConstants';

interface ContractItem {
    registrationId: string;
    studentIndex: number;
    studentName: string;
    responsavelName: string;
    responsavelCpf: string;
    createdAt?: string;
    hasCustomContract: boolean;
    planoId?: string;
    planName?: string;
    modalidade: string;
    signed: boolean;
    signatureData?: string;
    contractGenerated: boolean;
}

const normalizeAlunos = (alunos: any): any[] => {
    if (Array.isArray(alunos)) return alunos;
    if (alunos && typeof alunos === 'object') return Object.values(alunos);
    return [];
};

export default function AdminContractList() {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useDialog();
    const [contracts, setContracts] = useState<ContractItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [plans, setPlans] = useState<Plan[]>([]);
    const [pendingPlanChanges, setPendingPlanChanges] = useState<Record<string, string>>({}); // key: regId-idx, value: newPlanId
    const [selectedModality, setSelectedModality] = useState(MODALIDADES[0].label);
    const [filterStatus, setFilterStatus] = useState<'todos' | 'assinados' | 'pendentes'>('todos');

    useEffect(() => {
        fetchContracts();
    }, []);

    const fetchContracts = async () => {
        setLoading(true);
        try {
            // Fetch plans first
            const allPlans = await planService.getPlans();
            setPlans(allPlans);
            const defaultPlan = allPlans.find(p => p.isDefault) || allPlans[0];

            const snap = await getDocs(collection(db, 'rumo_ao_esporte_2026_registrations'));
            const items: ContractItem[] = [];

            snap.docs.forEach(docSnap => {
                const data = docSnap.data();
                if (data.contractStatus !== 'aprovado') return; // Only approved students have contracts

                const alunos = normalizeAlunos(data.alunos);

                alunos.forEach((aluno: any, idx: number) => {
                    const studentPlanId = aluno.planoId || defaultPlan?.id;
                    const plan = allPlans.find(p => p.id === studentPlanId);

                    items.push({
                        registrationId: docSnap.id,
                        studentIndex: idx,
                        studentName: aluno.nome || 'Sem nome',
                        responsavelName: data.responsavel?.nome || 'Desconhecido',
                        responsavelCpf: data.responsavel?.cpf || '',
                        createdAt: data.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || '-',
                        hasCustomContract: !!aluno.customContract,
                        planoId: studentPlanId,
                        planName: plan?.nome || (defaultPlan ? `${defaultPlan.nome} (padrão)` : 'Sem plano'),
                        modalidade: normalizeModality(data.modalidade || ''),
                        signed: !!aluno.signatureData,
                        signatureData: aluno.signatureData,
                        contractGenerated: data.contractGenerated !== false
                    });
                });
            });

            items.sort((a, b) => a.studentName.localeCompare(b.studentName));
            setContracts(items);
        } catch (error) {
            console.error('Error fetching contracts:', error);
            showAlert('Erro ao carregar contratos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleResetContract = (contract: ContractItem) => {
        showConfirm(
            `⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nVocê está prestes a EXCLUIR os dados de contrato/assinatura de:\n\n📋 Aluno: ${contract.studentName}\n👤 Responsável: ${contract.responsavelName}\n\nO aluno ficará sem contrato e precisará ser aprovado novamente para gerar um novo.\n\nDeseja continuar?`,
            async () => {
                try {
                    const docRef = doc(db, 'rumo_ao_esporte_2026_registrations', contract.registrationId);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const updatedAlunos = normalizeAlunos(data.alunos);
                        if (updatedAlunos[contract.studentIndex]) {
                            // Clear signature and custom contract if exists
                            delete updatedAlunos[contract.studentIndex].signatureData;
                            delete updatedAlunos[contract.studentIndex].customContract;

                            await updateDoc(docRef, {
                                alunos: updatedAlunos,
                                contractGenerated: false // Reset generation status
                            });

                            showAlert('Contrato e assinatura excluídos com sucesso.', 'success');
                            fetchContracts();
                        }
                    }
                } catch (error) {
                    console.error('Error resetting contract:', error);
                    showAlert('Erro ao excluir contrato', 'error');
                }
            },
            'error'
        );
    };

    const handleContractClick = (contract: ContractItem) => {
        if (!contract.contractGenerated) {
            showConfirm(
                `📄 O contrato para ${contract.studentName} ainda não foi gerado.\n\nPara gerar o contrato, você precisa aprovar o cadastro do aluno.\n\nDeseja ir para a página de detalhes agora?`,
                () => navigate(`/admin/details/${contract.registrationId}`),
                'info',
                'Contrato não gerado'
            );
            return;
        }
        navigate(`/admin/contract/${contract.registrationId}/${contract.studentIndex}`);
    };

    const getContractKey = (contract: ContractItem) => `${contract.registrationId}-${contract.studentIndex}`;

    const handlePlanChange = (contract: ContractItem, newPlanId: string) => {
        const key = getContractKey(contract);
        if (newPlanId === contract.planoId) {
            // Reverted to original, remove pending
            const updated = { ...pendingPlanChanges };
            delete updated[key];
            setPendingPlanChanges(updated);
        } else {
            setPendingPlanChanges(prev => ({ ...prev, [key]: newPlanId }));
        }
    };

    const savePlanChange = async (contract: ContractItem) => {
        const key = getContractKey(contract);
        const newPlanId = pendingPlanChanges[key];
        if (!newPlanId) return;

        try {
            const docRef = doc(db, 'rumo_ao_esporte_2026_registrations', contract.registrationId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const updatedAlunos = normalizeAlunos(data.alunos);
                updatedAlunos[contract.studentIndex] = {
                    ...updatedAlunos[contract.studentIndex],
                    planoId: newPlanId
                };
                await updateDoc(docRef, { alunos: updatedAlunos });

                // Remove from pending and refresh
                const updated = { ...pendingPlanChanges };
                delete updated[key];
                setPendingPlanChanges(updated);

                showAlert('Plano atualizado com sucesso!', 'success');
                fetchContracts();
            }
        } catch (error) {
            console.error('Error saving plan:', error);
            showAlert('Erro ao salvar plano', 'error');
        }
    };

    const filteredContracts = contracts.filter(c => {
        const matchesSearch = c.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.responsavelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.responsavelCpf.includes(searchTerm);

        const matchesModality = c.modalidade === selectedModality;

        const matchesStatus = filterStatus === 'todos' ||
            (filterStatus === 'assinados' && c.signed) ||
            (filterStatus === 'pendentes' && !c.signed);

        return matchesSearch && matchesModality && matchesStatus;
    });

    return (
        <PageContainer>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                <FileText size={28} color="#00a63a" />
                <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>Lista de Contratos</h1>
            </div>

            {/* Modalidade Tabs */}
            <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '20px',
                overflowX: 'auto',
                paddingBottom: '5px',
                borderBottom: '1px solid #eee'
            }}>
                {MODALIDADES.map(mod => (
                    <button
                        key={mod.id}
                        onClick={() => setSelectedModality(mod.label)}
                        style={{
                            padding: '10px 20px',
                            background: selectedModality === mod.label ? '#00a63a' : 'transparent',
                            color: selectedModality === mod.label ? '#fff' : '#666',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s',
                            boxShadow: selectedModality === mod.label ? '0 2px 5px rgba(0, 166, 58, 0.28)' : 'none'
                        }}
                    >
                        {mod.label}
                    </button>
                ))}
            </div>

            {/* Search and Actions Bar */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nome do aluno, responsável ou CPF..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="native-input"
                        style={{ paddingLeft: '40px', width: '100%' }}
                    />
                </div>

                <button
                    onClick={() => navigate('/admin/contratos/modelo')}
                    className="native-btn"
                    style={{ background: '#1565c0', color: '#fff' }}
                >
                    <FileText size={18} /> Editar Modelo Global
                </button>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    onClick={() => setFilterStatus('todos')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #ddd',
                        background: filterStatus === 'todos' ? '#333' : '#fff',
                        color: filterStatus === 'todos' ? '#fff' : '#666',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Todos
                </button>
                <button
                    onClick={() => setFilterStatus('assinados')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #ddd',
                        background: filterStatus === 'assinados' ? '#2e7d32' : '#fff',
                        color: filterStatus === 'assinados' ? '#fff' : '#666',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                >
                    <Check size={16} /> Assinados
                </button>
                <button
                    onClick={() => setFilterStatus('pendentes')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #ddd',
                        background: filterStatus === 'pendentes' ? '#f57c00' : '#fff',
                        color: filterStatus === 'pendentes' ? '#fff' : '#666',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                >
                    <AlertTriangle size={16} /> Pendentes
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div className="native-card" style={{ padding: '15px 25px', flex: 1, minWidth: '150px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>{contracts.length}</div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>Total de Contratos</div>
                </div>
                <div className="native-card" style={{ padding: '15px 25px', flex: 1, minWidth: '150px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2e7d32' }}>{contracts.filter(c => c.hasCustomContract).length}</div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>Contratos Customizados</div>
                </div>
                <div className="native-card" style={{ padding: '15px 25px', flex: 1, minWidth: '150px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1565c0' }}>{contracts.filter(c => !c.hasCustomContract).length}</div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>Usando Modelo Padrão</div>
                </div>
            </div>

            {/* Contracts List - Responsive */}
            {loading ? (
                <div className="loading-container">Carregando contratos...</div>
            ) : filteredContracts.length === 0 ? (
                <div className="native-card" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                    {searchTerm ? 'Nenhum contrato encontrado para esta busca.' : 'Nenhum contrato cadastrado.'}
                </div>
            ) : (
                <>
                    {/* Desktop Table - hidden on mobile */}
                    <div className="native-card desktop-only" style={{ overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: '#333' }}>Aluno</th>
                                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: '#333' }}>Responsável</th>
                                    <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Plano</th>
                                    <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Cadastro</th>
                                    <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Status</th>
                                    <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredContracts.map((contract, idx) => (
                                    <tr
                                        key={`${contract.registrationId}-${contract.studentIndex}`}
                                        onClick={() => handleContractClick(contract)}
                                        style={{
                                            borderBottom: '1px solid #eee',
                                            background: idx % 2 === 0 ? '#fff' : '#fafafa',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f7ff'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa'}
                                    >
                                        <td style={{ padding: '15px' }}>
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/admin/details/${contract.registrationId}`);
                                                }}
                                                style={{
                                                    fontWeight: 'bold',
                                                    color: '#333',
                                                    textDecoration: 'underline',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {contract.studentName}
                                            </div>
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            <div style={{ color: '#555' }}>{contract.responsavelName}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#999' }}>{contract.responsavelCpf}</div>
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                            <select
                                                value={pendingPlanChanges[getContractKey(contract)] || contract.planoId || ''}
                                                onChange={(e) => handlePlanChange(contract, e.target.value)}
                                                style={{
                                                    padding: '6px 10px',
                                                    borderRadius: '6px',
                                                    border: pendingPlanChanges[getContractKey(contract)] ? '2px solid #ff9800' : '1px solid #ddd',
                                                    background: pendingPlanChanges[getContractKey(contract)] ? '#fff8e1' : '#fff',
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer',
                                                    minWidth: '140px'
                                                }}
                                            >
                                                {plans.map(plan => (
                                                    <option key={plan.id} value={plan.id}>
                                                        {plan.nome}{plan.isDefault ? ' (★)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            {contract.signed ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                                    <div style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                        <Check size={16} /> Assinado
                                                    </div>
                                                    {contract.signatureData && (
                                                        <img
                                                            src={contract.signatureData}
                                                            alt="Assinatura"
                                                            style={{
                                                                maxWidth: '100px',
                                                                maxHeight: '40px',
                                                                objectFit: 'contain',
                                                                padding: '2px'
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            ) : !contract.contractGenerated ? (
                                                <div style={{ color: '#999', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                    Sem Contrato
                                                </div>
                                            ) : (
                                                <div style={{ color: '#f57c00', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                    <AlertTriangle size={16} /> Pendente
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center', color: '#666' }}>{contract.createdAt}</td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                background: contract.hasCustomContract ? '#e8f5e9' : '#e3f2fd',
                                                color: contract.hasCustomContract ? '#2e7d32' : '#1565c0'
                                            }}>
                                                {contract.hasCustomContract ? 'CUSTOMIZADO' : 'PADRÃO'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                {pendingPlanChanges[getContractKey(contract)] && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); savePlanChange(contract); }}
                                                        style={{
                                                            background: '#e8f5e9',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            padding: '8px 12px',
                                                            cursor: 'pointer',
                                                            color: '#2e7d32',
                                                            fontWeight: 'bold',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                        title="Salvar alteração de plano"
                                                    >
                                                        <Check size={16} /> Salvar
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleResetContract(contract); }}
                                                    style={{
                                                        background: '#ffebee',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '8px',
                                                        cursor: 'pointer',
                                                        color: '#00a63a'
                                                    }}
                                                    title="Excluir Contrato e Assinatura"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile/Tablet Cards - hidden on desktop */}
                    <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredContracts.map((contract) => (
                            <div
                                key={`card-${contract.registrationId}-${contract.studentIndex}`}
                                className="native-card"
                                onClick={() => handleContractClick(contract)}
                                style={{
                                    padding: '16px',
                                    cursor: 'pointer',
                                    transition: 'box-shadow 0.2s, transform 0.2s'
                                }}
                            >
                                {/* Header Row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333', marginBottom: '4px' }}>
                                            {contract.studentName}
                                        </div>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '3px 10px',
                                            borderRadius: '12px',
                                            fontSize: '0.7rem',
                                            fontWeight: 'bold',
                                            background: contract.hasCustomContract ? '#e8f5e9' : '#e3f2fd',
                                            color: contract.hasCustomContract ? '#2e7d32' : '#1565c0'
                                        }}>
                                            {contract.hasCustomContract ? 'CUSTOMIZADO' : 'PADRÃO'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#999', textAlign: 'right' }}>
                                        <div style={{ marginBottom: '4px' }}>{contract.createdAt}</div>
                                        {contract.signed ? (
                                            <div style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                <Check size={14} /> Assinado
                                            </div>
                                        ) : !contract.contractGenerated ? (
                                            <div style={{ color: '#999', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                Sem Contrato
                                            </div>
                                        ) : (
                                            <div style={{ color: '#f57c00', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                <AlertTriangle size={14} /> Pendente
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {contract.signatureData && (
                                    <div style={{ marginBottom: '12px', textAlign: 'center', padding: '5px' }}>
                                        <img
                                            src={contract.signatureData}
                                            alt="Assinatura"
                                            style={{ maxHeight: '50px', maxWidth: '100%', objectFit: 'contain' }}
                                        />
                                    </div>
                                )}

                                {/* Info Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '2px' }}>Responsável</div>
                                        <div style={{ fontSize: '0.9rem', color: '#555' }}>{contract.responsavelName}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#999' }}>{contract.responsavelCpf}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '2px' }}>Plano</div>
                                        <select
                                            value={pendingPlanChanges[getContractKey(contract)] || contract.planoId || ''}
                                            onChange={(e) => { e.stopPropagation(); handlePlanChange(contract, e.target.value); }}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                width: '100%',
                                                padding: '8px 10px',
                                                borderRadius: '6px',
                                                border: pendingPlanChanges[getContractKey(contract)] ? '2px solid #ff9800' : '1px solid #ddd',
                                                background: pendingPlanChanges[getContractKey(contract)] ? '#fff8e1' : '#fff',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {plans.map(plan => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.nome}{plan.isDefault ? ' ★' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Actions Row */}
                                {(pendingPlanChanges[getContractKey(contract)] || contract.hasCustomContract) && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '10px',
                                        paddingTop: '12px',
                                        borderTop: '1px solid #eee',
                                        justifyContent: 'flex-end'
                                    }}>
                                        {pendingPlanChanges[getContractKey(contract)] && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); savePlanChange(contract); }}
                                                style={{
                                                    background: '#e8f5e9',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '10px 16px',
                                                    cursor: 'pointer',
                                                    color: '#2e7d32',
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '0.9rem'
                                                }}
                                            >
                                                <Check size={18} /> Salvar Plano
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleResetContract(contract); }}
                                            style={{
                                                background: '#ffebee',
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '10px 16px',
                                                cursor: 'pointer',
                                                color: '#00a63a',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            <Trash2 size={18} /> Apagar Contrato
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Responsive CSS */}
                    <style>{`
                        .desktop-only { display: block; }
                        .mobile-only { display: none !important; }
                        
                        @media (max-width: 900px) {
                            .desktop-only { display: none !important; }
                            .mobile-only { display: flex !important; }
                        }
                    `}</style>
                </>
            )}

        </PageContainer>
    );
}
