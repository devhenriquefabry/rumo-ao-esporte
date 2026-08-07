import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Plan } from '../../../utils/planService';

interface BulkApproveModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    plans: Plan[];
    isProcessing: boolean;
    progress: { current: number; total: number };
    onConfirm: (planId: string, paymentDay: number, gerarCobranca: boolean) => void;
}

export const BulkApproveModal: React.FC<BulkApproveModalProps> = ({
    isOpen, onClose, selectedCount, plans, isProcessing, progress, onConfirm
}) => {
    const [planId, setPlanId] = useState('');
    const [paymentDay, setPaymentDay] = useState(10);
    // Ligado por padrao: aprovar sem gerar cobranca deixa o aluno "SEM COBRANÇA"
    // no financeiro ate alguem lembrar de refaturar manualmente depois.
    const [gerarCobranca, setGerarCobranca] = useState(true);

    useEffect(() => {
        if (isOpen && !planId) {
            const defaultPlan = plans.find(p => p.isDefault) || plans[0];
            if (defaultPlan) {
                setPlanId(defaultPlan.id);
                setPaymentDay(defaultPlan.paymentDay || 10);
            }
        }
    }, [isOpen, plans, planId]);

    const handlePlanChange = (id: string) => {
        setPlanId(id);
        // Preenche com o dia de vencimento padrão do plano; o admin ainda pode ajustar abaixo.
        const selectedPlan = plans.find(p => p.id === id);
        if (selectedPlan?.paymentDay) setPaymentDay(selectedPlan.paymentDay);
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '20px', backdropFilter: 'blur(3px)'
        }}>
            <div className="animate-scale-in" style={{
                background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px',
                padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, color: '#333', fontSize: '1.2rem', fontWeight: 'bold' }}>Aprovar em Lote</h3>
                    {!isProcessing && (
                        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}>
                            <X size={24} />
                        </button>
                    )}
                </div>

                {isProcessing ? (
                    <div style={{ padding: '20px 0', textAlign: 'center' }}>
                        <CheckCircle2 size={32} color="#00a63a" style={{ marginBottom: '10px' }} />
                        <p style={{ fontWeight: 'bold', color: '#333', margin: 0 }}>
                            Aprovando {progress.current} de {progress.total}...
                        </p>
                        <div style={{ background: '#eee', borderRadius: '8px', height: '10px', marginTop: '14px', overflow: 'hidden' }}>
                            <div style={{
                                background: '#00a63a', height: '100%',
                                width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                                transition: 'width 0.2s'
                            }} />
                        </div>
                    </div>
                ) : (
                    <>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '20px' }}>
                            Aprovar <strong>{selectedCount}</strong> cadastro(s) selecionado(s). A turma de cada aluno será alocada automaticamente pela idade.
                        </p>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
                                Plano a atribuir:
                            </label>
                            <select
                                value={planId}
                                onChange={(e) => handlePlanChange(e.target.value)}
                                style={{
                                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                                    border: '1px solid #ddd', fontSize: '0.85rem', color: '#444',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <option value="">Selecione um plano...</option>
                                {plans.map(p => (
                                    <option key={p.id} value={p.id}>{p.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
                                Dia de pagamento:
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={28}
                                value={paymentDay}
                                onChange={(e) => setPaymentDay(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
                                style={{
                                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                                    border: '1px solid #ddd', fontSize: '0.85rem', color: '#444',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <label style={{
                            display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px',
                            borderRadius: '10px', background: gerarCobranca ? '#fff8e1' : '#f8f9fa',
                            border: `1px solid ${gerarCobranca ? '#ffca28' : '#eee'}`, marginBottom: '20px', cursor: 'pointer'
                        }}>
                            <input
                                type="checkbox"
                                checked={gerarCobranca}
                                onChange={(e) => setGerarCobranca(e.target.checked)}
                                style={{ marginTop: '2px', accentColor: '#ff9800', width: '16px', height: '16px', flexShrink: 0 }}
                            />
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#333' }}>Gerar cobranças (carnês) automaticamente</div>
                                <div style={{ fontSize: '0.75rem', color: '#777', marginTop: '2px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                    <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '1px', color: '#ff9800' }} />
                                    <span>Cria faturas reais no Asaas para todos os selecionados. Deixe desmarcado para apenas aprovar e gerar as cobranças depois, individualmente.</span>
                                </div>
                            </div>
                        </label>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', fontWeight: 'bold' }}>Cancelar</button>
                            <button
                                onClick={() => onConfirm(planId, paymentDay, gerarCobranca)}
                                disabled={!planId}
                                style={{
                                    flex: 2, padding: '12px', borderRadius: '10px', border: 'none',
                                    background: '#00a63a', color: '#fff', fontWeight: 'bold',
                                    opacity: !planId ? 0.5 : 1, cursor: !planId ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Aprovar {selectedCount}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
