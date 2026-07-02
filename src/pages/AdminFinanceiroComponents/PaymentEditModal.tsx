import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface PaymentEditModalProps {
    isOpen: boolean;
    payment: any | null; // The payment object to edit
    onClose: () => void;
    onSave: (editForm: any) => Promise<void>;
}

export function PaymentEditModal({ isOpen, payment, onClose, onSave }: PaymentEditModalProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        description: '',
        value: '',
        dueDate: '',
        hasDiscount: false,
        discountType: 'PERCENTAGE' as 'FIXED' | 'PERCENTAGE',
        discountValue: '0'
    });

    useEffect(() => {
        if (isOpen && payment) {
            setEditForm({
                description: payment.description || '',
                value: String(payment.value || ''),
                dueDate: payment.dueDate || '',
                hasDiscount: !!(payment.discount && payment.discount.value > 0),
                discountType: payment.discount?.type || 'PERCENTAGE',
                discountValue: String(payment.discount?.value || '0')
            });
        }
    }, [isOpen, payment]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(editForm);
            onClose(); // Close on success? Hook calls showAlert. 
            // The hook also refreshes data. 
            // We can close here.
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !payment) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 11000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)'
        }}>
            <div style={{
                background: '#fff', borderRadius: '20px', padding: '28px',
                width: '95%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                maxHeight: '90vh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#111' }}>
                        EDITAR FATURA
                    </h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px', textTransform: 'uppercase' }}>Descrição</label>
                        <input
                            type="text"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '10px', fontSize: '0.95rem', outline: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px', textTransform: 'uppercase' }}>Valor (R$)</label>
                            <input
                                type="text"
                                value={editForm.value}
                                onChange={(e) => setEditForm({ ...editForm, value: e.target.value.replace(/[^\d,.]/g, '') })}
                                // Note: original code used replace(/[^\d,]/g, '') which implies comma decimal. 
                                // I'll stick to original behavior but allowing dot if user types it? 
                                // Original: replace(/[^\d,]/g, '')
                                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '10px', fontSize: '1rem', fontWeight: '700', outline: 'none' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px', textTransform: 'uppercase' }}>Vencimento</label>
                            <input
                                type="date"
                                value={editForm.dueDate}
                                onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '10px', fontSize: '0.95rem', outline: 'none' }}
                            />
                        </div>
                    </div>

                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <div
                            onClick={() => setEditForm({ ...editForm, hasDiscount: !editForm.hasDiscount })}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: editForm.hasDiscount ? '12px' : 0 }}
                        >
                            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Aplicar Desconto Antecipado</span>
                            <div style={{
                                width: '36px', height: '20px', background: editForm.hasDiscount ? '#10b981' : '#cbd5e1',
                                borderRadius: '10px', padding: '2px', transition: '0.3s', display: 'flex', alignItems: 'center'
                            }}>
                                <div style={{
                                    width: '16px', height: '16px', background: '#fff', borderRadius: '50%',
                                    transition: '0.3s', transform: editForm.hasDiscount ? 'translateX(16px)' : 'translateX(0)'
                                }} />
                            </div>
                        </div>

                        {editForm.hasDiscount && (
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                                <select
                                    value={editForm.discountType}
                                    onChange={(e) => setEditForm({ ...editForm, discountType: e.target.value as any })}
                                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                >
                                    <option value="PERCENTAGE">Porcentagem (%)</option>
                                    <option value="FIXED">Valor Fixo (R$)</option>
                                </select>
                                <input
                                    type="text"
                                    value={editForm.discountValue}
                                    onChange={(e) => setEditForm({ ...editForm, discountValue: e.target.value.replace(/[^\d,]/g, '') })}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}
                                />
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button
                            onClick={onClose}
                            style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #ddd', background: '#fff', color: '#666', fontWeight: '700', cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{
                                flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
                                background: '#007d2f', color: '#fff', fontWeight: '700', cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0, 125, 47, 0.2)',
                                opacity: isSaving ? 0.7 : 1
                            }}
                        >
                            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
