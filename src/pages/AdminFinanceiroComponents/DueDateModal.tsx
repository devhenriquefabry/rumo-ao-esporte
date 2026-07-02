import { useState, useEffect } from 'react';

interface DueDateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (date: string) => Promise<void>;
    initialDate?: string;
}

export function DueDateModal({ isOpen, onClose, onSave, initialDate = '' }: DueDateModalProps) {
    const [newDueDate, setNewDueDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setNewDueDate(initialDate);
        }
    }, [isOpen, initialDate]);

    const handleSave = async () => {
        if (!newDueDate) return;
        setIsSaving(true);
        try {
            await onSave(newDueDate);
            onClose();
        } catch (error) {
            // Error handling usually in the hook, but we stop spinner here
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                background: '#fff', borderRadius: '16px', padding: '24px',
                width: '90%', maxWidth: '350px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '700', color: '#111' }}>
                    Alterar Vencimento
                </h3>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '8px' }}>
                        Nova Data
                    </label>
                    <input
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        style={{
                            width: '100%', padding: '12px', borderRadius: '8px',
                            border: '1px solid #ddd', fontSize: '0.9rem', outline: 'none'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
                            background: '#fff', color: '#666', fontWeight: '600', cursor: 'pointer'
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                            background: '#007d2f', color: '#fff', fontWeight: '600', cursor: 'pointer',
                            opacity: isSaving ? 0.7 : 1
                        }}
                    >
                        {isSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
