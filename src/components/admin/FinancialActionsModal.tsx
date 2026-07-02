import { useState, useEffect } from 'react';
import { X, FileText, Send, RefreshCw } from 'lucide-react';

interface FinancialActionsModalProps {
    show: boolean;
    onClose: () => void;
    onMigrate: (planId: string, modality: string) => void;
    onCreateCharge: (data: { description: string; value: number; dueDate: string; billingType: string }) => void;
    isMigrating: boolean;
    isCreatingCharge: boolean;
    data: any;
    plans: any[];
}

export default function FinancialActionsModal({
    show, onClose, onMigrate, onCreateCharge, isMigrating, isCreatingCharge, data, plans
}: FinancialActionsModalProps) {
    // Migration State
    const [selectedModality, setSelectedModality] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState('');

    // Manual Charge State
    const [chargeDescription, setChargeDescription] = useState('');
    const [chargeValue, setChargeValue] = useState('');
    const [chargeDueDate, setChargeDueDate] = useState(new Date().toISOString().split('T')[0]);
    const [chargeBillingType, setChargeBillingType] = useState('PIX');

    useEffect(() => {
        if (show && data) {
            setSelectedModality(data.modalidade || '');
            setSelectedPlanId(data.planId || '');
        }
    }, [show, data]);

    if (!show) return null;

    const alunoNome = data.alunos && data.alunos[0] ? data.alunos[0].nome : 'Aluno';

    // Migration Helpers
    const modalities = Array.from(new Set(plans.filter(p => p.active !== false).map(p => p.modalidade))).sort();
    const filteredPlans = plans.filter(p => p.active !== false && p.modalidade === selectedModality);

    const handleMigrate = () => {
        if (!selectedPlanId || !selectedModality) return;
        onMigrate(selectedPlanId, selectedModality);
    };

    // Charge Helpers
    const handleCreateCharge = () => {
        const numericValue = parseFloat(chargeValue.replace(',', '.'));
        if (isNaN(numericValue) || !chargeDescription || !chargeDueDate) return;

        onCreateCharge({
            description: chargeDescription,
            value: numericValue,
            dueDate: chargeDueDate,
            billingType: chargeBillingType
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div className="animate-scale-in" style={{
                background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '12px',
                overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                position: 'relative', display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 25px', borderBottom: '1px solid #eee', position: 'relative', flexShrink: 0 }}>
                    <div style={{ color: '#007d2f', fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                        GERENCIAR FINANCEIRO
                    </div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>{alunoNome}</div>

                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: '15px', right: '15px',
                            background: '#f5f5f5', border: 'none', borderRadius: '4px',
                            width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', cursor: 'pointer', color: '#666'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div style={{ padding: '25px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                        {/* SECTION 1: MIGRATION */}
                        <div style={{
                            border: '1px solid #007d2f', borderRadius: '8px', padding: '20px',
                            background: '#fff', position: 'relative'
                        }}>
                            <div style={{
                                color: '#007d2f', fontWeight: '900', fontSize: '0.8rem',
                                textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '0.5px'
                            }}>
                                MIGRAÇÃO DE PLANO / MODALIDADE
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                <select
                                    value={selectedModality}
                                    onChange={(e) => {
                                        setSelectedModality(e.target.value);
                                        setSelectedPlanId('');
                                    }}
                                    style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem' }}
                                >
                                    <option value="">Modalidade...</option>
                                    {modalities.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>

                                <select
                                    value={selectedPlanId}
                                    onChange={(e) => setSelectedPlanId(e.target.value)}
                                    style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem' }}
                                >
                                    <option value="">Plano...</option>
                                    {filteredPlans.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.nome} - R$ {(p.valores.mensalidade.ateVencimento / 100).toFixed(2).replace('.', ',')}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleMigrate}
                                disabled={!selectedPlanId || isMigrating}
                                style={{
                                    width: '100%', padding: '12px', background: '#007d2f', color: '#fff',
                                    border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem',
                                    cursor: 'pointer', opacity: (selectedPlanId && !isMigrating) ? 1 : 0.6,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                {isMigrating ? <RefreshCw size={16} className="spin" /> : null}
                                {isMigrating ? 'Processando...' : 'Confirmar Migração'}
                            </button>
                        </div>

                        {/* SECTION 2: MANUAL CHARGE */}
                        <div style={{
                            border: '1px solid #007d2f', borderRadius: '8px', padding: '20px',
                            background: '#fff', position: 'relative'
                        }}>
                            <div style={{
                                color: '#007d2f', fontWeight: '900', fontSize: '0.8rem',
                                textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '0.5px'
                            }}>
                                LANÇAMENTO MANUAL DE COBRANÇA
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div className="admin-form-group">
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#999', marginBottom: '5px' }}>DESCRIÇÃO</label>
                                    <div style={{ position: 'relative' }}>
                                        <FileText size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                                        <input
                                            type="text"
                                            placeholder="Ex: Taxa de Competição"
                                            value={chargeDescription}
                                            onChange={(e) => setChargeDescription(e.target.value)}
                                            style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div className="admin-form-group">
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#999', marginBottom: '5px' }}>VALOR (R$)</label>
                                        <input
                                            type="text"
                                            placeholder="0,00"
                                            value={chargeValue}
                                            onChange={(e) => setChargeValue(e.target.value.replace(/[^\d,.]/g, ''))}
                                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}
                                        />
                                    </div>
                                    <div className="admin-form-group">
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#999', marginBottom: '5px' }}>VENCIMENTO</label>
                                        <input
                                            type="date"
                                            value={chargeDueDate}
                                            onChange={(e) => setChargeDueDate(e.target.value)}
                                            style={{ width: '100%', padding: '9px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                </div>

                                <div className="admin-form-group">
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#999', marginBottom: '5px' }}>FORMA DE PAGAMENTO</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {['PIX', 'BOLETO'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setChargeBillingType(type)}
                                                style={{
                                                    flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid',
                                                    borderColor: chargeBillingType === type ? '#007d2f' : '#ddd',
                                                    background: chargeBillingType === type ? '#fff0f0' : '#fff',
                                                    color: chargeBillingType === type ? '#007d2f' : '#666',
                                                    fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem'
                                                }}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreateCharge}
                                    disabled={!chargeDescription || !chargeValue || isCreatingCharge}
                                    style={{
                                        width: '100%', padding: '12px', background: '#111', color: '#fff',
                                        border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem',
                                        cursor: 'pointer', marginTop: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        opacity: (!chargeDescription || !chargeValue || isCreatingCharge) ? 0.6 : 1
                                    }}
                                >
                                    {isCreatingCharge ? <RefreshCw size={16} className="spin" /> : <Send size={16} />}
                                    {isCreatingCharge ? 'Enviando...' : 'GERAR COBRANÇA'}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '15px 25px', borderTop: '1px solid #eee', textAlign: 'center', flexShrink: 0 }}>
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%', padding: '10px', background: 'transparent', color: '#666',
                            border: '1px solid #eee', borderRadius: '4px', fontSize: '0.9rem',
                            fontWeight: 'bold', cursor: 'pointer'
                        }}
                    >
                        FECHAR PAINEL
                    </button>
                </div>

                <style>{`
                    .spin { animation: spin 1s linear infinite; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    .animate-scale-in { animation: scaleIn 0.2s ease-out; }
                    @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                `}</style>
            </div>
        </div>
    );
}
