

import { ArrowLeft } from 'lucide-react';

interface TransferModalProps {
    show: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isTransferring: boolean;
    data: any;        // Dados completos do registro (para nome e modalidade)
    assignedTurma: any; // Objeto da turma atual (ou undefined/null)
    availableTurmas: any[];
    selectedTurmaId: string;
    setSelectedTurmaId: (id: string) => void;
}

export default function TransferModal({
    show, onClose, onConfirm, isTransferring,
    data, assignedTurma, availableTurmas, selectedTurmaId, setSelectedTurmaId
}: TransferModalProps) {
    if (!show) return null;

    const alunoNome = data.alunos && data.alunos[0] ? data.alunos[0].nome : 'Aluno';
    const modalidade = data.modalidade || '-';

    return (
        <>
            <div className="bottom-sheet-overlay" onClick={onClose} />
            <div className="bottom-sheet">
                <div className="bottom-sheet-handle" />
                <h3 style={{ margin: '0 0 20px 0', color: '#333', textAlign: 'center', fontSize: '1.1rem' }}>Remanejar Aluno</h3>

                <div className="native-card animate-scale-in" style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#007d2f', marginBottom: '5px' }}>{alunoNome}</div>
                    <div className="native-badge native-badge-info">{modalidade.toUpperCase()}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                    <div className="native-card" style={{ flex: 1, textAlign: 'center', margin: 0 }}>
                        <div className="section-title" style={{ marginBottom: '8px' }}>TURMA ATUAL</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>{assignedTurma ? assignedTurma.nome : '-'}</div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>{assignedTurma ? assignedTurma.horario : 'Sem turma'}</div>
                    </div>
                    <div style={{ color: '#007d2f', transform: 'rotate(180deg)' }}><ArrowLeft /></div>
                    <div className="native-card animate-target-border" style={{ flex: 1, textAlign: 'center', margin: 0, border: '2px dashed #007d2f' }}>
                        <div className="section-title" style={{ marginBottom: '8px', color: '#007d2f' }}>NOVA TURMA</div>
                        <select
                            value={selectedTurmaId}
                            onChange={(e) => setSelectedTurmaId(e.target.value)}
                            className="native-input"
                            style={{ textAlign: 'center', fontWeight: 'bold', padding: '10px' }}
                        >
                            <option value="">Selecionar...</option>
                            {availableTurmas.map(t => (
                                <option key={t.id} value={t.id}>{t.nome} ({t.horario})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        className="native-button native-button-secondary touch-feedback"
                        style={{ flex: 1 }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!selectedTurmaId || isTransferring}
                        className="native-button native-button-primary touch-feedback"
                        style={{ flex: 1, opacity: selectedTurmaId ? 1 : 0.5 }}
                    >
                        {isTransferring ? 'Processando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </>
    );
}
