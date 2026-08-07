import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { fetchResponsavelRegistrations, getSessionStudentEmail } from '../utils/responsavelIdentity';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import { PaymentCard } from '../components/PaymentCard';
import { syncStudentFinancialData } from '../utils/financialSync';
import { SyncService } from '../utils/SyncService';

const workerUrl = import.meta.env.VITE_WORKER_URL;

export default function StudentPayments() {
    const [allRegistrations, setAllRegistrations] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [showFuture, setShowFuture] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            const normalizedEmail = getSessionStudentEmail(user?.email);
            if (normalizedEmail) {
                try {
                    // 1. Get the registrations of THIS responsible only (email + identidade)
                    const registrationDocs = await fetchResponsavelRegistrations(normalizedEmail);

                    if (registrationDocs.length > 0) {
                        const regs = registrationDocs.map(d => ({ id: d.id, ...d.data() } as any));
                        setAllRegistrations(regs);

                        // 2. Fetch payments (using CPF from first registration found)
                        // Passa "regs" diretamente em vez de usar o estado "allRegistrations":
                        // setAllRegistrations acima ainda não foi aplicado neste ponto (React
                        // atualiza o estado de forma assíncrona), entao fetchPayments rodaria
                        // com a lista vazia na primeira carga da pagina.
                        const firstWithCpf = regs.find(r => r.responsavel?.cpf);
                        if (firstWithCpf?.responsavel?.cpf) {
                            await fetchPayments(firstWithCpf.responsavel.cpf, regs);
                        }
                    }
                } catch (error) {
                    console.error("Error:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const fetchPayments = async (cpf: string, registrations: any[] = allRegistrations) => {
        setLoadingPayments(true);
        try {
            // SYNC all registrations with the payment provider (Deep Sync)
            // This ensures Firestore is updated with the latest status
            for (const reg of registrations) {
                try {
                    await syncStudentFinancialData(
                        reg.id,
                        cpf,
                        reg.alunos?.[0]?.nome || '',
                        reg.modalidade || '',
                        workerUrl
                    );
                } catch (e) {
                    console.error(`[SYNC ERROR] ${reg.id}:`, e);
                }
            }

            // Load payments from Firestore Cache (consolidated)
            const allPayments: any[] = [];
            const seenIds = new Set<string>();

            for (const reg of registrations) {
                const cached = await SyncService.getCachedPayments(reg.id);
                if (cached) {
                    cached.forEach(p => {
                        if (!seenIds.has(p.id)) {
                            seenIds.add(p.id);
                            allPayments.push(p);
                        }
                    });
                }
            }

            // Fallback for UI: If Firestore empty (e.g. first time), try one last manual fetch if needed?
            // Actually syncStudentFinancialData already populates FS.

            // Sort by due date
            allPayments.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
            setPayments(allPayments);

        } catch (error) {
            console.error("Error fetching payments:", error);
        } finally {
            setLoadingPayments(false);
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando financeiro...</div>;

    if (allRegistrations.length === 0) return (
        <PageContainer>
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <h2 style={{ color: '#00a63a' }}>Cadastro não encontrado.</h2>
            </div>
        </PageContainer>
    );

    return (
        <PageContainer>
            <PageTitle
                title="PAGAMENTOS"
                subtitle="Consulte suas faturas e histórico"
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <button
                    onClick={() => {
                        const firstWithCpf = allRegistrations.find(r => r.responsavel?.cpf);
                        if (firstWithCpf?.responsavel?.cpf) fetchPayments(firstWithCpf.responsavel.cpf, allRegistrations);
                    }}
                    disabled={loadingPayments}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem' }}
                >
                    <RefreshCw size={18} className={loadingPayments ? 'spin' : ''} />
                    {loadingPayments ? 'Buscando...' : 'Atualizar'}
                </button>
            </div>

            {loadingPayments && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    <RefreshCw size={24} className="spin" />
                    <p>Buscando suas faturas...</p>
                </div>
            )}

            {allRegistrations.map((registration, regIdx) => {
                const studentName = registration.alunos?.[0]?.nome || 'Atleta';
                const studentFirstName = studentName.split(' ')[0].toUpperCase();
                const studentFullName = studentName.toUpperCase();

                // Filter payments for THIS student AND modality
                const modalityNormalized = (registration.modalidade || '').toUpperCase();
                const studentPayments = payments.filter(p => {
                    const desc = (p.description || '').toUpperCase();
                    const nameMatch = desc.includes(studentFullName) || (studentFirstName.length > 2 && desc.includes(studentFirstName));
                    const modalityMatch = !modalityNormalized || desc.includes(`(${modalityNormalized})`) || desc.includes(modalityNormalized);

                    return nameMatch && modalityMatch;
                });

                const isRegistrationPaid = registration.status === 'confirmado';

                // Category sorting for this specific student
                const pending = studentPayments.filter((p: any) =>
                    !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE', 'DELETED', 'REFUNDED', 'REMOVED_BY_RECEIVER'].includes(p.status)
                );

                const openPlanPayment = pending.find(p => !p.externalReference?.includes('MANUAL_'));
                const manualPayments = pending.filter(p => p.externalReference?.includes('MANUAL_'));

                const otherPending = pending.filter(p =>
                    !p.externalReference?.includes('MANUAL_') && p.id !== openPlanPayment?.id
                );
                const paidPayments = studentPayments.filter((p: any) =>
                    ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'].includes(p.status)
                ).sort((a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

                return (
                    <div key={registration.id} style={{ marginBottom: regIdx < allRegistrations.length - 1 ? '50px' : '20px' }}>
                        <div style={{
                            background: '#111',
                            color: '#fff',
                            padding: '12px 20px',
                            borderRadius: '12px 12px 0 0',
                            fontSize: '1rem',
                            fontWeight: '900',
                            borderLeft: '5px solid #00a63a',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span>{studentFullName}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{registration.modalidade?.toUpperCase()}</span>
                        </div>

                        <div style={{
                            background: '#fff',
                            border: '1px solid #eee',
                            borderTop: 'none',
                            borderRadius: '0 0 12px 12px',
                            padding: '20px'
                        }}>
                            {/* Taxa de Matrícula */}
                            {(registration.amount || 0) > 0 && (
                                <div style={{
                                    padding: '15px',
                                    background: isRegistrationPaid ? '#f0fdf4' : '#fff7ed',
                                    borderRadius: '10px',
                                    marginBottom: '20px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    border: isRegistrationPaid ? '1px solid #dcfce7' : '1px solid #ffedd5'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: isRegistrationPaid ? '#166534' : '#9a3412', fontWeight: 'bold' }}>TAXA DE MATRÍCULA {registration.ano}</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '900', color: isRegistrationPaid ? '#166534' : '#9a3412' }}>
                                            {isRegistrationPaid ? 'PAGO' : 'PENDENTE'}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((registration.amount || 0) / 100)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Mensalidades e Outros */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {openPlanPayment && (
                                    <>
                                        <div style={{ padding: '4px 0', fontWeight: '900', color: '#00a63a', fontSize: '0.75rem', borderBottom: '1px solid #fee2e2', textTransform: 'uppercase' }}>
                                            Mensalidade Atual
                                        </div>
                                        <PaymentCard
                                            payment={openPlanPayment}
                                            isCurrentPayment={true}
                                            showPaymentMethods={true}
                                            responsibleName={registration.responsavel?.nome}
                                            responsiblePhone={registration.responsavel?.telefonePrincipal}
                                        />
                                    </>
                                )}

                                {manualPayments.length > 0 && (
                                    <div style={{ marginTop: '5px' }}>
                                        <div style={{ padding: '4px 0', fontWeight: '900', color: '#00a63a', fontSize: '0.75rem', borderBottom: '1px solid #fee2e2', textTransform: 'uppercase', marginBottom: '10px' }}>
                                            Cobranças Extras
                                        </div>
                                        {manualPayments.map(p => (
                                            <PaymentCard
                                                key={p.id}
                                                payment={p}
                                                isCurrentPayment={true}
                                                showPaymentMethods={true}
                                                responsibleName={registration.responsavel?.nome}
                                                responsiblePhone={registration.responsavel?.telefonePrincipal}
                                            />
                                        ))}
                                    </div>
                                )}

                                {otherPending.length > 0 && (
                                    <div style={{ marginTop: '5px' }}>
                                        <div
                                            onClick={() => setShowFuture(!showFuture)}
                                            style={{
                                                padding: '8px 0',
                                                fontWeight: 'bold',
                                                color: '#888',
                                                fontSize: '0.75rem',
                                                borderBottom: '1px solid #eee',
                                                textTransform: 'uppercase',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            Próximas Faturas do Plano ({otherPending.length})
                                            {showFuture ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                        {showFuture && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                                {otherPending.map((p: any) => (
                                                    <PaymentCard
                                                        key={p.id}
                                                        payment={p}
                                                        isCurrentPayment={false}
                                                        showPaymentMethods={false}
                                                        responsibleName={registration.responsavel?.nome}
                                                        responsiblePhone={registration.responsavel?.telefonePrincipal}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {paidPayments.length > 0 && (
                                    <div style={{ marginTop: '5px' }}>
                                        <div
                                            style={{
                                                padding: '8px 0',
                                                fontWeight: 'bold',
                                                color: '#2e7d32',
                                                fontSize: '0.75rem',
                                                borderBottom: '1px solid #dcfce7',
                                                textTransform: 'uppercase',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            Histórico de Pagas ({paidPayments.length})
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                            {paidPayments.slice(0, 5).map((p: any) => (
                                                <PaymentCard
                                                    key={p.id}
                                                    payment={p}
                                                    isCurrentPayment={false}
                                                    showPaymentMethods={false}
                                                    responsibleName={registration.responsavel?.nome}
                                                    responsiblePhone={registration.responsavel?.telefonePrincipal}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {studentPayments.length === 0 && !loadingPayments && (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                        Nenhuma mensalidade encontrada para este dependente.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </PageContainer>
    );
}
