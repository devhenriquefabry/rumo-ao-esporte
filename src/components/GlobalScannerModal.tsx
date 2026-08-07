import React, { useState } from 'react';
import { CheckCircle, XCircle, User, Calendar, Users, FileText, Phone, Mail, Heart, ChevronDown, ChevronUp, Tag, BookOpen } from 'lucide-react';
import { PaymentCard } from './PaymentCard';

interface ScanResult {
    status: 'allowed' | 'denied' | 'error';
    title: string;
    subtitle: string;
    student?: any;
    parent?: any;
    photo?: string;
    planName?: string;
    turmaName?: string;
}

interface GlobalScannerModalProps {
    modalData: ScanResult | null;
    loading: boolean;
    onClose: () => void;
}

export const GlobalScannerModal: React.FC<GlobalScannerModalProps> = ({ modalData, loading, onClose }) => {
    const [showFuture, setShowFuture] = useState(false);
    const [showPaid, setShowPaid] = useState(false);

    if (loading) {
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '20px'
            }}>
                <div className="spinner" style={{
                    width: '60px', height: '60px',
                    border: '4px solid rgba(255,255,255,0.2)',
                    borderTop: '4px solid #fff',
                    borderRadius: '50%', animation: 'spin 1s linear infinite'
                }} />
                <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: '600' }}>
                    Buscando aluno...
                </span>
            </div>
        );
    }

    if (!modalData) return null;

    // Parse payments from parent data
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const payments = modalData.parent?.payments || [];

    const pending = payments
        .filter((p: any) => !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE', 'DELETED', 'REFUNDED', 'REMOVED_BY_RECEIVER'].includes(p.status))
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const paid = payments
        .filter((p: any) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'].includes(p.status))
        .sort((a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

    // Fatura Atual only if it's already overdue (dueDate < today)
    // Actually, usually current is the most recent pending. 
    // But user asked: "se a fatura com vencimento mais recente ainda não estiver vencida então ela nn deve ser marcada como pendente e sim como futura"
    const currentPayment = pending.length > 0 && new Date(pending[0].dueDate + 'T00:00:00') < now ? pending[0] : null;
    const futurePayments = currentPayment ? pending.slice(1) : pending;

    const renderPayment = (p: any, isCurrent: boolean) => (
        <div key={p.id} style={{ minWidth: '280px', maxWidth: '350px', margin: '0 auto', width: '100%' }}>
            <PaymentCard
                payment={{
                    id: p.id,
                    description: p.description || 'Mensalidade',
                    value: p.value || 0,
                    dueDate: p.dueDate || '',
                    status: p.status || 'PENDING',
                    billingType: p.billingType,
                    invoiceUrl: p.invoiceUrl
                }}
                isCurrentPayment={isCurrent}
                showPaymentMethods={!['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status)}
            />
        </div>
    );

    return (
        <div className="animate-scale-in" style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#0f172a',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Status Banner */}
            <div style={{
                background: modalData.status === 'allowed' ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                padding: '16px 30px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {modalData.status === 'allowed' ? (
                        <CheckCircle size={40} color="#fff" strokeWidth={2.5} />
                    ) : (
                        <XCircle size={40} color="#fff" strokeWidth={2.5} />
                    )}
                    <div>
                        <h1 style={{ margin: 0, color: '#fff', fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
                            {modalData.title}
                        </h1>
                        <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem' }}>
                            {modalData.subtitle}
                        </p>
                    </div>
                </div>
                <div style={{
                    background: 'rgba(0,0,0,0.2)', padding: '8px 16px', borderRadius: '8px',
                    color: '#fff', fontWeight: '600', fontSize: '0.85rem'
                }}>
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} • {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', gap: '20px', padding: '20px', overflow: 'hidden' }}>
                {/* Left Panel - Student Info */}
                {modalData.student && (
                    <div style={{
                        width: '340px', flexShrink: 0,
                        background: '#1e293b', borderRadius: '16px',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                        {/* Photo Section */}
                        <div style={{
                            background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                            padding: '24px', textAlign: 'center',
                            borderBottom: '1px solid #334155'
                        }}>
                            <div style={{
                                width: '120px', height: '120px', borderRadius: '50%',
                                border: '3px solid #475569',
                                overflow: 'hidden', background: '#334155',
                                margin: '0 auto 16px', boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                            }}>
                                {modalData.photo ? (
                                    <img src={modalData.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                        <User size={60} color="#64748b" />
                                    </div>
                                )}
                            </div>
                            <h2 style={{ margin: '0 0 8px', color: '#fff', fontSize: '1.3rem', fontWeight: '700' }}>
                                {modalData.student?.nome || 'Aluno'}
                            </h2>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                background: modalData.status === 'allowed' ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)',
                                border: `1px solid ${modalData.status === 'allowed' ? '#16a34a' : '#dc2626'}`,
                                padding: '6px 16px', borderRadius: '20px',
                                color: modalData.status === 'allowed' ? '#4ade80' : '#f87171',
                                fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase'
                            }}>
                                {modalData.student?.modalidade || 'Modalidade'}
                            </div>
                        </div>

                        {/* Student Details */}
                        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {/* Plan */}
                                {modalData.planName !== 'BOLSISTA INTEGRAL' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '10px',
                                            background: '#00a63a', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <Tag size={18} color="#fff" />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                                                Plano
                                            </div>
                                            <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '700', marginTop: '1px' }}>
                                                {modalData.planName || 'Sem plano'}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Turma */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <BookOpen size={18} color="#94a3b8" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                                            Turma
                                        </div>
                                        <div style={{ fontSize: '0.95rem', color: '#e2e8f0', fontWeight: '600', marginTop: '1px' }}>
                                            {modalData.turmaName || 'Não alocado'}
                                        </div>
                                    </div>
                                </div>

                                {/* Birth Date */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Calendar size={18} color="#94a3b8" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                                            Nascimento
                                        </div>
                                        <div style={{ fontSize: '0.95rem', color: '#e2e8f0', fontWeight: '600', marginTop: '1px' }}>
                                            {modalData.student?.dataNascimento || '-'}
                                        </div>
                                    </div>
                                </div>

                                {/* Contract Status */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <FileText size={18} color="#94a3b8" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                                            Contrato
                                        </div>
                                        <div style={{
                                            fontSize: '0.8rem', fontWeight: '700', marginTop: '3px',
                                            padding: '3px 10px', borderRadius: '6px', display: 'inline-block',
                                            textTransform: 'uppercase',
                                            background: modalData.parent?.contractStatus === 'aprovado' ? 'rgba(22, 163, 74, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                                            color: modalData.parent?.contractStatus === 'aprovado' ? '#4ade80' : '#fbbf24'
                                        }}>
                                            {modalData.parent?.contractStatus || '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ height: '1px', background: '#334155', margin: '18px 0' }} />

                            {/* Responsible Section */}
                            <div>
                                <div style={{
                                    fontSize: '0.7rem', color: '#64748b', fontWeight: '700',
                                    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}>
                                    <Users size={12} /> Responsável
                                </div>
                                <div style={{ background: '#334155', borderRadius: '12px', padding: '14px' }}>
                                    <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.95rem', marginBottom: '10px' }}>
                                        {modalData.parent?.responsavel?.nome || '-'}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            <Phone size={14} /> {modalData.parent?.responsavel?.telefonePrincipal || '-'}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            <Mail size={14} /> {modalData.parent?.responsavel?.email || '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Medical Observations */}
                            {modalData.student?.observacoesMedicas && (
                                <div style={{
                                    marginTop: '16px', background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '12px', padding: '14px'
                                }}>
                                    <div style={{
                                        fontSize: '0.7rem', color: '#f87171', fontWeight: '700',
                                        textTransform: 'uppercase', marginBottom: '6px',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}>
                                        <Heart size={12} /> Obs. Médicas
                                    </div>
                                    <div style={{ color: '#fca5a5', fontSize: '0.85rem', lineHeight: '1.4' }}>
                                        {modalData.student.observacoesMedicas}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Right Panel - Financial History */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Section Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: '16px'
                    }}>
                        <h3 style={{
                            fontSize: '0.85rem', color: '#00a63a', fontWeight: '900', margin: 0,
                            textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>
                            Histórico Financeiro
                        </h3>
                        <span style={{
                            background: '#334155', padding: '4px 12px', borderRadius: '20px',
                            color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600'
                        }}>
                            {payments.length} faturas
                        </span>
                    </div>

                    {/* Payment History Container */}
                    <div style={{
                        flex: 1, background: '#fff', borderRadius: '16px',
                        overflow: 'hidden', display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {payments.length === 0 ? (
                                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                                    <FileText size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
                                    <div style={{ color: '#64748b', fontWeight: '600', fontSize: '1rem' }}>
                                        Sem histórico financeiro
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                    {/* Current Payment */}
                                    {currentPayment && (
                                        <div>
                                            <div style={{
                                                padding: '10px 16px', fontSize: '0.75rem', color: '#00a63a',
                                                textTransform: 'uppercase', fontWeight: 'bold',
                                                background: '#fff0f0', borderBottom: '1px solid #fee2e2'
                                            }}>
                                                Fatura Atual
                                            </div>
                                            {renderPayment(currentPayment, true)}
                                        </div>
                                    )}

                                    {/* Future Payments - Collapsible */}
                                    {futurePayments.length > 0 && (
                                        <div>
                                            <div
                                                onClick={() => setShowFuture(!showFuture)}
                                                style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '10px 16px', fontSize: '0.75rem', color: '#666',
                                                    fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer',
                                                    background: '#f9f9f9', borderBottom: '1px solid #eee'
                                                }}
                                            >
                                                <span>Próximas Faturas ({futurePayments.length})</span>
                                                {showFuture ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                            {showFuture && (
                                                <div>
                                                    {futurePayments.map((p: any) => renderPayment(p, false))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Paid Payments - Collapsible */}
                                    {paid.length > 0 && (
                                        <div>
                                            <div
                                                onClick={() => setShowPaid(!showPaid)}
                                                style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '10px 16px', fontSize: '0.75rem', color: '#2e7d32',
                                                    fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer',
                                                    background: '#f0fff4', borderBottom: '1px solid #c6f6d5'
                                                }}
                                            >
                                                <span>Faturas Pagas ({paid.length})</span>
                                                {showPaid ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                            {showPaid && (
                                                <div>
                                                    {paid.map((p: any) => renderPayment(p, false))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                padding: '24px 30px',
                background: '#1e293b', borderTop: '1px solid #334155',
                display: 'flex', justifyContent: 'center', gap: '20px'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        flex: 1, maxWidth: '400px',
                        padding: '18px 0', borderRadius: '16px',
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: '#fff', border: 'none',
                        fontWeight: '800', fontSize: '1.2rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                        boxShadow: '0 8px 25px rgba(22, 163, 74, 0.4)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 12px 30px rgba(22, 163, 74, 0.5)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(22, 163, 74, 0.4)';
                    }}
                >
                    <CheckCircle size={28} /> LIBERAR ACESSO
                </button>

                <button
                    onClick={onClose}
                    style={{
                        flex: 1, maxWidth: '400px',
                        padding: '18px 0', borderRadius: '16px',
                        background: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
                        color: '#fff', border: 'none',
                        fontWeight: '800', fontSize: '1.2rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                        boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    <XCircle size={28} /> CANCELAR
                </button>
            </div>
        </div>
    );
};

export default GlobalScannerModal;
