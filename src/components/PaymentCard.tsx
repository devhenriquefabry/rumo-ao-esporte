import { ExternalLink, Send, Trash2, Calendar, Barcode, CreditCard, Pencil, Wallet } from 'lucide-react';

interface PaymentCardProps {
    payment: {
        id: string;
        description?: string;
        value: number;
        dueDate: string;
        status: string;
        billingType?: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
        discount?: {
            value: number;
            type?: 'FIXED' | 'PERCENTAGE';
        };
        invoiceUrl?: string;
        pixQrCode?: string;
        pixQrCodeUrl?: string;
        externalReference?: string;
    };
    isCurrentPayment?: boolean;
    isAdmin?: boolean;
    responsibleName?: string;
    responsiblePhone?: string;
    showPaymentMethods?: boolean;
    onDelete?: (id: string) => void;
    onUpdateDueDate?: (id: string, currentDueDate: string) => void;
    onRestoreDiscount?: (id: string) => void;
    onEdit?: (payment: any) => void;
    onReceiveInCash?: () => void;
    statusLabelOverride?: string;
    hidePayButton?: boolean;
}

export function PaymentCard({
    payment,
    isCurrentPayment = false,
    isAdmin = false,
    responsibleName = '',
    responsiblePhone = '',
    showPaymentMethods = false,
    onDelete,
    onUpdateDueDate,
    onRestoreDiscount,
    onEdit,
    onReceiveInCash,
    statusLabelOverride,
    hidePayButton = false
}: PaymentCardProps) {
    const p = payment;
    const isPending = !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status);
    const hasDiscount = (p.discount?.value ?? 0) > 0;
    const isManual = p.externalReference?.includes('MANUAL_');
    const dueDate = new Date(p.dueDate + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const notDueYet = dueDate >= today;
    const dueDateFormatted = dueDate.toLocaleDateString('pt-BR');
    const shortDueDate = `${dueDate.getDate().toString().padStart(2, '0')}/${(dueDate.getMonth() + 1).toString().padStart(2, '0')}`;

    // Calculate days until due
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const getStatusColor = (s: string) => {
        const n = s?.toLowerCase() || 'pendente';
        if (['received', 'confirmed', 'received_in_cash'].includes(n)) return '#2e7d32';
        if (['overdue'].includes(n)) return '#c62828';
        return '#f57c00';
    };

    const getStatusLabel = (s: string) => {
        if (statusLabelOverride) return statusLabelOverride.toUpperCase();
        const n = s?.toLowerCase() || 'pendente';
        if (['received', 'confirmed', 'received_in_cash'].includes(n)) return 'PAGO';
        if (['overdue'].includes(n)) return 'ATRASADO';
        return 'PENDENTE';
    };

    // Build WhatsApp reminder message for admin
    const buildReminderMessage = () => {
        const firstName = responsibleName?.split(' ')[0] || 'Responsável';
        const valueFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value);

        const isPercentage = p.discount?.type === 'PERCENTAGE';
        const discountFixedValue = isPercentage
            ? (p.value * (p.discount?.value ?? 0)) / 100
            : (p.discount?.value ?? 0);

        const discountedValue = hasDiscount
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value - discountFixedValue)
            : '';
        const discountAmountLabel = hasDiscount
            ? (isPercentage ? `${p.discount?.value}%` : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.discount?.value ?? 0))
            : '';
        const discountTotalLabel = hasDiscount
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountFixedValue)
            : '';

        let msg = `Olá, ${firstName}!\n\n`;
        msg += `*${p.description || 'Mensalidade Rumo ao Esporte'}*\n\n`;

        if (notDueYet) {
            if (diffDays === 0) {
                msg += `Sua fatura vence *HOJE* (${dueDateFormatted})!\n\n`;
            } else if (diffDays === 1) {
                msg += `Sua fatura vence *AMANHÃ* (${dueDateFormatted})!\n\n`;
            } else {
                msg += `Faltam *${diffDays} dias* para o vencimento (${dueDateFormatted})\n\n`;
            }

            if (hasDiscount) {
                msg += `*DESCONTO ESPECIAL!*\n`;
                msg += `De: ~${valueFormatted}~\n`;
                msg += `Por apenas: *${discountedValue}*\n`;
                msg += `Desconto aplicado: *${discountAmountLabel}* (economize ${discountTotalLabel})\n\n`;
                msg += `_Desconto válido até ${dueDateFormatted}_\n\n`;
            } else {
                msg += `Valor: *${valueFormatted}*\n\n`;
            }
        } else {
            msg += `Fatura *VENCIDA* em ${dueDateFormatted}\n`;
            msg += `Valor: *${valueFormatted}*\n\n`;
        }

        msg += `*Formas de pagamento:*\n`;
        if (p.billingType === 'PIX') {
            msg += `• PIX (pagamento instantâneo)\n\n`;
        } else if (p.billingType === 'BOLETO') {
            msg += `• Boleto ou PIX\n\n`;
        } else {
            msg += `• PIX\n• Boleto\n• Cartão de Crédito\n\n`;
        }

        if (p.invoiceUrl) {
            msg += `Acesse sua fatura:\n${p.invoiceUrl}\n\n`;
        }

        msg += `Qualquer dúvida, estamos à disposição!\n\nEquipe Rumo ao Esporte\nContato: +55 33 8414-4053`;

        return encodeURIComponent(msg);
    };

    const phone = responsiblePhone?.replace(/\D/g, '') || '';
    const whatsappUrl = `https://wa.me/55${phone}?text=${buildReminderMessage()}`;

    return (
        <div
            style={{
                height: '100%',
                boxSizing: 'border-box',
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '16px 20px',
                borderBottom: '1px solid #f0f0f0',
                borderRadius: '12px',
                margin: '2px',
                background: statusLabelOverride?.toUpperCase() === 'EM DIA'
                    ? '#f0fdf4'
                    : (isCurrentPayment ? 'linear-gradient(135deg, #eef8ff 0%, #ffffff 100%)' : '#fff'),
                borderLeft: statusLabelOverride?.toUpperCase() === 'EM DIA'
                    ? '4px solid #2e7d32'
                    : (isCurrentPayment ? '4px solid #00a63a' : 'none'),
                paddingLeft: (isCurrentPayment || statusLabelOverride) ? '17px' : '20px',
                ...(statusLabelOverride?.toUpperCase() === 'EM DIA' ? {
                    boxShadow: 'inset 0 0 10px rgba(46, 125, 50, 0.05)'
                } : (isCurrentPayment ? {
                    boxShadow: 'inset 0 0 10px rgba(0, 125, 47, 0.05)'
                } : {}))
            }}
        >
            {/* Linha 1: Descrição + Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flex: 1 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{
                            fontWeight: '600',
                            color: '#333',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px'
                        }}>
                            {p.description || 'Mensalidade'}
                        </div>
                        {isAdmin && isManual && (
                            <span style={{
                                fontSize: '0.65rem',
                                background: '#eee',
                                color: '#666',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: '800',
                                border: '1px solid #ddd'
                            }}>
                                MANUAL
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                        Vencimento: {dueDateFormatted}
                    </div>
                </div>
                <div style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    background: getStatusColor(p.status) + '15',
                    color: getStatusColor(p.status),
                    fontWeight: '600',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                }}>
                    {getStatusLabel(p.status)}
                </div>
            </div>

            {/* Linha 2: Valores + Botão */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                {/* Bloco de Valores */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {hasDiscount && isPending && notDueYet ? (() => {
                        const isPercentage = p.discount?.type === 'PERCENTAGE';
                        const discountFixedValue = isPercentage
                            ? (p.value * (p.discount?.value ?? 0)) / 100
                            : (p.discount?.value ?? 0);

                        return (
                            <>
                                <div style={{
                                    fontSize: '0.85rem',
                                    color: '#aaa',
                                    textDecoration: 'line-through'
                                }}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value)}
                                </div>
                                <div>
                                    <div style={{
                                        fontWeight: '700',
                                        color: '#2e7d32',
                                        fontSize: '1.1rem'
                                    }}>
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value - discountFixedValue)}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#2e7d32', fontWeight: '500' }}>
                                        {isPercentage ? `${p.discount?.value}% de desconto ` : 'com desconto '}
                                        até {shortDueDate}
                                    </div>
                                </div>
                            </>
                        );
                    })() : (
                        <div style={{ fontWeight: '700', color: '#333', fontSize: '1.1rem' }}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value)}
                        </div>
                    )}
                </div>

                {/* Botão - Admin: Lembrete WhatsApp / Responsável: Pagar */}
                {isPending ? (
                    isAdmin ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {/* ... (admin buttons unchanged) */}
                            {onRestoreDiscount && p.status === 'OVERDUE' && (
                                <button
                                    onClick={() => onRestoreDiscount(p.id)}
                                    title="Restaurar Preço com Desconto (Renovar Vencimento)"
                                    style={{
                                        background: '#e3f2fd',
                                        color: '#1565c0',
                                        border: '1px solid #90caf9',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.7rem',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Trash2 size={14} style={{ transform: 'rotate(180deg)' }} /> RESTAURAR DESCONTO
                                </button>
                            )}
                            {onUpdateDueDate && (
                                <button
                                    onClick={() => onUpdateDueDate(p.id, p.dueDate)}
                                    title="Alterar Vencimento"
                                    style={{
                                        background: '#fff',
                                        color: '#666',
                                        border: '1px solid #ddd',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Calendar size={16} />
                                </button>
                            )}
                            {onEdit && (
                                <button
                                    onClick={() => onEdit(p)}
                                    title="Editar Cobrança Completa"
                                    style={{
                                        background: '#fff',
                                        color: '#3b82f6',
                                        border: '1px solid #dbeafe',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Pencil size={16} />
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    onClick={() => onDelete(p.id)}
                                    title="Excluir Cobrança"
                                    style={{
                                        background: '#fff',
                                        color: '#00a63a',
                                        border: '1px solid #fee2e2',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                            {phone && (
                                <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        background: '#25D366',
                                        color: '#fff',
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        textDecoration: 'none',
                                        fontWeight: '600',
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)'
                                    }}
                                >
                                    <Send size={14} /> LEMBRETE
                                </a>
                            )}
                            {p.invoiceUrl && (
                                <a
                                    href={p.invoiceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        background: '#fff',
                                        color: '#17428f',
                                        border: '1px solid #17428f',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        textDecoration: 'none',
                                        fontWeight: 'bold',
                                        fontSize: '0.7rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <ExternalLink size={14} /> VER FATURA
                                </a>
                            )}
                            {onReceiveInCash && (
                                <button
                                    onClick={onReceiveInCash}
                                    title="Receber em Dinheiro"
                                    style={{
                                        background: '#f0fdf4',
                                        color: '#16a34a',
                                        border: '1px solid #bbf7d0',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Wallet size={16} />
                                </button>
                            )}
                        </div>
                    ) : (
                        !hidePayButton && p.invoiceUrl ? (
                            <a
                                href={p.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    background: isCurrentPayment ? (statusLabelOverride?.toUpperCase() === 'EM DIA' ? '#2e7d32' : '#00a63a') : '#666',
                                    color: '#fff',
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    textDecoration: 'none',
                                    fontWeight: '600',
                                    fontSize: '0.8rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isCurrentPayment ? (statusLabelOverride?.toUpperCase() === 'EM DIA' ? '0 2px 8px rgba(46, 125, 50, 0.3)' : '0 2px 8px rgba(0, 166, 58, 0.28)') : 'none'
                                }}
                            >
                                <ExternalLink size={14} /> {isCurrentPayment ? (statusLabelOverride?.toUpperCase() === 'EM DIA' ? 'VER FATURA' : 'PAGAR AGORA') : 'ADIANTAR'}
                            </a>
                        ) : null
                    )
                ) : (
                    // PAID PAYMENTS: Show Invoice Link if exists + Admin Controls
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {isAdmin && (
                            <>
                                {onEdit && (
                                    <button
                                        onClick={() => onEdit(p)}
                                        title="Corrigir Valor/Info da Fatura Paga"
                                        style={{
                                            background: '#fff',
                                            color: '#3b82f6',
                                            border: '1px solid #dbeafe',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Pencil size={16} />
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        onClick={() => onDelete(p.id)}
                                        title="Excluir Registro de Pagamento"
                                        style={{
                                            background: '#fff',
                                            color: '#00a63a',
                                            border: '1px solid #fee2e2',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </>
                        )}
                        {p.invoiceUrl && (
                            <a
                                href={p.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    background: '#fff',
                                    color: '#2e7d32',
                                    border: '1px solid #2e7d32',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    textDecoration: 'none',
                                    fontWeight: 'bold',
                                    fontSize: '0.7rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <ExternalLink size={14} /> VER COMPROVANTE
                            </a>
                        )}
                    </div>
                )}
            </div>

            {/* Formas de pagamento */}
            {showPaymentMethods && isPending && (
                <div style={{
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px dashed #e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                }}>
                    <span style={{ fontSize: '0.75rem', color: '#999' }}>
                        Pague com:
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* PIX */}
                        {(p.billingType === 'PIX' || p.billingType === 'BOLETO' || !p.billingType || p.billingType === 'UNDEFINED') && (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.7rem',
                                color: '#32BCAD',
                                fontWeight: '700',
                                background: '#f0fdfa',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid #32BCAD30'
                            }}>
                                <svg width="12" height="12" viewBox="0 0 512 512" fill="#32BCAD">
                                    <path d="M112.57 391.19c20.056 0 38.928-7.808 53.12-22l76.693-76.692c5.385-5.404 14.765-5.384 20.15 0l76.989 76.989c14.191 14.172 33.045 21.98 53.12 21.98h15.098l-97.138 97.139c-30.326 30.344-79.505 30.344-109.85 0l-97.415-97.416h9.232zm280.068-271.294c-20.056 0-38.929 7.809-53.12 22l-76.97 76.99c-5.551 5.53-14.6 5.568-20.15-.02l-76.711-76.693c-14.192-14.191-33.046-21.999-53.12-21.999h-9.234l97.416-97.416c30.344-30.344 79.523-30.344 109.867 0l97.138 97.138h-15.116z" />
                                    <path d="M22.758 200.753l58.024-58.024h31.787c13.84 0 27.384 5.605 37.172 15.394l76.694 76.693c7.178 7.179 16.596 10.768 26.033 10.768 9.417 0 18.854-3.59 26.014-10.75l76.989-76.99c9.787-9.787 23.331-15.393 37.171-15.393h37.654l58.3 58.302c30.343 30.344 30.343 79.523 0 109.867l-58.3 58.303H392.64c-13.84 0-27.384-5.605-37.171-15.394l-76.97-76.99c-13.914-13.894-38.172-13.894-52.066.02l-76.694 76.674c-9.788 9.788-23.332 15.413-37.172 15.413H80.782L22.758 310.62c-30.344-30.345-30.344-79.524 0-109.868z" />
                                </svg>
                                PIX
                            </span>
                        )}

                        {/* BOLETO */}
                        {(p.billingType === 'BOLETO' || !p.billingType || p.billingType === 'UNDEFINED') && (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.7rem',
                                color: '#444',
                                fontWeight: '700',
                                background: '#f8fafc',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1'
                            }}>
                                <Barcode size={14} strokeWidth={2.5} /> BOLETO
                            </span>
                        )}

                        {/* CARTÃO */}
                        {(p.billingType === 'CREDIT_CARD' || !p.billingType || p.billingType === 'UNDEFINED') && (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.7rem',
                                color: '#444',
                                fontWeight: '700',
                                background: '#f8fafc',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1'
                            }}>
                                <CreditCard size={14} strokeWidth={2.5} /> CARTÃO
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
