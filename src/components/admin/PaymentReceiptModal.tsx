import { useState } from 'react';
import {
    XCircle,
    FileText,
    Loader2,
    ExternalLink,
    QrCode,
    CreditCard,
    Banknote,
    CheckCircle2,
    Copy
} from 'lucide-react';
import { generatePaymentReceiptPDF } from '../../utils/receiptGenerator';

interface ReceiptPaymentData {
    id: string;
    description?: string;
    value: number;
    dueDate: string;
    status: string;
    billingType?: string;
    externalReference?: string;
    paymentDate?: string | null;
    totalPaid?: number | null;
    invoiceUrl?: string;
    provider?: string;
    payerName?: string;
    responsibleName?: string;
}

interface Props {
    payment: ReceiptPaymentData;
    onClose: () => void;
}

const formatCurrency = (value: number) =>
    (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateBR = (value?: string | null) => {
    if (!value) return '-';
    const datePart = String(value).split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    if (!year || !month || !day) return '-';
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
};

const formatDateTimeBR = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    // Só mostra a hora quando a Cora enviou timestamp completo, não apenas a data
    if (!String(value).includes('T')) return null;
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const paymentMethodInfo = (billingType?: string, status?: string) => {
    const type = String(billingType || '').toUpperCase();
    if (type === 'PIX') return { label: 'PIX', icon: QrCode, color: '#00bfa5' };
    if (type === 'BOLETO') return { label: 'BOLETO', icon: FileText, color: '#f59e0b' };
    if (type === 'CREDIT_CARD') return { label: 'CARTÃO', icon: CreditCard, color: '#3b82f6' };
    if (status === 'RECEIVED_IN_CASH') return { label: 'DINHEIRO', icon: Banknote, color: '#10b981' };
    return { label: type || 'OUTRO', icon: Banknote, color: '#94a3b8' };
};

export default function PaymentReceiptModal({ payment, onClose }: Props) {
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const method = paymentMethodInfo(payment.billingType, payment.status);
    const MethodIcon = method.icon;
    const paidValue = payment.totalPaid != null ? payment.totalPaid : payment.value;
    const paidTime = formatDateTimeBR(payment.paymentDate);

    const copyToClipboard = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(field);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            // Área de transferência bloqueada pelo navegador: silencioso, o valor segue visível na tela
        }
    };

    const handleDownload = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            await generatePaymentReceiptPDF(
                {
                    id: payment.id,
                    description: payment.description,
                    value: payment.value,
                    dueDate: payment.dueDate,
                    status: payment.status,
                    billingType: payment.billingType as any,
                    externalReference: payment.externalReference,
                    paymentDate: payment.paymentDate,
                    totalPaid: payment.totalPaid
                },
                payment.responsibleName || payment.payerName
            );
        } catch (e) {
            console.error('Erro ao gerar recibo:', e);
            alert('Erro ao gerar o recibo. Tente novamente.');
        } finally {
            setGenerating(false);
        }
    };

    const Row = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 0',
            borderBottom: '1px solid #f1f5f9'
        }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                {label}
            </span>
            <span style={{
                fontSize: '0.85rem',
                color: '#1e293b',
                fontWeight: '800',
                textAlign: 'right',
                fontFamily: mono ? 'monospace' : 'inherit',
                wordBreak: 'break-all'
            }}>
                {value}
            </span>
        </div>
    );

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15,23,42,0.6)',
                backdropFilter: 'blur(4px)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#fff',
                    width: '100%',
                    maxWidth: '460px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                    animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    padding: '24px',
                    borderRadius: '24px 24px 0 0',
                    position: 'relative'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: '10px',
                            width: '34px',
                            height: '34px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <XCircle size={18} color="#fff" />
                    </button>

                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255,255,255,0.22)',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        marginBottom: '12px'
                    }}>
                        <CheckCircle2 size={13} color="#fff" />
                        <span style={{ color: '#fff', fontSize: '0.68rem', fontWeight: '900', letterSpacing: '0.5px' }}>
                            PAGAMENTO CONFIRMADO
                        </span>
                    </div>

                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
                        {payment.payerName || 'Pagamento'}
                    </div>
                    <div style={{ color: '#fff', fontSize: '2rem', fontWeight: '900', lineHeight: 1.2, marginTop: '2px' }}>
                        {formatCurrency(paidValue)}
                    </div>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '8px',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: '800'
                    }}>
                        <MethodIcon size={14} color="#fff" />
                        PAGO COM {method.label}
                        {paidTime && <span style={{ opacity: 0.8, fontWeight: '600' }}>• {paidTime}</span>}
                    </div>
                </div>

                {/* Details */}
                <div style={{ padding: '20px 24px' }}>
                    <Row label="Data do pagamento" value={formatDateBR(payment.paymentDate) !== '-' ? formatDateBR(payment.paymentDate) : 'Confirmado no sistema'} />
                    <Row label="Vencimento" value={formatDateBR(payment.dueDate)} />
                    <Row label="Valor da cobrança" value={formatCurrency(payment.value)} />
                    {payment.totalPaid != null && payment.totalPaid !== payment.value && (
                        <Row label="Valor recebido" value={formatCurrency(payment.totalPaid)} />
                    )}
                    <Row label="Referente a" value={payment.description || '-'} />

                    {payment.externalReference && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 0',
                            borderBottom: '1px solid #f1f5f9'
                        }}>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                                Código da cobrança
                            </span>
                            <button
                                onClick={() => copyToClipboard(payment.externalReference!, 'ref')}
                                title="Copiar código"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontSize: '0.85rem',
                                    color: '#1e293b',
                                    fontWeight: '800',
                                    fontFamily: 'monospace',
                                    wordBreak: 'break-all',
                                    textAlign: 'right'
                                }}
                            >
                                {payment.externalReference}
                                <Copy size={12} color={copied === 'ref' ? '#059669' : '#94a3b8'} />
                            </button>
                        </div>
                    )}

                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 0'
                    }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                            ID {payment.provider === 'cora' ? 'Cora' : 'da fatura'}
                        </span>
                        <button
                            onClick={() => copyToClipboard(payment.id, 'id')}
                            title="Copiar ID"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '0.72rem',
                                color: '#64748b',
                                fontWeight: '700',
                                fontFamily: 'monospace',
                                wordBreak: 'break-all',
                                textAlign: 'right'
                            }}
                        >
                            {payment.id}
                            <Copy size={12} color={copied === 'id' ? '#059669' : '#cbd5e1'} />
                        </button>
                    </div>

                    {copied && (
                        <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: '800', textAlign: 'right', marginTop: '4px' }}>
                            Copiado!
                        </div>
                    )}

                    {/* Actions */}
                    <button
                        onClick={handleDownload}
                        disabled={generating}
                        style={{
                            width: '100%',
                            marginTop: '20px',
                            padding: '14px',
                            background: '#059669',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '14px',
                            fontWeight: '900',
                            fontSize: '0.85rem',
                            cursor: generating ? 'default' : 'pointer',
                            opacity: generating ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        {generating ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
                        {generating ? 'GERANDO RECIBO...' : 'BAIXAR RECIBO (PDF)'}
                    </button>

                    {payment.invoiceUrl && (
                        <a
                            href={payment.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                width: '100%',
                                marginTop: '10px',
                                padding: '12px',
                                background: '#fff',
                                color: '#64748b',
                                border: '1px solid #e2e8f0',
                                borderRadius: '14px',
                                fontWeight: '800',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                textDecoration: 'none',
                                boxSizing: 'border-box'
                            }}
                        >
                            <ExternalLink size={14} /> VER COBRANÇA ORIGINAL
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
