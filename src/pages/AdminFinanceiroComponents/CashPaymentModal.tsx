import { useState, useEffect } from 'react';
import { X, Wallet, Tag, Edit3 } from 'lucide-react';

interface CashPaymentModalProps {
    isOpen: boolean;
    payment: {
        id: string;
        description?: string;
        value: number;
        dueDate: string;
        discount?: {
            value: number;
            type?: 'FIXED' | 'PERCENTAGE';
        };
    } | null;
    onClose: () => void;
    onConfirm: (value: number) => void;
}

export function CashPaymentModal({ isOpen, payment, onClose, onConfirm }: CashPaymentModalProps) {
    const [customValue, setCustomValue] = useState<string>('');

    useEffect(() => {
        if (!isOpen) setCustomValue('');
    }, [isOpen]);

    if (!isOpen || !payment) return null;

    const p = payment;
    const hasDiscount = (p.discount?.value ?? 0) > 0;
    const dueDate = new Date(p.dueDate + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const notDueYet = dueDate >= today;

    // Calculate discount value
    const isPercentage = p.discount?.type === 'PERCENTAGE';
    const discountFixedValue = isPercentage
        ? (p.value * (p.discount?.value ?? 0)) / 100
        : (p.discount?.value ?? 0);

    const discountedValue = p.value - discountFixedValue;
    const fullValue = p.value;

    // Determine if discount option should be available
    const canApplyDiscount = hasDiscount && notDueYet;

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const handleConfirmCustom = () => {
        const val = parseFloat(customValue.replace(',', '.'));
        if (isNaN(val) || val <= 0) {
            alert('Por favor, insira um valor válido.');
            return;
        }
        onConfirm(val);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 11000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)'
        }}>
            <div style={{
                background: '#fff', borderRadius: '20px', padding: '28px',
                width: '95%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#111', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Wallet size={22} color="#16a34a" />
                        RECEBER EM DINHEIRO
                    </h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
                    Selecione o valor ou digite um valor personalizado para <strong>"{p.description || 'Mensalidade'}"</strong>:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Option 1: Discounted Value */}
                    {canApplyDiscount && (
                        <button
                            onClick={() => onConfirm(discountedValue)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '16px 20px', borderRadius: '12px',
                                background: '#fefce8', border: '2px solid #eab308',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Tag size={20} color="#ca8a04" />
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: '800', color: '#ca8a04', fontSize: '1rem' }}>
                                        Valor com Desconto
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#eab308' }}>
                                        Pagamento antecipado
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontWeight: '900', color: '#ca8a04', fontSize: '1.2rem' }}>
                                {formatCurrency(discountedValue)}
                            </div>
                        </button>
                    )}

                    {/* Option 2: Full Value */}
                    <button
                        onClick={() => onConfirm(fullValue)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px 20px', borderRadius: '12px',
                            background: '#f0fdf4',
                            border: '2px solid #22c55e',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Wallet size={20} color="#16a34a" />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: '800', color: '#16a34a', fontSize: '1rem' }}>
                                    Valor Integral
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#4ade80' }}>
                                    Sem desconto
                                </div>
                            </div>
                        </div>
                        <div style={{ fontWeight: '900', color: '#16a34a', fontSize: '1.2rem' }}>
                            {formatCurrency(fullValue)}
                        </div>
                    </button>

                    {/* Option 3: Custom Value Input */}
                    <div style={{ marginTop: '10px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                            Outro Valor (Ex: Parcial ou com juros)
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 'bold' }}>R$</span>
                                <input
                                    type="text"
                                    value={customValue}
                                    onChange={(e) => setCustomValue(e.target.value.replace(/[^\d,]/g, ''))}
                                    placeholder="0,00"
                                    style={{
                                        width: '100%', padding: '12px 12px 12px 35px',
                                        border: '2px solid #cbd5e1', borderRadius: '8px',
                                        fontSize: '1rem', fontWeight: '700', outline: 'none',
                                        color: '#334155'
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleConfirmCustom}
                                disabled={!customValue}
                                style={{
                                    padding: '0 15px', background: '#334155', color: '#fff',
                                    border: 'none', borderRadius: '8px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    opacity: customValue ? 1 : 0.5
                                }}
                            >
                                <Edit3 size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    style={{
                        width: '100%', marginTop: '20px', padding: '12px',
                        background: '#f1f5f9', border: 'none', borderRadius: '10px',
                        color: '#64748b', fontWeight: '700', cursor: 'pointer'
                    }}
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
}
