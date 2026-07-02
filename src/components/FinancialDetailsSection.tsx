import { useState } from 'react';
import { CreditCard, FileText, CheckCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';

interface FinancialSectionProps {
    data: any;
    setData: (data: any) => void;
    isEditing?: boolean;
}

// Externalized to prevent focus loss
const EditField = ({ label, value, onChange }: any) => (
    <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '2px' }}>{label}</label>
        <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '0.9rem',
                background: '#fcfcfc'
            }}
        />
    </div>
);

export default function FinancialDetailsSection({ data, setData, isEditing = false }: FinancialSectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    void isEditing; // Used for edit mode (to be implemented)

    return (
        <div className="detail-card" style={{
            background: '#fff',
            padding: '12px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            borderLeft: '4px solid #007d2f',
            width: '100%'
        }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid #eee', cursor: 'pointer', userSelect: 'none' }}
            >
                {isOpen ? <ChevronDown size={18} color="#007d2f" /> : <ChevronRight size={18} color="#007d2f" />}
                {data.modalidade === 'futebol' ? <FileText size={18} color="#007d2f" /> : <CreditCard size={18} color="#007d2f" />}
                <h3 style={{ margin: 0, color: '#333', fontSize: '1rem', flex: 1 }}>
                    {data.modalidade === 'futebol' ? "Autorizações Legais" : "Dados Financeiros"}
                </h3>
            </div>

            {isOpen && (
                <>
                    {data.modalidade !== 'futebol' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px', marginTop: '10px' }}>

                            {/* Status Badge */}
                            <div style={{
                                background: data.status === 'pago' ? '#e8f5e9' : '#fff3e0',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid',
                                borderColor: data.status === 'pago' ? '#c8e6c9' : '#ffe0b2',
                                display: 'flex', flexDirection: 'column', justifyContent: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#666', marginBottom: '5px' }}>
                                    STATUS
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 'bold', color: data.status === 'pago' ? '#2e7d32' : '#e65100' }}>
                                    {data.status === 'pago' ? <CheckCircle size={20} /> : <Clock size={20} />}
                                    {data.status === 'pago' ? 'CONFIRMADO' : 'AGUARDANDO'}
                                </div>
                                {data.paymentConfirmedAt && (
                                    <div style={{ fontSize: '0.8rem', marginTop: '5px', color: '#666' }}>
                                        {new Date(data.paymentConfirmedAt.seconds ? data.paymentConfirmedAt.seconds * 1000 : data.paymentConfirmedAt).toLocaleDateString()}
                                    </div>
                                )}
                            </div>

                            {/* Payment Details */}
                            <div>
                                <EditField label="Método de Pagamento" value={data.billingType || data.paymentMethod} onChange={(v: string) => setData({ ...data, billingType: v })} />

                                <div style={{ marginTop: '10px' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '2px' }}>Valor (R$)</label>
                                    <div style={{
                                        padding: '8px 12px',
                                        background: '#f5f5f5',
                                        borderRadius: '6px',
                                        border: '1px solid #ddd',
                                        fontWeight: 'bold',
                                        color: '#333'
                                    }}>
                                        {data.amount ? (data.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                    </div>
                                </div>
                            </div>

                            {/* Invoice Link */}
                            {data.invoiceUrl && (
                                <div style={{ display: 'flex', alignItems: 'end' }}>
                                    <a href={data.invoiceUrl} target="_blank" rel="noreferrer" style={{
                                        display: 'block', width: '100%', textAlign: 'center', padding: '12px', background: '#e3f2fd',
                                        color: '#1565c0', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', border: '1px solid #bbdefb'
                                    }}>
                                        Visualizar Fatura
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* LEGAL AUTHORIZATIONS */}
                    <div style={{
                        marginTop: data.modalidade === 'futebol' ? '10px' : '20px',
                        paddingTop: data.modalidade === 'futebol' ? '0' : '20px',
                        borderTop: data.modalidade === 'futebol' ? 'none' : '1px solid #f0f0f0'
                    }}>
                        {data.modalidade !== 'futebol' && (
                            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#007d2f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={16} /> Autorizações Legais
                            </h4>
                        )}

                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#555', background: '#f9f9f9', padding: '6px 12px', borderRadius: '20px', border: '1px solid #eee' }}>
                                <input type="checkbox" checked={data.autorizacoes?.participacao} disabled /> Participação
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#555', background: '#f9f9f9', padding: '6px 12px', borderRadius: '20px', border: '1px solid #eee' }}>
                                <input type="checkbox" checked={data.autorizacoes?.usoImagem} disabled /> Uso de Imagem
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#555', background: '#f9f9f9', padding: '6px 12px', borderRadius: '20px', border: '1px solid #eee' }}>
                                <input type="checkbox" checked={data.autorizacoes?.primeirosSocorros} disabled /> Primeiros Socorros
                            </label>
                        </div>

                        <div style={{ marginTop: '15px', fontSize: '0.75rem', color: '#999', display: 'flex', justifyContent: 'flex-end', fontStyle: 'italic' }}>
                            {data.confirmacao?.assinaturaDigital && (
                                data.confirmacao.assinaturaDigital.startsWith('data:image') ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        Assinado em {data.confirmacao?.dataAssinatura ? new Date(data.confirmacao.dataAssinatura).toLocaleString() : '-'}
                                        <img src={data.confirmacao.assinaturaDigital} alt="Assinatura" style={{ height: '36px', maxWidth: '140px', objectFit: 'contain', background: '#fff', border: '1px solid #eee' }} />
                                    </span>
                                ) : (
                                    <span>Assinado por <strong>{data.confirmacao.assinaturaDigital}</strong> em {data.confirmacao?.dataAssinatura ? new Date(data.confirmacao.dataAssinatura).toLocaleString() : '-'}</span>
                                )
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
