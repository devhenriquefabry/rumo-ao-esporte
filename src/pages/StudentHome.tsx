import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Activity, Calendar, User, CreditCard } from 'lucide-react';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import { PaymentCard } from '../components/PaymentCard';
import { syncStudentFinancialData } from '../utils/financialSync';
import React from 'react';

const workerUrl = import.meta.env.VITE_WORKER_URL;

export default function StudentHome() {
    // We now store a list of all students from ALL matching registrations
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [responsavel, setResponsavel] = useState<any>(null);
    const [turmas, setTurmas] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [pendingPayments, setPendingPayments] = useState<any[]>([]);

    useEffect(() => {
        // Use onAuthStateChanged to ensure we wait for Firebase to initialize
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            const impersonatedEmail = localStorage.getItem('uba_impersonated_student_email');
            if (impersonatedEmail || (user && user.email)) {
                try {
                    // 1. Fetch ALL Registrations for this email (normalized to lowercase)
                    const normalizedEmail = (impersonatedEmail || user!.email!).toLowerCase().trim();
                    console.log("[DEBUG] StudentHome: User Email:", user?.email);
                    console.log("[DEBUG] StudentHome: Normalized Email:", normalizedEmail);

                    const q = query(collection(db, "arena_simonesia_2026_registrations"), where("responsavel.email", "==", normalizedEmail));
                    const querySnapshot = await getDocs(q);

                    console.log("[DEBUG] StudentHome: Records found:", querySnapshot.size);
                    if (querySnapshot.size > 0) {
                        console.log("[DEBUG] StudentHome: IDs found:", querySnapshot.docs.map(d => d.id));
                    }

                    const studentsAggregated: any[] = [];
                    let respInfo: any = null;
                    const uniqueCpfs = new Set<string>();

                    if (!querySnapshot.empty) {

                        querySnapshot.forEach((doc) => {
                            const data = doc.data();

                            // Capture responsible info from the first valid document found
                            if (!respInfo && data.responsavel) {
                                respInfo = data.responsavel;
                            }
                            if (data.responsavel?.cpf) {
                                uniqueCpfs.add(data.responsavel.cpf);
                            }

                            // Aggregate students with DEDUPLICATION
                            if (data.alunos && Array.isArray(data.alunos)) {
                                data.alunos.forEach((aluno: any) => {
                                    // Robust normalization for deduplication
                                    const studentName = (aluno.nome || '').trim().replace(/\s+/g, ' ').toUpperCase();
                                    const birthDate = (aluno.dataNascimento || '').trim();
                                    const rawModality = (data.modalidade || '').trim().replace(/\s+/g, ' ');
                                    // Key focused ONLY on the person, not the enrollment

                                    const existingStudent = studentsAggregated.find(s =>
                                        s.nome.toUpperCase() === studentName &&
                                        (s.dataNascimento || '').trim() === birthDate
                                    );

                                    if (existingStudent) {
                                        if (rawModality && !existingStudent.modalidades.includes(rawModality)) {
                                            existingStudent.modalidades.push(rawModality);
                                        }
                                        if (!existingStudent.registrationIds.includes(doc.id)) {
                                            existingStudent.registrationIds.push(doc.id);
                                        }
                                    } else {
                                        studentsAggregated.push({
                                            ...aluno,
                                            nome: (aluno.nome || '').trim().replace(/\s+/g, ' '),
                                            registrationIds: [doc.id],
                                            modalidades: rawModality ? [rawModality] : [],
                                            status: data.status,
                                            categoriaFutebol: data.categoriaFutebol,
                                            contractGenerated: data.contractGenerated !== false
                                        });
                                    }
                                });
                            }
                        });

                        setAllStudents(studentsAggregated);
                        setResponsavel(respInfo);

                        // 2. TRIGGER SYNC (Parallel) - Check if payments were made recently to update Firestore status
                        if (querySnapshot.size > 0) {
                            querySnapshot.docs.forEach(docSnap => {
                                const data = docSnap.data();
                                if (data.responsavel?.cpf) {
                                    // We use the shared "Deep Sync" utility
                                    syncStudentFinancialData(
                                        docSnap.id,
                                        data.responsavel.cpf,
                                        data.alunos?.[0]?.nome || '',
                                        data.modalidade || '',
                                        workerUrl
                                    ).catch(e => console.error(`[DEEP SYNC ERROR] ${docSnap.id}:`, e));
                                }
                            });
                        }

                        // 3. Fetch payments for ALL unique responsible CPFs found
                        if (uniqueCpfs.size > 0) {
                            try {
                                const cpfArray = Array.from(uniqueCpfs);
                                console.log("[DEBUG] StudentHome: Fetching payments for CPFs:", cpfArray);

                                const paymentPromises = cpfArray.map(async (cpfStr) => {
                                    try {
                                        const cleanCpf = cpfStr.replace(/\D/g, '');
                                        const custRes = await fetch(`${workerUrl}/customers-by-cpf/${cleanCpf}`);
                                        const custData = await custRes.json();

                                        if (custData.success && custData.customer) {
                                            const payRes = await fetch(`${workerUrl}/payments?customer=${custData.customer.id}&limit=50`);
                                            const payData = await payRes.json();
                                            return payData.data || [];
                                        }
                                    } catch (err) {
                                        console.error(`Error fetching for CPF ${cpfStr}:`, err);
                                    }
                                    return [];
                                });

                                const results = await Promise.all(paymentPromises);

                                // Flatten and Deduplicate payments by ID
                                const allRawPayments = results.flat();
                                const uniquePaymentsMap = new Map();
                                allRawPayments.forEach(p => {
                                    if (p.id) uniquePaymentsMap.set(p.id, p);
                                });

                                const mergedPayments = Array.from(uniquePaymentsMap.values());

                                // Buscar cobranças deste sistema (ARENA2026). Agora trazemos tanto pendentes quanto pagas para checar o "Em Dia"
                                const allAsaasPayments = mergedPayments
                                    .filter((p: any) =>
                                        p.externalReference &&
                                        (p.externalReference.startsWith('ARENA2026') || p.externalReference.includes('MANUAL_'))
                                    )
                                    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

                                setPendingPayments(allAsaasPayments);

                            } catch (e) {
                                console.error('Error fetching payments:', e);
                            }
                        }

                        // 2. Fetch Turmas (all active for lookup)
                        const tQ = query(collection(db, 'turmas'));
                        const tSnap = await getDocs(tQ);
                        const tMap: Record<string, any> = {};
                        tSnap.forEach(doc => {
                            tMap[doc.id] = doc.data();
                        });
                        setTurmas(tMap);
                    }
                } catch (error) {
                    console.error("Error fetching data:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                // If no user is logged in, stop loading (Layout handles redirect)
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando informações...</div>;

    if (allStudents.length === 0) return (
        <PageContainer>
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <h2 style={{ color: '#007d2f' }}>Nenhum atleta encontrado.</h2>
                <p style={{ color: '#666' }}>Entre em contato com a secretaria se acreditar que isso é um erro.</p>
            </div>
        </PageContainer>
    );

    return (
        <PageContainer>
            <div style={{ position: 'relative', minHeight: '80vh' }}>
                {/* Background Image Overlay */}
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100vw',
                    height: '100vh',
                    backgroundImage: 'url(/logo-dashboard.png)',
                    backgroundSize: '400px',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    opacity: 0.05,
                    pointerEvents: 'none',
                    zIndex: 0
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <style>{`
                    /* Responsible Card Styles */
                    .responsible-card {
                        background: #fff;
                        border-radius: 12px;
                        padding: 20px;
                        border-left: 5px solid #007d2f; /* Red Theme */
                        box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                        display: flex;
                        align-items: center;
                        gap: 15px;
                        margin-bottom: 25px;
                    }
                    .resp-icon {
                        width: 45px;
                        height: 45px;
                        border-radius: 50%;
                        background: #fff5f5;
                        color: #007d2f;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    /* Student Card Styles */
                    .student-card {
                        background: #fff;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                        border: 1px solid #eef2ff;
                        border-left: 5px solid #00237f; /* Blue Theme */
                    }
                    .student-card-content {
                        display: flex;
                        gap: 20px;
                        align-items: center;
                        padding: 20px;
                    }
                    .student-avatar {
                        width: 80px;
                        height: 80px;
                        border-radius: 50%;
                        background-color: #f0f0f0;
                        background-size: cover;
                        background-position: center;
                        flex-shrink: 0;
                        border: 3px solid #fff;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    .student-info {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .student-name {
                        margin: 0;
                        color: #00237f;
                        font-size: 1.25rem;
                        text-transform: uppercase;
                        font-weight: 800;
                        line-height: 1.2;
                    }
                    .student-badges {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-wrap: wrap;
                    }
                    .badge {
                        font-size: 0.75rem;
                        padding: 4px 10px;
                        border-radius: 6px;
                        font-weight: 700;
                        text-transform: uppercase;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .badge-modality {
                        background: #f8f9fa;
                        color: #555;
                        border: 1px solid #eee;
                    }
                    .badge-class {
                        background: #eef2ff;
                        color: #00237f;
                    }
                        .badge-pending {
                            background: #fff3cd;
                            color: #856404;
                        }
                        .badge-no-contract {
                            background: #f1f1f1;
                            color: #666;
                        }

                        /* Hide scrollbar but keep functionality */
                        .hide-scrollbar::-webkit-scrollbar {
                            display: none;
                        }
                        .hide-scrollbar {
                            -ms-overflow-style: none; /* IE and Edge */
                            scrollbar-width: none; /* Firefox */
                        }

                        /* Mobile Optimization */
                    @media (max-width: 600px) {
                        .responsible-card {
                            padding: 15px;
                            gap: 12px;
                            margin-bottom: 15px;
                        }
                        .resp-icon {
                            width: 35px;
                            height: 35px;
                        }
                        
                        .student-card-content {
                            padding: 12px; /* reduced padding */
                            gap: 12px;
                        }
                        .student-avatar {
                            width: 55px; /* compact avatar */
                            height: 55px;
                        }
                        .student-name {
                            font-size: 1rem; /* compact title */
                        }
                        .student-badges {
                            gap: 6px;
                        }
                        .badge {
                            padding: 2px 8px;
                            font-size: 0.7rem;
                        }
                    }
                `}</style>

                    <PageTitle
                        title="MEU ATLETA"
                        subtitle="Acompanhe as informações da sua inscrição"
                    />

                    {/* RESPONSIBLE CARD (Red Theme) */}
                    {responsavel && (
                        <div className="responsible-card">
                            <div className="resp-icon">
                                <User size={24} />
                            </div>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', fontWeight: 'bold' }}>Responsável Financeiro</span>
                                <h3 style={{ margin: 0, color: '#007d2f', fontSize: '1.1rem' }}>
                                    {responsavel.nome.toUpperCase()}
                                </h3>
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                                    <CreditCard size={12} />
                                    <span>CPF: {responsavel.cpf}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CURRENT PAYMENT CARDS GROUPED BY STUDENT */}
                    {pendingPayments.length > 0 && (
                        <div style={{ marginBottom: '25px' }}>
                            {allStudents.map(student => {
                                const studentFullName = student.nome.toUpperCase();

                                // 1. Filter ALL payments related to this student by name
                                const allStudentPayments = pendingPayments.filter(p => {
                                    const desc = (p.description || '').toUpperCase();
                                    const strictNameMatch = desc.includes(studentFullName);
                                    const nameParts = studentFullName.split(' ');
                                    const firstLastMatch = nameParts.length > 1 &&
                                        desc.includes(nameParts[0]) &&
                                        desc.includes(nameParts[nameParts.length - 1]);
                                    return strictNameMatch || firstLastMatch;
                                });

                                if (allStudentPayments.length === 0) return null;

                                // 2. Determine which modalities to show
                                const displayModalities = student.modalidades.length > 0 ? student.modalidades : [''];

                                // 3. Separate paid vs pending for easier logic
                                const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
                                const allStudentPending = allStudentPayments.filter(p => !paidStatuses.includes(p.status));
                                const studentManual = allStudentPending.filter(p => p.externalReference?.includes('MANUAL_'));

                                return (
                                    <React.Fragment key={`${student.nome}-${student.dataNascimento}`}>
                                        {/* Render a SEPARATE ROW for EACH modality */}
                                        {displayModalities.map((modName: string) => {
                                            const modUpper = modName.toUpperCase();

                                            // Filter payments specifically for this modality
                                            const modPayments = allStudentPayments.filter(p => {
                                                const desc = (p.description || '').toUpperCase();
                                                if (!modUpper) return true;
                                                return desc.includes(`(${modUpper})`) || desc.includes(modUpper);
                                            });

                                            if (modPayments.length === 0) return null;

                                            const modPending = modPayments.filter(p => !paidStatuses.includes(p.status));
                                            const modPaid = modPayments.filter(p => paidStatuses.includes(p.status));

                                            const openPlanPayment = modPending.find(p => !p.externalReference?.includes('MANUAL_'));
                                            const modManual = modPending.filter(p => p.externalReference?.includes('MANUAL_'));
                                            const futureInstallments = modPending.filter(p => !p.externalReference?.includes('MANUAL_') && p.id !== openPlanPayment?.id);
                                            const latestPaid = [...modPaid].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())[0];

                                            let primaryCard = null;
                                            let cardShowEmDia = false;
                                            const today = new Date();
                                            today.setHours(12, 0, 0, 0);

                                            if (openPlanPayment) {
                                                const dueDate = new Date(openPlanPayment.dueDate + 'T12:00:00');
                                                const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                                                if (diffDays > 10 && latestPaid) {
                                                    primaryCard = latestPaid;
                                                    cardShowEmDia = true;
                                                } else {
                                                    primaryCard = openPlanPayment;
                                                }
                                            } else if (latestPaid) {
                                                primaryCard = latestPaid;
                                                cardShowEmDia = true;
                                            }

                                            const modPendingCount = modPending.filter(p => {
                                                const d = new Date(p.dueDate + 'T12:00:00');
                                                const now = new Date();
                                                // Include everything due up to the end of the current month
                                                return (d.getFullYear() < now.getFullYear()) ||
                                                    (d.getFullYear() === now.getFullYear() && d.getMonth() <= now.getMonth());
                                            }).length;

                                            return (
                                                <div key={modName || 'general'} style={{ marginBottom: '25px' }}>
                                                    <div style={{
                                                        padding: '4px 0',
                                                        fontSize: '0.75rem',
                                                        color: '#007d2f',
                                                        textTransform: 'uppercase',
                                                        fontWeight: '900',
                                                        marginBottom: '8px',
                                                        borderBottom: '1px solid #fee2e2',
                                                        display: 'flex',
                                                        justifyContent: 'space-between'
                                                    }}>
                                                        <span>Faturas: {student.nome} {modName && `(${modName})`}</span>
                                                        {modPendingCount > 0 && (
                                                            <span style={{ background: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>
                                                                {modPendingCount} pendente(s)
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '15px',
                                                        overflowX: 'auto',
                                                        paddingBottom: '10px',
                                                        margin: '0 -20px',
                                                        paddingLeft: '20px',
                                                        paddingRight: '20px'
                                                    }} className="hide-scrollbar">
                                                        {/* Primary Card (Current/Paid) */}
                                                        {primaryCard && (
                                                            <div style={{ minWidth: '280px', maxWidth: '350px', flex: '1 0 auto', display: 'flex' }}>
                                                                <PaymentCard
                                                                    payment={primaryCard}
                                                                    isCurrentPayment={true}
                                                                    showPaymentMethods={!cardShowEmDia}
                                                                    statusLabelOverride={cardShowEmDia ? "EM DIA" : undefined}
                                                                    responsibleName={responsavel?.nome || ''}
                                                                    responsiblePhone={responsavel?.telefonePrincipal || ''}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Future Installments (The rest of the plan) */}
                                                        {futureInstallments.map(p => (
                                                            <div key={p.id} style={{ minWidth: '280px', maxWidth: '350px', flex: '1 0 auto', display: 'flex' }}>
                                                                <PaymentCard
                                                                    payment={p}
                                                                    isCurrentPayment={false}
                                                                    showPaymentMethods={true}
                                                                    responsibleName={responsavel?.nome || ''}
                                                                    responsiblePhone={responsavel?.telefonePrincipal || ''}
                                                                />
                                                            </div>
                                                        ))}

                                                        {/* Manual Payments for this specific modality */}
                                                        {modManual.map(p => (
                                                            <div key={p.id} style={{ minWidth: '280px', maxWidth: '350px', flex: '1 0 auto', display: 'flex' }}>
                                                                <PaymentCard
                                                                    payment={p}
                                                                    isCurrentPayment={false}
                                                                    showPaymentMethods={true}
                                                                    responsibleName={responsavel?.nome || ''}
                                                                    responsiblePhone={responsavel?.telefonePrincipal || ''}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Fallback for General Manual Payments (not matched to any specific modality row) */}
                                        {(() => {
                                            const unmatchedManual = studentManual.filter((p: any) => {
                                                const desc = (p.description || '').toUpperCase();
                                                return !student.modalidades.some((m: string) => desc.includes(m.toUpperCase()));
                                            });

                                            if (unmatchedManual.length === 0) return null;

                                            return (
                                                <div style={{ marginBottom: '25px' }}>
                                                    <div style={{
                                                        padding: '4px 0',
                                                        fontSize: '0.75rem',
                                                        color: '#64748b',
                                                        textTransform: 'uppercase',
                                                        fontWeight: 'bold',
                                                        marginBottom: '8px',
                                                        borderBottom: '1px solid #e2e8f0',
                                                        display: 'flex',
                                                        justifyContent: 'space-between'
                                                    }}>
                                                        <span>Outras Cobranças: {student.nome}</span>
                                                        {(() => {
                                                            const now = new Date();
                                                            const currentMonthCount = unmatchedManual.filter(p => {
                                                                const d = new Date(p.dueDate + 'T12:00:00');
                                                                return (d.getFullYear() < now.getFullYear()) ||
                                                                    (d.getFullYear() === now.getFullYear() && d.getMonth() <= now.getMonth());
                                                            }).length;
                                                            return currentMonthCount > 0 ? (
                                                                <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                                                                    {currentMonthCount} pendente(s)
                                                                </span>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '15px',
                                                        overflowX: 'auto',
                                                        paddingBottom: '10px',
                                                        margin: '0 -20px',
                                                        paddingLeft: '20px',
                                                        paddingRight: '20px'
                                                    }} className="hide-scrollbar">
                                                        {unmatchedManual.map(p => (
                                                            <div key={p.id} style={{ minWidth: '280px', maxWidth: '350px', flex: '1 0 auto', display: 'flex' }}>
                                                                <PaymentCard
                                                                    payment={p}
                                                                    isCurrentPayment={false}
                                                                    showPaymentMethods={true}
                                                                    responsibleName={responsavel?.nome || ''}
                                                                    responsiblePhone={responsavel?.telefonePrincipal || ''}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </React.Fragment>
                                );
                            })}

                            {/* Any payment that didn't match a specific student name */}
                            {(() => {
                                const unmatched = pendingPayments.filter(p => {
                                    const desc = (p.description || '').toUpperCase();
                                    return !allStudents.some(s => {
                                        const fn = s.nome.split(' ')[0].toUpperCase();
                                        const full = s.nome.toUpperCase();
                                        return desc.includes(full) || desc.includes(fn);
                                    });
                                });

                                if (unmatched.length === 0) return null;

                                const openPlanUnmatched = unmatched.find(p => !p.externalReference?.includes('MANUAL_'));
                                const manualUnmatched = unmatched.filter(p => p.externalReference?.includes('MANUAL_'));
                                const otherUnmatched = unmatched.filter(p =>
                                    !p.externalReference?.includes('MANUAL_') && p.id !== openPlanUnmatched?.id
                                );
                                const realPendingUnmatched = unmatched.filter(p => {
                                    const d = new Date(p.dueDate + 'T12:00:00');
                                    const now = new Date();
                                    return (d.getFullYear() < now.getFullYear()) ||
                                        (d.getFullYear() === now.getFullYear() && d.getMonth() <= now.getMonth());
                                }).length;

                                return (
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ padding: '4px 0', fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Outras Cobranças do Responsável</span>
                                            {realPendingUnmatched > 0 && <span>{realPendingUnmatched} pendente(s)</span>}
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            gap: '15px',
                                            overflowX: 'auto',
                                            paddingBottom: '10px',
                                            margin: '0 -20px',
                                            paddingLeft: '20px',
                                            paddingRight: '20px'
                                        }} className="hide-scrollbar">
                                            {(() => {
                                                let adiantarButtonUsed = false;
                                                return (
                                                    <>
                                                        {openPlanUnmatched && (
                                                            <div style={{ minWidth: '280px', maxWidth: '350px', flex: '0 0 auto', display: 'flex' }}>
                                                                <PaymentCard
                                                                    payment={openPlanUnmatched}
                                                                    isCurrentPayment={true}
                                                                    showPaymentMethods={true}
                                                                    responsibleName={responsavel?.nome || ''}
                                                                    responsiblePhone={responsavel?.telefonePrincipal || ''}
                                                                />
                                                            </div>
                                                        )}
                                                        {manualUnmatched.map(p => (
                                                            <div key={p.id} style={{ minWidth: unmatched.length > 1 ? '300px' : '100%', flex: 1, display: 'flex' }}>
                                                                <PaymentCard
                                                                    payment={p}
                                                                    isCurrentPayment={true}
                                                                    showPaymentMethods={true}
                                                                    responsibleName={responsavel?.nome || ''}
                                                                    responsiblePhone={responsavel?.telefonePrincipal || ''}
                                                                />
                                                            </div>
                                                        ))}
                                                        {otherUnmatched.map((p: any) => {
                                                            const shouldHideBtn = adiantarButtonUsed;
                                                            if (!adiantarButtonUsed) adiantarButtonUsed = true;

                                                            return (
                                                                <div key={p.id} style={{ minWidth: unmatched.length > 1 ? '300px' : '100%', flex: 1, display: 'flex' }}>
                                                                    <PaymentCard
                                                                        payment={p}
                                                                        isCurrentPayment={false}
                                                                        showPaymentMethods={false}
                                                                        hidePayButton={shouldHideBtn}
                                                                        responsibleName={responsavel?.nome || ''}
                                                                        responsiblePhone={responsavel?.telefonePrincipal || ''}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Students List Title */}
                    <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px', paddingLeft: '5px' }}>
                        Atletas Vinculados ({allStudents.length})
                    </h2>

                    {/* STUDENT CARDS (Blue Theme) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {allStudents.map((aluno: any, index: number) => {
                            const turmaInfo = aluno.turmaId ? turmas[aluno.turmaId] : null;

                            return (
                                <div key={index} className="student-card touch-feedback">
                                    <div className="student-card-content">
                                        {/* Compact Avatar */}
                                        <div className="student-avatar" style={{
                                            backgroundImage: `url(${aluno.fotoUrl || '/placeholder.png'})`,
                                        }} />

                                        <div className="student-info">
                                            <h3 className="student-name">{aluno.nome}</h3>

                                            <div className="student-badges">
                                                <span className="badge badge-modality">
                                                    <Activity size={12} />
                                                    {aluno.modalidade || 'ATIVIDADE'}
                                                </span>

                                                <span className={`badge ${turmaInfo ? 'badge-class' : 'badge-pending'}`}>
                                                    {turmaInfo ? (
                                                        <>
                                                            {turmaInfo.horario} - {turmaInfo.nome}
                                                        </>
                                                    ) : (
                                                        aluno.categoriaFutebol || 'Aguardando Turma'
                                                    )}
                                                </span>

                                                <span className={`badge ${!aluno.contractGenerated ? 'badge-no-contract' : (aluno.signatureData ? 'badge-class' : 'badge-pending')}`} style={{ background: !aluno.contractGenerated ? '#eee' : (aluno.signatureData ? '#eef2ff' : '#fff3cd'), color: !aluno.contractGenerated ? '#666' : (aluno.signatureData ? '#00237f' : '#856404') }}>
                                                    {!aluno.contractGenerated ? 'Sem Contrato' : (aluno.signatureData ? 'Contrato OK' : 'Assinatura Pendente')}
                                                </span>
                                            </div>

                                            {/* Compact Status Line */}
                                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '4px', fontSize: '0.75rem', color: '#888' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={12} />
                                                    {aluno.dataNascimento}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', color: aluno.status === 'confirmado' ? '#2ecc71' : '#f1c40f' }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: aluno.status === 'confirmado' ? '#2ecc71' : '#f1c40f' }}></div>
                                                    {aluno.status === 'confirmado' ? 'ATIVO' : (aluno.status || 'PENDENTE')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
