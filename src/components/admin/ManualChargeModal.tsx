import { useState } from 'react';
import { X, FileText, Send } from 'lucide-react';

interface ManualChargeModalProps {
    show: boolean;
    onClose: () => void;
    onConfirm: (data: { description: string; value: number; dueDate: string; billingType: string }) => void;
    isSubmitting: boolean;
    alunoNome: string;
}

export default function ManualChargeModal({
    show, onClose, onConfirm, isSubmitting, alunoNome
}: ManualChargeModalProps) {
    const [description, setDescription] = useState('');
    const [value, setValue] = useState('');
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
    const [billingType, setBillingType] = useState('PIX');

    if (!show) return null;

    const handleConfirm = () => {
        const numericValue = parseFloat(value.replace(',', '.'));
        if (isNaN(numericValue) || !description || !dueDate) return;

        onConfirm({
            description,
            value: numericValue,
            dueDate,
            billingType
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div className="animate-scale-in" style={{
                background: '#fff', width: '100%', maxWidth: '450px', borderRadius: '12px',
                overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                position: 'relative'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 25px', borderBottom: '1px solid #eee' }}>
                    <div style={{ color: '#007d2f', fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                        LANÇAMENTO MANUAL
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                        <div className="admin-form-group">
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px' }}>DESCRIÇÃO DO LANÇAMENTO</label>
                            <div style={{ position: 'relative' }}>
                                <FileText size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                                <input
                                    type="text"
                                    placeholder="Ex: Taxa de Competição"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div className="admin-form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px' }}>VALOR (R$)</label>
                                <input
                                    type="text"
                                    placeholder="0,00"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value.replace(/[^\d,.]/g, ''))}
                                    style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold' }}
                                />
                            </div>
                            <div className="admin-form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px' }}>VENCIMENTO</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    style={{ width: '100%', padding: '11px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem' }}
                                />
                            </div>
                        </div>

                        <div className="admin-form-group">
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px' }}>FORMA DE PAGAMENTO PRINCIPAL</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => setBillingType('PIX')}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid',
                                        borderColor: billingType === 'PIX' ? '#007d2f' : '#ddd',
                                        background: billingType === 'PIX' ? '#fff0f0' : '#fff',
                                        color: billingType === 'PIX' ? '#007d2f' : '#666',
                                        fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                    }}
                                >
                                    PIX
                                </button>
                                <button
                                    onClick={() => setBillingType('BOLETO')}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid',
                                        borderColor: billingType === 'BOLETO' ? '#007d2f' : '#ddd',
                                        background: billingType === 'BOLETO' ? '#fff0f0' : '#fff',
                                        color: billingType === 'BOLETO' ? '#007d2f' : '#666',
                                        fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                    }}
                                >
                                    BOLETO
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleConfirm}
                            disabled={!description || !value || isSubmitting}
                            style={{
                                width: '100%', padding: '15px', background: '#007d2f', color: '#fff',
                                border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem',
                                cursor: 'pointer', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                opacity: (!description || !value) ? 0.6 : 1, transition: 'all 0.2s'
                            }}
                        >
                            {isSubmitting ? (
                                <>Aguarde...</>
                            ) : (
                                <><Send size={18} /> GERAR LANÇAMENTO</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '15px 25px', borderTop: '1px solid #eee', textAlign: 'center' }}>
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%', padding: '10px', background: 'transparent', color: '#666',
                            border: '1px solid #eee', borderRadius: '8px', fontSize: '0.9rem',
                            fontWeight: 'bold', cursor: 'pointer'
                        }}
                    >
                        CANCELAR
                    </button>
                </div>
            </div>
        </div>
    );
}
