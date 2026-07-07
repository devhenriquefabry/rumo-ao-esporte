
import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { normalizeModality } from '../../utils/turmasConstants';

interface AddModalityModalProps {
    show: boolean;
    onClose: () => void;
    onConfirm: (config: { modality: string, turmaId: string, planId: string }) => void;
    isProcessing: boolean;
    currentModalities: string[];
    turmas: any[];
    plans: any[];
}

const MODALITIES = [
    { id: 'futebol', label: 'Futebol' }
];

export default function AddModalityModal({
    show, onClose, onConfirm, isProcessing,
    currentModalities = [], turmas = [], plans = []
}: AddModalityModalProps) {
    const [selectedModality, setSelectedModality] = useState('');
    const [selectedTurma, setSelectedTurma] = useState('');
    const [selectedPlan, setSelectedPlan] = useState('');

    if (!show) return null;

    const availableModalities = MODALITIES.filter(m => {
        const normalizedCurrent = (currentModalities || []).map(curr => normalizeModality(curr));
        return !normalizedCurrent.includes(normalizeModality(m.id));
    });

    const handleConfirm = () => {
        if (!selectedModality || !selectedPlan) return;
        onConfirm({
            modality: selectedModality,
            turmaId: selectedTurma,
            planId: selectedPlan
        });
    };

    return (
        <>
            <div className="bottom-sheet-overlay" onClick={onClose} />
            <div className="bottom-sheet" style={{ maxHeight: '90vh', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div className="bottom-sheet-handle" />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#333' }}>Cadastrar Nova Modalidade</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#999' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
                    <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '20px' }}>
                        Selecione a atividade adicional, turma e plano para este aluno.
                    </p>

                    {/* 1. Modality Selection */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>MODALIDADE</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            {availableModalities.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => {
                                        setSelectedModality(m.id);
                                        setSelectedTurma(''); // Reset turma when modality changes
                                    }}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: selectedModality === m.id ? '2px solid #00a63a' : '1px solid #eee',
                                        background: selectedModality === m.id ? '#eef8ff' : '#f9f9f9',
                                        fontWeight: 'bold',
                                        color: selectedModality === m.id ? '#00a63a' : '#333',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. Turma Selection */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>TURMA / HORÁRIO</label>
                        <select
                            disabled={!selectedModality}
                            value={selectedTurma}
                            onChange={(e) => setSelectedTurma(e.target.value)}
                            className="native-input"
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                        >
                            <option value="">Selecione uma turma...</option>
                            {(turmas || [])
                                .filter(t => normalizeModality(t.modalidade) === normalizeModality(selectedModality))
                                .map(t => (
                                    <option key={t.id} value={t.id}>{t.nome} ({t.horario})</option>
                                ))}
                        </select>
                    </div>

                    {/* 3. Plan Selection */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>PLANO DE PAGAMENTO</label>
                        <select
                            value={selectedPlan}
                            onChange={(e) => setSelectedPlan(e.target.value)}
                            className="native-input"
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                        >
                            <option value="">Selecione um plano...</option>
                            {(plans || []).map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.nome} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((p.valores?.mensalidade?.ateVencimento || 0) / 100)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <button
                    disabled={!selectedModality || !selectedPlan || isProcessing}
                    onClick={handleConfirm}
                    style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: '12px',
                        background: (selectedModality && selectedPlan && !isProcessing) ? '#00a63a' : '#ccc',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: (selectedModality && selectedPlan && !isProcessing) ? 'pointer' : 'not-allowed',
                        marginTop: '10px'
                    }}
                >
                    {isProcessing ? 'Processando...' : <Check size={20} />}
                    CONFIRMAR E GERAR CONTRATO
                </button>
            </div>
        </>
    );
}
