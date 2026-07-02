import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, DollarSign, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PaymentCard } from './PaymentCard';

interface FinancialHistorySectionProps {
    id: string;
    cpf: string;
    workerUrl: string;
    plans: any[];
    currentPlanId: string;
    contractStatus?: string;
    responsibleName?: string;
    responsiblePhone?: string;
    onAddModality?: () => void;
    allRegistrations?: any[];
    canEdit?: boolean;
    filterModality?: string;
}

export default function FinancialHistorySection({ id, cpf, workerUrl, plans, currentPlanId, contractStatus, responsibleName, responsiblePhone, onAddModality, allRegistrations = [], canEdit = true, filterModality }: FinancialHistorySectionProps) {
    const navigate = useNavigate();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showFuture, setShowFuture] = useState(false);
    const [showPaid, setShowPaid] = useState(false);
    const [activeTab, setActiveTab] = useState<'plan' | 'manual'>('plan');

    useEffect(() => {
        if (cpf) fetchHistory();

        const handleRefresh = () => fetchHistory();
        window.addEventListener('refresh-financial-history', handleRefresh);
        return () => window.removeEventListener('refresh-financial-history', handleRefresh);
    }, [cpf]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const custRes = await fetch(`${workerUrl}/customers-by-cpf/${cpf.replace(/\D/g, '')}`);
            const custData = await custRes.json();

            if (custData.success && custData.customer) {
                const payRes = await fetch(`${workerUrl}/payments?customer=${custData.customer.id}&limit=100`);
                const payData = await payRes.json();

                // Filtrar apenas cobranças deste sistema (ARENA2026) E desta modalidade específica
                const relevantModalities = (allRegistrations.length > 0 ? allRegistrations : [{ modalidade: (plans.find(p => p.id === currentPlanId)?.modalidade || '') }])
                    .map(r => r.modalidade?.toUpperCase())
                    .filter(Boolean);

                const filtered = (payData.data || []).filter((p: any) => {
                    const desc = (p.description || '').toUpperCase();

                    // Se houver filtro específico de modalidade (novo comportamento)
                    if (filterModality) {
                        const mod = filterModality.toUpperCase();
                        return desc.includes(`(${mod})`) || desc.includes(mod);
                    }

                    // Fallback para comportamento antigo (filtrar por todas as modalidades do aluno)
                    if (relevantModalities.length === 0) return true;
                    return relevantModalities.some(mod => desc.includes(`(${mod})`) || desc.includes(mod));
                });

                setHistory(filtered);
            } else {
                setHistory([]);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    };

    const manualCharges = history.filter(p => p.externalReference?.includes('MANUAL_'));
    const planCharges = history.filter(p => !p.externalReference?.includes('MANUAL_'));
    const displayedHistory = activeTab === 'plan' ? planCharges : manualCharges;
    const parseLocalDate = (value?: string) => {
        if (!value) return null;
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    };
    const now = new Date();
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const isCurrentOrOverdue = (payment: any) => {
        const dueDate = parseLocalDate(payment.dueDate);
        return !!dueDate && dueDate <= endOfCurrentMonth;
    };

    return (
        <div style={{
            marginTop: '20px',
            padding: '20px',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            position: 'relative',
            border: '1px solid #fee2e2'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px',
                flexWrap: 'wrap',
                gap: '10px'
            }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007d2f', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, minWidth: 'fit-content' }}>
                    <TrendingUp size={20} /> Pagamentos {filterModality && <span style={{ fontSize: '0.8rem', background: '#007d2f', color: '#fff', padding: '2px 8px', borderRadius: '4px', marginLeft: '5px' }}>{filterModality.toUpperCase()}</span>}
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => navigate(`/admin/financeiro?regId=${id}`)}
                        style={{
                            background: '#fff', color: '#007d2f', border: '1px solid #007d2f',
                            padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flex: 1, justifyContent: 'center', maxWidth: '200px'
                        }}
                    >
                        <DollarSign size={14} /> GERENCIAR
                    </button>

                    {onAddModality && canEdit && (
                        <button
                            onClick={onAddModality}
                            style={{
                                background: '#007d2f', color: '#fff', border: 'none',
                                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 'bold',
                                whiteSpace: 'nowrap', flex: '1.5', justifyContent: 'center', maxWidth: '220px',
                                boxShadow: '0 2px 4px rgba(0, 125, 47, 0.2)'
                            }}
                        >
                            + NOVA MODALIDADE
                        </button>
                    )}
                </div>
            </div>

            {/* Current Plan Display */}
            {contractStatus === 'aprovado' && (
                <div className="native-card" style={{
                    marginBottom: '20px',
                    background: '#fff5f5',
                    border: '1px solid #fee2e2',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '15px'
                }}>
                    <div>
                        <div className="section-title" style={{ marginBottom: '8px', fontSize: '0.7rem', color: '#007d2f' }}>MODALIDADES ATIVAS</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(allRegistrations.length > 0 ? allRegistrations : [{ planId: currentPlanId, modalidade: '' }]).map((reg, idx) => {
                                const plan = plans.find(p => p.id === reg.planId);
                                return (
                                    <div key={reg.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fee2e2' }}>
                                        <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>
                                            <span style={{ color: '#007d2f', marginRight: '8px' }}>{reg.modalidade?.toUpperCase()}</span>
                                            {plan?.nome || 'Plano não encontrado'}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                            R$ {plan?.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs Interface */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '0' }}>
                <button
                    onClick={() => setActiveTab('plan')}
                    style={{
                        padding: '10px 15px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        border: 'none',
                        background: 'none',
                        color: activeTab === 'plan' ? '#007d2f' : '#999',
                        borderBottom: activeTab === 'plan' ? '2px solid #007d2f' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    FATURAS DO PLANO ({planCharges.length})
                </button>
                <button
                    onClick={() => setActiveTab('manual')}
                    style={{
                        padding: '10px 15px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        border: 'none',
                        background: 'none',
                        color: activeTab === 'manual' ? '#007d2f' : '#999',
                        borderBottom: activeTab === 'manual' ? '2px solid #007d2f' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    LANÇAMENTOS MANUAIS ({manualCharges.length})
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>Carregando...</div>
            ) : displayedHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#999', border: '1px dashed #ddd', borderRadius: '8px' }}>
                    Nenhum registro encontrado nesta aba.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {(() => {
                        const pending = displayedHistory
                            .filter((p: any) => !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status))
                            .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

                        const paid = displayedHistory
                            .filter((p: any) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status))
                            .sort((a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

                        const open = pending.filter(isCurrentOrOverdue);
                        const future = pending.filter((p: any) => !isCurrentOrOverdue(p));

                        const renderP = (p: any, isCurrent: boolean) => (
                            <PaymentCard
                                key={p.id}
                                payment={p}
                                isAdmin={true}
                                isCurrentPayment={isCurrent}
                                showPaymentMethods={true}
                                responsibleName={responsibleName}
                                responsiblePhone={responsiblePhone}
                                onReceiveInCash={async () => {
                                    if (!window.confirm(`Confirmar recebimento em DINHEIRO no valor de R$ ${p.value.toFixed(2)}?`)) return;
                                    try {
                                        const payload = { paymentDate: new Date().toISOString().split('T')[0], value: p.value, notify: false };
                                        const res = await fetch(`${workerUrl}/payments/${p.id}/receive-in-cash`, {
                                            method: 'POST',
                                            body: JSON.stringify(payload),
                                            headers: { 'Content-Type': 'application/json' }
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            alert('Recebido com sucesso!');
                                            fetchHistory();
                                        } else {
                                            alert(data.error || 'Erro ao receber');
                                        }
                                    } catch (e) { console.error(e); alert('Erro de conexão'); }
                                }}
                            />
                        );

                        return (
                            <>
                                {/* Fatura em Aberto */}
                                {open.length > 0 && (
                                    <div>
                                        <div style={{ padding: '4px 0', fontSize: '0.75rem', color: '#007d2f', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #fee2e2' }}>
                                            {open.length > 1 ? `Faturas Em Aberto (${open.length})` : 'Fatura Em Aberto'}
                                        </div>
                                        <div style={{ border: '1px solid #fee2e2', borderRadius: '12px', overflow: 'hidden' }}>
                                            {open.map((p: any, idx: number) => renderP(p, idx === 0))}
                                        </div>
                                    </div>
                                )}

                                {/* Próximas */}
                                {future.length > 0 && (
                                    <div style={{ marginTop: '10px' }}>
                                        <div
                                            onClick={() => setShowFuture(!showFuture)}
                                            style={{ padding: '8px 0', fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                        >
                                            Próximas Faturas ({future.length})
                                            {showFuture ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </div>
                                        {showFuture && (
                                            <div style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
                                                {future.map(p => renderP(p, false))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Pagas */}
                                {paid.length > 0 && (
                                    <div style={{ marginTop: '10px' }}>
                                        <div
                                            onClick={() => setShowPaid(!showPaid)}
                                            style={{ padding: '8px 0', fontSize: '0.75rem', color: '#2e7d32', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                        >
                                            Faturas Pagas ({paid.length})
                                            {showPaid ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </div>
                                        {showPaid && (
                                            <div style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
                                                {paid.map(p => renderP(p, false))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
