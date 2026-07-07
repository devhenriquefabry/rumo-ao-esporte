import { useState } from 'react';

interface AssignClassModalProps {
    isOpen: boolean;
    teacherName: string;
    turmas: Array<{
        id: string;
        nome: string;
        modalidade: string;
        horario: string;
        dias?: string[];
        responsavel?: string;
    }>;
    onAssign: (turmaIds: string[]) => void;
    onClose: () => void;
}

export default function AssignClassModal({ isOpen, teacherName, turmas, onAssign, onClose }: AssignClassModalProps) {
    const [selectedModality, setSelectedModality] = useState('');
    const [selectedTurmaIds, setSelectedTurmaIds] = useState<string[]>([]);

    if (!isOpen) return null;

    const availableTurmas = turmas.filter(t => !t.responsavel);
    const modalities = Array.from(new Set(availableTurmas.map(t => t.modalidade))).sort();
    const filteredTurmas = availableTurmas.filter(t => t.modalidade === selectedModality).sort((a, b) => a.nome.localeCompare(b.nome));

    const handleClose = () => {
        setSelectedModality('');
        setSelectedTurmaIds([]);
        onClose();
    };

    const handleConfirm = () => {
        onAssign(selectedTurmaIds);
        setSelectedModality('');
        setSelectedTurmaIds([]);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px'
        }}>
            <div className="native-card" style={{ width: '100%', maxWidth: '500px', margin: 0, animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', padding: '30px', borderRadius: '25px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                <h2 style={{ margin: '0 0 10px 0', color: '#00a63a', fontSize: '1.4rem', fontWeight: '900' }}>Atribuir Turmas</h2>
                <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '0.9rem' }}>Vincular novos horários para <b>{teacherName}</b></p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '25px' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase' }}>1. Selecione a Modalidade</label>
                        <select
                            value={selectedModality}
                            onChange={(e) => {
                                setSelectedModality(e.target.value);
                                setSelectedTurmaIds([]);
                            }}
                            style={{
                                width: '100%', height: '50px', borderRadius: '12px', padding: '0 15px', border: '1.5px solid #eee', fontSize: '1rem', background: '#fff'
                            }}
                        >
                            <option value="">Escolha a modalidade...</option>
                            {modalities.map(mod => (
                                <option key={mod} value={mod}>{mod}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ opacity: selectedModality ? 1 : 0.5, pointerEvents: selectedModality ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <label style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase' }}>2. Escolher Turmas</label>
                            {selectedModality && filteredTurmas.length > 0 && (
                                <button
                                    onClick={() => {
                                        const allIds = filteredTurmas.map(t => t.id);
                                        const allSelected = allIds.every(id => selectedTurmaIds.includes(id));
                                        setSelectedTurmaIds(allSelected ? [] : allIds);
                                    }}
                                    style={{ background: 'none', border: 'none', color: '#00a63a', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    {filteredTurmas.every(t => selectedTurmaIds.includes(t.id)) ? 'DESMARCAR TUDO' : 'SELECIONAR TUDO'}
                                </button>
                            )}
                        </div>

                        <div style={{
                            maxHeight: '220px', overflowY: 'auto', border: '1.5px solid #eee', borderRadius: '15px', padding: '10px',
                            display: 'flex', flexDirection: 'column', gap: '8px', background: '#fafafa'
                        }}>
                            {selectedModality ? (
                                filteredTurmas.length > 0 ? (
                                    filteredTurmas.map(t => {
                                        const isSelected = selectedTurmaIds.includes(t.id);
                                        return (
                                            <label
                                                key={t.id}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 15px', borderRadius: '12px',
                                                    background: isSelected ? '#eef8ff' : '#fff', border: `1.5px solid ${isSelected ? '#00a63a' : '#eee'}`,
                                                    cursor: 'pointer', transition: 'all 0.2s'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        if (isSelected) {
                                                            setSelectedTurmaIds(selectedTurmaIds.filter(id => id !== t.id));
                                                        } else {
                                                            setSelectedTurmaIds([...selectedTurmaIds, t.id]);
                                                        }
                                                    }}
                                                    style={{ width: '18px', height: '18px', accentColor: '#00a63a' }}
                                                />
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isSelected ? '#00a63a' : '#333' }}>{t.nome}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#888' }}>{t.horario} • {t.dias?.join(', ')}</span>
                                                </div>
                                            </label>
                                        );
                                    })
                                ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#00a63a', fontSize: '0.85rem' }}>Não há turmas disponíveis para esta modalidade.</div>
                                )
                            ) : (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#bbb', fontSize: '0.85rem' }}>Escolha uma modalidade primeiro</div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <button
                        onClick={handleClose}
                        style={{ flex: 1, height: '50px', borderRadius: '15px', border: 'none', background: '#f5f5f5', color: '#666', fontWeight: '900', cursor: 'pointer' }}
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={selectedTurmaIds.length === 0}
                        style={{
                            flex: 1, height: '50px', borderRadius: '15px', border: 'none',
                            background: selectedTurmaIds.length > 0 ? '#00a63a' : '#ddd',
                            color: '#fff', fontWeight: '900', cursor: selectedTurmaIds.length > 0 ? 'pointer' : 'default',
                            boxShadow: selectedTurmaIds.length > 0 ? '0 6px 15px rgba(0, 166, 58, 0.28)' : 'none'
                        }}
                    >
                        CONFIRMAR {selectedTurmaIds.length > 0 && `(${selectedTurmaIds.length})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
