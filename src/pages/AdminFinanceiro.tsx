
import { useEffect, useState, useRef, useMemo } from 'react';
import { collection, getDocs, query, orderBy, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { planService } from '../utils/planService';
import type { Plan } from '../utils/planService';
import { useLoading } from '../components/LoadingService';
import '../App.css';
import { StatsCards } from './AdminFinanceiroComponents/StatsCards';
import { RegistrationList } from './AdminFinanceiroComponents/RegistrationList';
import { RegistrationCard } from './AdminFinanceiroComponents/RegistrationCard';
import { FinanceFilters } from './AdminFinanceiroComponents/FinanceFilters';
import { FinanceDrawer } from './AdminFinanceiroComponents/FinanceDrawer';
import type { StudentData } from '../utils/financialTypes';
import { useFinancialOperations } from './AdminFinanceiroComponents/useFinancialOperations';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import { ManualChargesModal } from './AdminFinanceiroComponents/ManualChargesModal';
import { OverdueStudentsModal } from './AdminFinanceiroComponents/OverdueStudentsModal';
import { MonthlyChargesModal } from './AdminFinanceiroComponents/MonthlyChargesModal';

export default function AdminFinanceiro() {
    const { showAlert } = useDialog();
    const { setLoading: setLoadingOverlay } = useLoading();
    const { canEdit } = useAdminPermissions();
    const [registrations, setRegistrations] = useState<StudentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [modalityFilter, setModalityFilter] = useState('futebol');
    const workerUrl = import.meta.env.VITE_WORKER_URL;

    // Financial Actions State
    const [selectedRegistration, setSelectedRegistration] = useState<StudentData | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isManualChargesModalOpen, setIsManualChargesModalOpen] = useState(false);
    const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);
    const [isMonthlyChargesModalOpen, setIsMonthlyChargesModalOpen] = useState(false);
    const observerTarget = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();

    // Hook for Financial Operations
    const {
        paymentHistory,
        loadingHistory,
        fetchHistory,
        syncSingleRegistration,
        handleMigrateStudent,
        handleCreateManualCharge,
        handleDeletePayment,
        handleDeleteAllPayments,
        handleUpdateDueDate,
        handleUpdatePayment,
        handleRestoreDiscount,
        generateBatchCarnet,
        handleReceiveInCash,
        handleSmartSync: handleSmartSyncBase,
        handleGlobalSync: handleGlobalSyncBase,
        paymentConfig
    } = useFinancialOperations({ workerUrl, setRegistrations });

    // Atualiza a linha do aluno na lista assim que a cobranca do mes e criada,
    // sem precisar recarregar a tela inteira.
    const handleRegistrationStatusUpdated = (registrationId: string, status: Record<string, any>) => {
        setRegistrations(prev => prev.map(r => (r.id === registrationId ? { ...r, ...status } as StudentData : r)));
    };

    const handleGlobalSync = async () => {
        setIsSyncing(true);
        setLoadingOverlay(true, 'Sincronizando...');
        try {
            await handleGlobalSyncBase();
        } finally {
            setIsSyncing(false);
            setLoadingOverlay(false);
        }
    };

    const handleSmartSync = async () => {
        setIsSyncing(true);
        try {
            await handleSmartSyncBase();
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSyncSelected = async () => {
        if (selectedIds.length === 0) return;
        setIsSyncing(true);
        setLoadingOverlay(true, `Sincronizando ${selectedIds.length} selecionados...`);
        try {
            let count = 0;
            for (const id of selectedIds) {
                const reg = registrations.find(r => r.id === id);
                if (reg) {
                    setLoadingOverlay(true, `Sincronizando ${count + 1}/${selectedIds.length}\n(${reg.alunos[0]?.nome})`);
                    await syncSingleRegistration(reg);
                    count++;
                }
                if (count < selectedIds.length) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
            showAlert(`${count} registros sincronizados com sucesso.`, 'success');
            setSelectedIds([]);
        } catch (err) {
            console.error(err);
            showAlert("Erro ao sincronizar selecionados.", "error");
        } finally {
            setIsSyncing(false);
            setLoadingOverlay(false);
        }
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleToggleSelectAll = (ids: string[]) => {
        setSelectedIds(prev => {
            const allAlreadySelected = ids.every(id => prev.includes(id));
            if (allAlreadySelected) return prev.filter(id => !ids.includes(id));
            return [...new Set([...prev, ...ids])];
        });
    };

    const handleCloseDrawer = () => {
        setSelectedRegistration(null);

        const params = new URLSearchParams(location.search);
        if (params.has('regId')) {
            params.delete('regId');
            const nextSearch = params.toString();
            navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
        }
    };

    const filtered = useMemo(() => {
        return registrations.filter(r => {
            const matchesSearch =
                (r.responsavel?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.alunos?.[0]?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.responsavel?.cpf || '').includes(searchTerm);

            const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
            const matchesModality = modalityFilter === 'all' || r.modalidade?.toLowerCase() === modalityFilter;

            return matchesSearch && matchesStatus && matchesModality;
        });
    }, [registrations, searchTerm, statusFilter, modalityFilter]);

    // Plans
    const [plans, setPlans] = useState<Plan[]>([]);

    const stats = useMemo(() => {
        const modalityRegistrations = modalityFilter === 'all'
            ? registrations
            : registrations.filter(r => r.modalidade?.toLowerCase() === modalityFilter);

        const studentCount = modalityRegistrations.reduce((acc, r) => acc + (r.alunos?.length || 0), 0);

        // Approval Stats
        const approvedCount = modalityRegistrations.filter(r => r.contractStatus === 'aprovado').length;
        const notApprovedCount = modalityRegistrations.length - approvedCount;

        // "Em Atraso e Pendente" = Qualquer valor pendente > 0
        const pendingRegs = modalityRegistrations.filter(r =>
            (r.financialPendingAmount || 0) > 0
        );
        const pendingCount = pendingRegs.reduce((acc, r) => acc + (r.alunos?.length || 0), 0);
        const pendingAmount = pendingRegs.reduce((acc, r) => acc + (r.financialPendingAmount || 0), 0);
        const pendingNames = pendingRegs.map(r => r.alunos[0]?.nome).filter(Boolean);

        const paidCount = modalityRegistrations.filter(r => r.status === 'pago' || r.status === 'confirmado').length;
        const revenue = modalityRegistrations.reduce((acc: number, curr) => acc + (curr.financialReceivedThisMonth || 0), 0);

        // A Receber: apenas faturas com vencimento neste mês
        const toReceive = modalityRegistrations.reduce((acc, r) => acc + (r.financialPendingThisMonth || 0), 0);

        // Mês anterior
        const revenueLastMonth = modalityRegistrations.reduce((acc: number, curr) =>
            acc + (curr.financialReceivedLastMonth ?? curr.financialReceivedAmount ?? 0), 0);
        const toReceiveLastMonth = modalityRegistrations.reduce((acc, r) =>
            acc + (r.financialPendingLastMonth ?? r.financialPendingAmount ?? 0), 0);

        // MRR Calculation (Receita Mensal Recorrente)
        let mrr = 0;
        modalityRegistrations.forEach((reg: any) => {
            const planId = reg.planId;
            const plan = planId ? plans.find((p: any) => p.id === planId) : null;
            let monthlyVal = 0;

            if (plan) {
                monthlyVal = plan.valores?.mensalidade?.ateVencimento || plan.valor || 0;
            } else if (reg.modalidade) {
                const mod = reg.modalidade.toLowerCase();
                const modalityPlan = plans.find((p: any) => p.modalidade?.toLowerCase() === mod && p.active);
                if (modalityPlan) {
                    monthlyVal = modalityPlan.valores?.mensalidade?.ateVencimento || modalityPlan.valor || 0;
                }
            }

            const regStudents = reg.alunos?.length || 1;
            mrr += (monthlyVal / 100) * regStudents;
        });

        return {
            total: studentCount,
            approvedCount,
            notApprovedCount,
            pendingCount,
            pendingAmount,
            pendingNames,
            paid: paidCount,
            revenue,
            toReceive,
            revenueLastMonth,
            toReceiveLastMonth,
            mrr,
            pendingRegs
        };
    }, [registrations, modalityFilter, plans]);

    // Pagination State
    const [visibleCount, setVisibleCount] = useState(20);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);

        // Initial Fetch
        fetchRegistrations();

        // Fetch plans for dropdowns
        planService.getPlans().then(setPlans).catch(console.error);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-open drawer if regId is in URL
    useEffect(() => {
        if (!loading && registrations.length > 0) {
            const params = new URLSearchParams(location.search);
            const regId = params.get('regId');
            if (regId) {
                const reg = registrations.find(r => r.id === regId);
                if (reg && selectedRegistration?.id !== reg.id) {
                    if (reg.modalidade && modalityFilter !== reg.modalidade) {
                        setModalityFilter(reg.modalidade);
                    }
                    setSelectedRegistration(reg);
                }
            }
        }
    }, [loading, registrations, location.search, selectedRegistration?.id, modalityFilter]);

    // Fetch payment history when selectedRegistration changes
    useEffect(() => {
        fetchHistory(selectedRegistration);
        if (selectedRegistration) {
            syncSingleRegistration(selectedRegistration);
        }
    }, [selectedRegistration, fetchHistory, syncSingleRegistration]);

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting) {
                    setVisibleCount(prev => prev + 20);
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [filtered.length]);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(20);
    }, [searchTerm, statusFilter, modalityFilter]);

    const splitMultiStudentRegistrations = async (data: StudentData[]) => {
        const multi = data.filter(r => r.alunos && r.alunos.length > 1);
        if (multi.length === 0) return data;

        setLoadingOverlay(true, `Ajustando ${multi.length} cadastros múltiplos...`);

        for (const reg of multi) {
            try {
                const students = [...reg.alunos];
                const firstStudent = students[0];
                const otherStudents = students.slice(1);

                const originRef = doc(db, 'rumo_ao_esporte_2026_registrations', reg.id);
                await updateDoc(originRef, {
                    alunos: [firstStudent]
                });

                for (let i = 0; i < otherStudents.length; i++) {
                    const student = otherStudents[i];
                    const deterministicId = `${reg.id}_split_${i + 1}`;
                    const newRegRef = doc(db, 'rumo_ao_esporte_2026_registrations', deterministicId);

                    const newRegData = {
                        ...reg,
                        id: deterministicId,
                        alunos: [student]
                    };
                    await setDoc(newRegRef, newRegData);
                }
                console.log(`[Split] Cadastro ${reg.id} dividido de forma idempotente.`);
            } catch (err) {
                console.error(`[Split] Erro ao dividir cadastro ${reg.id}:`, err);
            }
        }

        setLoadingOverlay(false);
        return null;
    };

    const fetchRegistrations = async () => {
        setLoading(true);

        try {
            const registrationsRef = collection(db, 'rumo_ao_esporte_2026_registrations');
            const q = query(registrationsRef, orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            const rawData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentData));

            // 1. DEDUPLICATE
            const seen = new Set<string>();
            const uniqueData = rawData.filter(r => {
                const studentName = (r.alunos?.[0]?.nome || '').trim().toUpperCase();
                const parentCpf = (r.responsavel?.cpf || '').trim();
                const modality = (r.modalidade || '').toLowerCase();
                const key = `${studentName}|${parentCpf}|${modality}`;

                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            // 2. Check for multi-student docs to split
            const needsSplit = uniqueData.some(r => r.alunos && r.alunos.length > 1);
            if (needsSplit) {
                const result = await splitMultiStudentRegistrations(uniqueData);
                if (result === null) {
                    fetchRegistrations();
                    return;
                }
            }

            // FILTER: Only Approved Students
            const approvedData = uniqueData.filter(r => r.contractStatus === 'aprovado');

            // Client-side Sort (Name)
            const sortedData = approvedData.sort((a, b) => {
                const nameA = (a.alunos[0]?.nome || '').toUpperCase();
                const nameB = (b.alunos[0]?.nome || '').toUpperCase();
                return nameA.localeCompare(nameB);
            });

            setRegistrations(sortedData);

        } catch (error) {
            console.error('Error fetching registrations:', error);
            showAlert('Erro ao carregar dados.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-page page-enter" style={{ position: 'relative' }}>
            <header style={{ marginBottom: '20px' }}>
                <h1 style={{ fontSize: '1.8rem', color: '#00a63a', fontWeight: '800', margin: 0 }}>FINANCEIRO</h1>
                <p style={{ color: '#666', marginTop: '5px' }}>Gestão de faturas, planos e recebimentos.</p>
            </header>

            {/* Modality Tabs Bar */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '25px',
                overflowX: 'auto',
                paddingBottom: '10px',
                borderBottom: '1px solid #eee'
            }}>
                {[
                    { id: 'futebol', label: 'FUTEBOL' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setModalityFilter(tab.id)}
                        style={{
                            padding: '12px 30px',
                            borderRadius: '12px 12px 0 0',
                            border: 'none',
                            background: modalityFilter === tab.id ? '#00a63a' : 'transparent',
                            color: modalityFilter === tab.id ? '#fff' : '#888',
                            fontWeight: '800',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease',
                            borderBottom: modalityFilter === tab.id ? '3px solid #9a1a1f' : '3px solid transparent'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <StatsCards modalityFilter={modalityFilter} stats={stats} onPendingClick={() => setIsOverdueModalOpen(true)} />

            <FinanceFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                onRefresh={fetchRegistrations}
                onSync={handleGlobalSync}
                onSmartSync={handleSmartSync}
                onSyncSelected={handleSyncSelected}
                onSelectAll={() => handleToggleSelectAll(filtered.map(r => r.id))}
                onClearAll={() => setSelectedIds([])}
                selectedCount={selectedIds.length}
                onViewManualCharges={() => setIsManualChargesModalOpen(true)}
                onGenerateMonthlyCharges={() => setIsMonthlyChargesModalOpen(true)}
                isSyncing={isSyncing}
                loading={loading}
                readOnly={!canEdit}
            />

            {/* Alunos Table / Mobile Cards */}
            {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#999', background: '#fff', borderRadius: '12px' }}>Carregando faturas...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#999', background: '#fff', borderRadius: '12px' }}>Nenhum registro encontrado.</div>
                    ) : filtered.slice(0, visibleCount).map(r => (
                        <RegistrationCard
                            key={r.id}
                            registration={r}
                            onSelect={setSelectedRegistration}
                            isSelected={selectedIds.includes(r.id)}
                            onToggleSelect={handleToggleSelect}
                            readOnly={!canEdit}
                        />
                    ))}
                </div>
            ) : (
                <RegistrationList
                    loading={loading}
                    filtered={filtered}
                    visibleCount={visibleCount}
                    onSelect={setSelectedRegistration}
                    plans={plans}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    readOnly={!canEdit}
                />
            )}

            <div ref={observerTarget} style={{ height: '20px', margin: '20px 0' }} />

            <FinanceDrawer
                registration={selectedRegistration}
                onClose={handleCloseDrawer}
                plans={plans}
                paymentHistory={paymentHistory}
                loadingHistory={loadingHistory}
                fetchHistory={fetchHistory}
                handleMigrateStudent={handleMigrateStudent}
                handleCreateManualCharge={handleCreateManualCharge}
                handleDeletePayment={handleDeletePayment}
                handleDeleteAllPayments={handleDeleteAllPayments}
                generateBatchCarnet={generateBatchCarnet}
                handleUpdateDueDate={handleUpdateDueDate}
                handleUpdatePayment={handleUpdatePayment}
                handleRestoreDiscount={handleRestoreDiscount}
                handleReceiveInCash={handleReceiveInCash}
                readOnly={!canEdit}
            />

            <ManualChargesModal
                isOpen={isManualChargesModalOpen}
                onClose={() => setIsManualChargesModalOpen(false)}
                registrations={registrations}
            />

            <MonthlyChargesModal
                isOpen={isMonthlyChargesModalOpen}
                onClose={() => setIsMonthlyChargesModalOpen(false)}
                registrations={registrations}
                plans={plans}
                workerUrl={workerUrl}
                paymentConfig={paymentConfig}
                onFinished={fetchRegistrations}
                onRegistrationUpdated={handleRegistrationStatusUpdated}
            />

            <OverdueStudentsModal
                isOpen={isOverdueModalOpen}
                onClose={() => setIsOverdueModalOpen(false)}
                overdueStudents={stats.pendingRegs}
                onSelectStudent={(student) => {
                    setSelectedRegistration(student);
                    setIsOverdueModalOpen(false);
                }}
            />
            
        </div >
    );
}
