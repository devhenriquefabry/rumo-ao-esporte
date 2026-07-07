import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface PlanMigrationModalProps {
    show: boolean;
    onClose: () => void;
    onConfirm: (planId: string, modality: string) => void;
    isMigrating: boolean;
    data: any;
    plans: any[];
}

export default function PlanMigrationModal({
    show, onClose, onConfirm, isMigrating, data, plans
}: PlanMigrationModalProps) {
    const [selectedModality, setSelectedModality] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState('');

    useEffect(() => {
        if (show && data) {
            setSelectedModality(data.modalidade || '');
            setSelectedPlanId(data.planId || '');
        }
    }, [show, data]);

    if (!show) return null;

    const alunoNome = data.alunos && data.alunos[0] ? data.alunos[0].nome : 'Aluno';

    // Get unique modalities from active plans
    const modalities = Array.from(new Set(plans.filter(p => p.active !== false).map(p => p.modalidade))).sort();

    // Filter plans based on selected modality
    const filteredPlans = plans.filter(p => p.active !== false && p.modalidade === selectedModality);

    const handleConfirm = () => {
        onConfirm(selectedPlanId, selectedModality);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div className="animate-scale-in" style={{
                background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '8px',
                overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                position: 'relative', display: 'flex', flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 25px', borderBottom: '1px solid #eee', position: 'relative' }}>
                    <div style={{ color: '#00a63a', fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                        FINANCEIRO
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

                {/* Body */}
                <div style={{ padding: '25px' }}>
                    <div style={{
                        border: '1px solid #00a63a', borderRadius: '4px', padding: '20px',
                        background: '#fff', position: 'relative'
                    }}>
                        <div style={{
                            color: '#00a63a', fontWeight: 'bold', fontSize: '0.85rem',
                            textTransform: 'uppercase', marginBottom: '15px'
                        }}>
                            MIGRAÇÃO DE PLANO / MODALIDADE
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <select
                                value={selectedModality}
                                onChange={(e) => {
                                    setSelectedModality(e.target.value);
                                    setSelectedPlanId(''); // Reset plan when modality changes
                                }}
                                className="native-input"
                                style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
                            >
                                <option value="">Modalidade...</option>
                                {modalities.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>

                            <select
                                value={selectedPlanId}
                                onChange={(e) => setSelectedPlanId(e.target.value)}
                                className="native-input"
                                style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
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
                            onClick={handleConfirm}
                            disabled={!selectedPlanId || !selectedModality || isMigrating}
                            style={{
                                width: '100%', padding: '12px', background: '#00a63a', color: '#fff',
                                border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.95rem',
                                cursor: 'pointer', opacity: (selectedPlanId && selectedModality) ? 1 : 0.6
                            }}
                        >
                            {isMigrating ? 'Processando...' : 'Confirmar Migração'}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '15px 25px', borderTop: '1px solid #eee', textAlign: 'center' }}>
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%', padding: '10px', background: 'transparent', color: '#666',
                            border: '1px solid #eee', borderRadius: '4px', fontSize: '0.9rem',
                            fontWeight: 'bold', cursor: 'pointer'
                        }}
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
