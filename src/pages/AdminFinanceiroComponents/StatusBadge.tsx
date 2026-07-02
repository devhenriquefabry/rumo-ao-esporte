

export const StatusBadge = ({ status }: { status: string }) => {
    const getStatusColor = (s: string) => {
        const normalized = s?.toLowerCase() || 'pendente';
        if (['pago', 'received', 'confirmed', 'received_in_cash', 'done'].includes(normalized)) return '#2e7d32'; // Green
        if (['atrasado', 'overdue', 'dunning_received', 'reproved_by_risk_analysis', 'credit_card_capture_refused'].includes(normalized)) return '#c62828'; // Red
        if (['refunded', 'partially_refunded', 'refund_in_progress'].includes(normalized)) return '#666'; // Gray/Refunded
        if (['chargeback_requested', 'chargeback_dispute'].includes(normalized)) return '#f57c00'; // Orange/Dispute
        if (['vazio'].includes(normalized)) return '#94a3b8'; // Neutral Gray
        if (['bolsista'].includes(normalized)) return '#8b5cf6'; // Purple for Bolsista
        return '#f57c00'; // Orange (Pending default)
    };

    const getStatusLabel = (s: string) => {
        const normalized = s?.toLowerCase() || 'pendente';
        if (['pago', 'received', 'confirmed', 'received_in_cash', 'done'].includes(normalized)) return 'PAGO';
        if (['atrasado', 'overdue'].includes(normalized)) return 'ATRASADO';
        if (['dunning_received'].includes(normalized)) return 'EM COBRANÇA';
        if (['refunded'].includes(normalized)) return 'ESTORNADO';
        if (['bolsista'].includes(normalized)) return 'BOLSISTA';
        if (['vazio'].includes(normalized)) return 'SEM COBRANÇA';
        return 'PENDENTE';
    };

    return (
        <span style={{
            padding: '4px 12px',
            borderRadius: '20px',
            background: getStatusColor(status) + '20',
            color: getStatusColor(status),
            fontWeight: 'bold',
            fontSize: '0.75rem',
            border: `1px solid ${getStatusColor(status)}`
        }}>
            {getStatusLabel(status)}
        </span>
    );
};
