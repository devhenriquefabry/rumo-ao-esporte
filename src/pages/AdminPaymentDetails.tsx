import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
    ArrowLeft, FileText, Calendar, CreditCard, Barcode, QrCode, Trash2, ExternalLink, Copy, Check, Share2, Edit2, RefreshCw
} from 'lucide-react';
import { useDialog } from '../context/CustomDialogContext';
import '../App.css';

interface PaymentDetails {
    id: string;
    status: string;
    value: number;
    description: string;
    dueDate: string;
    originalDueDate?: string;
    paymentDate?: string;
    invoiceUrl?: string;
    billingType?: string;
    transactionReceiptUrl?: string;
    customer?: string;
    identificationField?: string;
    pixQrCode?: string;
    pixQrCodeUrl?: string;
}

export default function AdminPaymentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useDialog();
    const [loading, setLoading] = useState(true);
    const [payment, setPayment] = useState<PaymentDetails | null>(null);

    // Edit States
    const [isEditingDate, setIsEditingDate] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [newDesc, setNewDesc] = useState('');

    const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
    const [showPixQr, setShowPixQr] = useState(false);
    const [isPixOpen, setIsPixOpen] = useState(false);
    const [loadingPix, setLoadingPix] = useState(false);
    const [generatedQrUrl, setGeneratedQrUrl] = useState('');

    const workerUrl = import.meta.env.VITE_WORKER_URL;

    useEffect(() => {
        if (!id) return;
        fetchPayment();
    }, [id, workerUrl, navigate, showAlert]);

    const fetchPayment = async () => {
        try {
            const response = await fetch(`${workerUrl}/payments/${id}`);
            const data = await response.json();
            if (data.success && data.payment) {
                setPayment(data.payment);
                setNewDate(data.payment.dueDate ? data.payment.dueDate.split('T')[0] : '');
                setNewDesc(data.payment.description || '');
            } else {
                showAlert('Fatura não encontrada.', 'error');
                navigate(-1);
            }
        } catch (error) {
            console.error('Falha ao buscar detalhes:', error);
            showAlert('Erro ao carregar detalhes da fatura.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateDueDate = async () => {
        if (!payment || !newDate) return;
        try {
            setLoading(true);
            const response = await fetch(`${workerUrl}/payments/${payment.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dueDate: newDate })
            });
            const data = await response.json();
            if (data.success) {
                setPayment({ ...payment, dueDate: newDate });
                setIsEditingDate(false);
                showAlert('Vencimento atualizado com sucesso!', 'success');
            } else {
                showAlert('Erro ao atualizar vencimento: ' + (data.error || 'Erro desconhecido'), 'error');
            }
        } catch (error) {
            console.error('Error updating date:', error);
            showAlert('Erro de conexão.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateDescription = async () => {
        if (!payment || !newDesc) return;
        try {
            setLoading(true);
            const response = await fetch(`${workerUrl}/payments/${payment.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: newDesc })
            });
            const data = await response.json();
            if (data.success) {
                setPayment({ ...payment, description: newDesc });
                setIsEditingDesc(false);
                showAlert('Descrição atualizada com sucesso!', 'success');
            } else {
                showAlert('Erro ao atualizar descrição: ' + (data.error || 'Erro desconhecido'), 'error');
            }
        } catch (error) {
            console.error('Error updating description:', error);
            showAlert('Erro de conexão.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelPayment = async () => {
        if (!payment) return;
        showConfirm('Tem certeza que deseja CANCELAR esta fatura? Esta ação é irreversível.', async () => {
            try {
                setLoading(true);
                const response = await fetch(`${workerUrl}/payments/${payment.id}`, {
                    method: 'DELETE'
                });
                const data = await response.json();
                if (data.success) {
                    showAlert('Fatura cancelada com sucesso.', 'success');
                    navigate(-1);
                } else {
                    showAlert('Erro ao cancelar fatura: ' + (data.error || 'Erro desconhecido'), 'error');
                }
            } catch (error) {
                console.error('Error canceling:', error);
                showAlert('Erro de conexão.', 'error');
            } finally {
                setLoading(false);
            }
        });
    };

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedMap({ ...copiedMap, [key]: true });
        setTimeout(() => setCopiedMap({ ...copiedMap, [key]: false }), 2000);
    };

    const handleWhatsAppShare = () => {
        if (!payment) return;
        const message = `Olá! Segue o link para pagamento da fatura Rumo ao Esporte: ${payment.invoiceUrl}\n\nQualquer dúvida, estamos à disposição! ⚽🏀`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleGeneratePix = async () => {
        if (!payment) return;
        setLoadingPix(true);
        try {
            await fetchPayment();
            if (!payment.pixQrCode) {
                showAlert('O código Pix ainda não está disponível no Asaas. Tente novamente em instantes.', 'info');
            }
            // Generate locally for basic cases if needed (optional fallback logic already handled in render via 'generatedQrUrl' which we aren't setting yet, but could)
            if (payment.pixQrCode && !payment.pixQrCodeUrl) {
                // If we have code but no URL, generate URL locally
                try {
                    const url = await QRCode.toDataURL(payment.pixQrCode);
                    setGeneratedQrUrl(url);
                } catch (err) {
                    console.error("QR Gen Error", err);
                }
            }
        } catch (e) {
            console.error(e);
            showAlert('Erro ao atualizar dados Pix.', 'error');
        } finally {
            setLoadingPix(false);
        }
    };

    const getStatusLabel = (s: string) => {
        const normalized = s?.toLowerCase() || 'pendente';
        if (['pago', 'received', 'confirmed', 'received_in_cash', 'done'].includes(normalized)) return 'PAGO';
        if (['atrasado', 'overdue'].includes(normalized)) return 'ATRASADO';
        if (['dunning_received'].includes(normalized)) return 'COBRANÇA';
        if (['refunded'].includes(normalized)) return 'ESTORNADO';
        return 'PENDENTE';
    };

    const getStatusColor = (s: string) => {
        const normalized = s?.toLowerCase() || 'pendente';
        if (['pago', 'received', 'confirmed'].includes(normalized)) return '#2e7d32';
        if (['atrasado', 'overdue'].includes(normalized)) return '#c62828';
        return '#f57c00';
    };

    if (loading && !payment) return <div className="loading-container">Carregando detalhes...</div>;
    if (!payment) return <div className="error-container">Nada encontrado.</div>;

    const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'].includes(payment.status);

    return (
        <div className="page-enter" style={{
            background: '#f5f7fa', minHeight: '100vh', padding: '20px', fontFamily: 'Inter, sans-serif',
            display: 'flex', justifyContent: 'center', paddingBottom: '100px'
        }}>
            <div style={{ width: '100%', maxWidth: '480px' }}>

                {/* Header / Nav - Minimal */}
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                    <div style={{ textTransform: 'uppercase', fontSize: '0.8rem', color: '#888', fontWeight: 600, letterSpacing: '1px' }}>
                        Detalhes da Fatura
                    </div>
                </div>

                {/* Main Card */}
                <div style={{
                    background: '#fff', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                    padding: '30px 25px', marginBottom: '20px'
                }}>

                    {/* Header Info */}
                    <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Valor Total</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#111', marginBottom: '10px' }}>
                            {payment.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div style={{
                            display: 'inline-block', padding: '6px 16px', borderRadius: '20px',
                            fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase',
                            background: getStatusColor(payment.status) + '15',
                            color: getStatusColor(payment.status)
                        }}>
                            {getStatusLabel(payment.status)}
                        </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '20px 0' }} />

                    {/* Details List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Description with Edit */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <span style={{ color: '#888', fontSize: '0.9rem' }}>Descrição</span>
                            {isEditingDesc ? (
                                <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                                    <input
                                        type="text"
                                        value={newDesc}
                                        onChange={(e) => setNewDesc(e.target.value)}
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem' }}
                                    />
                                    <button onClick={handleUpdateDescription} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 15px', fontWeight: 'bold' }}>OK</button>
                                    <button onClick={() => setIsEditingDesc(false)} style={{ background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '8px', padding: '0 15px', fontWeight: 'bold' }}>X</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600, color: '#333', fontSize: '1.1rem' }}>
                                        {payment.description || 'Mensalidade'}
                                    </span>
                                    {!isPaid && (
                                        <button
                                            onClick={() => setIsEditingDesc(true)}
                                            style={{
                                                background: '#f0f0f0', border: 'none', cursor: 'pointer', color: '#333',
                                                padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold',
                                                display: 'flex', alignItems: 'center', gap: '6px'
                                            }}
                                        >
                                            <Edit2 size={14} /> EDITAR
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Due Date with Edit */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px' }}>
                            <span style={{ color: '#888', fontSize: '0.9rem' }}>Vencimento</span>
                            {isEditingDate ? (
                                <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                                    <input
                                        type="date"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem' }}
                                    />
                                    <button onClick={handleUpdateDueDate} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 15px', fontWeight: 'bold' }}>OK</button>
                                    <button onClick={() => setIsEditingDate(false)} style={{ background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '8px', padding: '0 15px', fontWeight: 'bold' }}>X</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600, color: '#333', fontSize: '1.1rem' }}>
                                        {new Date(payment.dueDate).toLocaleDateString('pt-BR')}
                                    </span>
                                    {!isPaid && (
                                        <button
                                            onClick={() => setIsEditingDate(true)}
                                            style={{
                                                background: '#f0f0f0', border: 'none', cursor: 'pointer', color: '#333',
                                                padding: '6px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                                                display: 'flex', alignItems: 'center', gap: '6px'
                                            }}
                                        >
                                            <Calendar size={14} /> ALTERAR
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Billing Type Info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                            <span style={{ color: '#888' }}>Forma de Pagamento</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#333' }}>
                                {payment.billingType === 'BOLETO' && <Barcode size={16} />}
                                {payment.billingType === 'CREDIT_CARD' && <CreditCard size={16} />}
                                {payment.billingType === 'PIX' && <QrCode size={16} />}
                                {payment.billingType === 'BOLETO' ? 'Boleto/Pix' :
                                    payment.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' :
                                        payment.billingType === 'PIX' ? 'Pix' : payment.billingType}
                            </div>
                        </div>

                    </div> {/* End Details List */}

                    {/* PAYMENT ACTIONS (Codes) */}
                    {!isPaid && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '25px', marginBottom: '25px' }}>

                            {/* BOLETO BARCODE */}
                            {payment.identificationField && (
                                <div style={{
                                    background: '#fff', padding: '20px', borderRadius: '12px',
                                    border: '1px solid #eee', boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#333', fontWeight: 600 }}>
                                        <Barcode size={20} /> Código de Barras (Boleto)
                                    </div>
                                    <div style={{
                                        background: '#f9f9f9', padding: '12px', borderRadius: '8px',
                                        fontSize: '0.85rem', color: '#555', wordBreak: 'break-all', fontFamily: 'monospace',
                                        marginBottom: '10px', textAlign: 'center'
                                    }}>
                                        {payment.identificationField}
                                    </div>
                                    <button
                                        onClick={() => handleCopy(payment.identificationField!, 'barcode')}
                                        className="touch-feedback"
                                        style={{
                                            width: '100%', padding: '14px', background: copiedMap['barcode'] ? '#4caf50' : '#333',
                                            color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                                        }}
                                    >
                                        {copiedMap['barcode'] ? <Check size={18} /> : <Copy size={18} />}
                                        {copiedMap['barcode'] ? 'COPIADO!' : 'COPIAR CÓDIGO DE BARRAS'}
                                    </button>
                                </div>
                            )}

                            {/* PIX COPY & PASTE (DROPDOWN) */}
                            {(payment.pixQrCode || payment.billingType === 'BOLETO' || payment.billingType === 'PIX') && (
                                <div style={{
                                    background: '#fff', borderRadius: '12px',
                                    border: '2px dashed #4caf50', boxShadow: '0 2px 10px rgba(76, 175, 80, 0.1)',
                                    overflow: 'hidden'
                                }}>
                                    <button
                                        onClick={() => setIsPixOpen(!isPixOpen)}
                                        style={{
                                            width: '100%', padding: '20px', background: '#fff', border: 'none',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2e7d32', fontWeight: 700 }}>
                                            <QrCode size={20} /> PAGAMENTO VIA PIX
                                        </div>
                                        <div style={{ transform: isPixOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#2e7d32' }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                                        </div>
                                    </button>

                                    {isPixOpen && (
                                        <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid #f0f0f0' }}>
                                            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column', marginTop: '15px' }}>
                                                {payment.pixQrCode ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleCopy(payment.pixQrCode!, 'pix')}
                                                            style={{
                                                                width: '100%', padding: '14px', background: copiedMap['pix'] ? '#4caf50' : '#2e7d32',
                                                                color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                                            }}
                                                        >
                                                            {copiedMap['pix'] ? <Check size={18} /> : <Copy size={18} />}
                                                            {copiedMap['pix'] ? 'COPIADO!' : 'COPIAR CÓDIGO PIX'}
                                                        </button>

                                                        {/* GENERATE IMAGE BUTTON */}
                                                        <button
                                                            onClick={() => setShowPixQr(!showPixQr)}
                                                            style={{
                                                                width: '100%', padding: '14px', background: showPixQr ? '#f5f5f5' : '#333', color: showPixQr ? '#333' : '#fff',
                                                                border: showPixQr ? '1px solid #ddd' : 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                                            }}
                                                        >
                                                            <QrCode size={18} /> {showPixQr ? 'OCULTAR QR CODE' : 'VER/GERAR QR CODE (IMAGEM)'}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={handleGeneratePix}
                                                        disabled={loadingPix}
                                                        style={{
                                                            width: '100%', padding: '14px', background: '#2e7d32', color: '#fff',
                                                            border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                            opacity: loadingPix ? 0.7 : 1
                                                        }}
                                                    >
                                                        {loadingPix ? <RefreshCw size={18} className="spin" /> : <QrCode size={18} />}
                                                        {loadingPix ? 'BUSCANDO DADOS...' : 'GERAR CÓDIGO PIX'}
                                                    </button>
                                                )}
                                            </div>

                                            {showPixQr && (
                                                <div style={{ marginTop: '15px', textAlign: 'center', padding: '15px', background: '#fff', borderRadius: '8px', border: '1px dashed #ddd' }}>
                                                    <img
                                                        src={payment.pixQrCodeUrl ? `data:image/png;base64,${payment.pixQrCodeUrl}` : generatedQrUrl}
                                                        alt="Pix QR Code"
                                                        style={{ maxWidth: '100%', height: 'auto' }}
                                                    />
                                                    {!payment.pixQrCodeUrl && !generatedQrUrl && <div>Gerando QR Code...</div>}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    )}

                    {/* GENERAL ACTIONS SECTION */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '10px' }}> {/* Added simple padding */}

                        {/* Send via WhatsApp */}
                        {!isPaid && payment.invoiceUrl && (
                            <button
                                onClick={handleWhatsAppShare}
                                className="touch-feedback"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    background: '#25D366', color: '#fff', padding: '14px', borderRadius: '12px',
                                    border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
                                    boxShadow: '0 4px 10px rgba(37, 211, 102, 0.2)'
                                }}
                            >
                                <Share2 size={20} /> ENVIAR NO WHATSAPP
                            </button>
                        )}

                        {/* View Invoice */}
                        {payment.invoiceUrl && (
                            <a
                                href={payment.invoiceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="touch-feedback"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    background: isPaid ? '#fff' : '#111',
                                    color: isPaid ? '#111' : '#fff',
                                    border: isPaid ? '1px solid #111' : 'none',
                                    padding: '14px', borderRadius: '12px',
                                    textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem'
                                }}
                            >
                                <ExternalLink size={18} /> {isPaid ? 'ACESSAR FATURA (PAGA)' : 'ACESSAR LINK DA FATURA'}
                            </a>
                        )}

                        {/* View Receipt */}
                        {isPaid && payment.transactionReceiptUrl && (
                            <a
                                href={payment.transactionReceiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="touch-feedback"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    background: '#2e7d32', color: '#fff', padding: '14px', borderRadius: '12px',
                                    textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem'
                                }}
                            >
                                <FileText size={18} /> VER COMPROVANTE
                            </a>
                        )}

                        {/* Cancel Action */}
                        {!isPaid && (
                            <button
                                onClick={handleCancelPayment}
                                className="touch-feedback"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    background: '#fff', color: '#c62828', padding: '14px', borderRadius: '12px',
                                    border: '1px solid #ffcdd2', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                                    marginTop: '10px'
                                }}
                            >
                                <Trash2 size={18} /> CANCELAR FATURA
                            </button>
                        )}

                    </div>

                </div> {/* End Main Card */}

                {/* FIXED BOTTOM BAR */}
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0,
                    background: '#fff', padding: '15px',
                    boxShadow: '0 -5px 20px rgba(0,0,0,0.05)',
                    display: 'flex', justifyContent: 'center', zIndex: 100
                }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            width: '100%', maxWidth: '480px',
                            background: '#333', color: '#fff',
                            padding: '16px', borderRadius: '12px',
                            border: 'none', fontSize: '1rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            cursor: 'pointer'
                        }}
                    >
                        <ArrowLeft size={20} /> VOLTAR
                    </button>
                </div>

            </div>
        </div>
    );
}
