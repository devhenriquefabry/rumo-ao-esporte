import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import type { StudentData } from '../../utils/financialTypes';
import type { Plan } from '../../utils/planService';
import { PaymentCard } from '../../components/PaymentCard';
import { useDialog } from '../../context/CustomDialogContext';
import { PaymentEditModal } from './PaymentEditModal';
import { DueDateModal } from './DueDateModal';
import { CashPaymentModal } from './CashPaymentModal';
import type { CarnetPricingChoice, CarnetPricingMode } from './useFinancialOperations';

type PricingAction =
    | { type: 'refaturar'; plan: Plan; modality: string }
    | { type: 'migrate'; plan: Plan; modality: string; planId: string };

interface FinanceDrawerProps {
    registration: StudentData | null;
    onClose: () => void;
    plans: Plan[];
    paymentHistory: any[];
    loadingHistory: boolean;
    fetchHistory: (reg: StudentData | null, forceRefresh?: boolean) => void;

    // Hook Functions
    // syncSingleRegistration: (reg: StudentData) => void; // Unused
    handleMigrateStudent: (reg: StudentData | null, mod: string, planId: string, plans: Plan[], cb: () => void, pricingChoice?: CarnetPricingChoice) => Promise<void>;
    handleCreateManualCharge: (reg: StudentData | null, data: any, plans: Plan[]) => Promise<boolean>;
    handleDeletePayment: (id: string, reg: StudentData | null) => Promise<void>;
    handleDeleteAllPayments: (reg: StudentData | null) => Promise<void>;
    generateBatchCarnet: (reg: StudentData, plan: Plan, modality: string, pricingChoice?: CarnetPricingChoice) => Promise<void>;
    handleUpdateDueDate: (id: string, date: string, reg: StudentData | null, cb: () => void) => Promise<void>;
    handleUpdatePayment: (id: string, form: any, reg: StudentData | null, originalPayment?: any) => Promise<void>;
    handleRestoreDiscount: (id: string, reg: StudentData | null) => Promise<void>;
    handleReceiveInCash: (paymentObj: any, value: number, reg: StudentData | null) => Promise<void>;
    readOnly?: boolean;
}

export function FinanceDrawer({
    registration,
    onClose,
    plans,
    paymentHistory,
    loadingHistory,
    fetchHistory,
    // syncSingleRegistration,
    handleMigrateStudent,
    handleCreateManualCharge,
    handleDeletePayment,
    handleDeleteAllPayments,
    generateBatchCarnet,
    handleUpdateDueDate,
    handleUpdatePayment,
    handleRestoreDiscount,
    handleReceiveInCash,
    readOnly
}: FinanceDrawerProps) {
    const { showAlert } = useDialog();

    // Drawer State
    const [activeTab, setActiveTab] = useState<'plan' | 'manual'>('plan');
    const [showFuture, setShowFuture] = useState(false);
    const [showPaid, setShowPaid] = useState(false);

    // Feature Sections Expansion
    const [showMigration, setShowMigration] = useState(false);
    const [showManualCharge, setShowManualCharge] = useState(false);

    // Migration Form
    const [migrationModality, setMigrationModality] = useState('');
    const [migrationPlanId, setMigrationPlanId] = useState('');
    const [pricingAction, setPricingAction] = useState<PricingAction | null>(null);
    const [pricingMode, setPricingMode] = useState<CarnetPricingMode>('standard');
    const [customMonthlyValue, setCustomMonthlyValue] = useState('');

    useEffect(() => {
        if (registration) {
            setMigrationModality(registration.modalidade || '');
            setMigrationPlanId(registration.planId || '');
        }
    }, [registration]);

    // Manual Charge Form
    const [isCreatingCharge, setIsCreatingCharge] = useState(false);
    const [chargeDescription, setChargeDescription] = useState('');
    const [chargeValue, setChargeValue] = useState('');
    const [chargeDueDate, setChargeDueDate] = useState('');
    const [chargeBillingType, setChargeBillingType] = useState('PIX');
    const [chargeHasDiscount, setChargeHasDiscount] = useState(false);
    const [chargeDiscountType, setChargeDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE');
    const [chargeDiscountValue, setChargeDiscountValue] = useState('');

    // Modals State
    const [editingPayment, setEditingPayment] = useState<any | null>(null);
    const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null);
    const [cashPayment, setCashPayment] = useState<any | null>(null);

    if (!registration) return null;

    // Handlers
    const onMigrate = async () => {
        if (!migrationPlanId) {
            showAlert("Selecione um plano.", "error");
            return;
        }
        const plan = plans.find(p => p.id === migrationPlanId);
        if (!plan) {
            showAlert("Plano selecionado nao encontrado.", "error");
            return;
        }
        setPricingMode('standard');
        setCustomMonthlyValue('');
        setPricingAction({ type: 'migrate', plan, modality: migrationModality, planId: migrationPlanId });
    };

    const onCreateCharge = async () => {
        setIsCreatingCharge(true);
        try {
            const numericValue = parseFloat(chargeValue.replace(',', '.'));
            if (isNaN(numericValue) || !chargeDescription || !chargeDueDate) {
                showAlert("Preencha todos os campos corretamente.", "error");
                return;
            }

            const chargeData = {
                description: chargeDescription,
                amount: Math.round(numericValue * 100),
                dueDate: chargeDueDate,
                billingType: chargeBillingType,
                discount: (chargeHasDiscount && chargeDiscountValue) ? {
                    value: parseFloat(chargeDiscountValue.replace(',', '.')),
                    type: chargeDiscountType,
                    dueDateLimitDays: 0
                } : undefined
            };

            const success = await handleCreateManualCharge(registration, chargeData, plans);
            if (success) {
                setChargeDescription('');
                setChargeValue('');
                setChargeDueDate('');
                setShowManualCharge(false);
                fetchHistory(registration);
            }
        } finally {
            setIsCreatingCharge(false);
        }
    };

    const handleRefaturar = () => {
        const planId = registration.planId;
        if (!planId) {
            showAlert('Aluno sem plan definido para refaturar.', 'error');
            return;
        }
        const plan = plans.find(p => p.id === planId);
        if (!plan) {
            showAlert('Plano atual não encontrado.', 'error');
            return;
        }

        setPricingMode('standard');
        setCustomMonthlyValue('');
        setPricingAction({ type: 'refaturar', plan, modality: registration.modalidade });
    };

    const formatMoneyFromCents = (value = 0) => {
        return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const buildPricingChoice = (): CarnetPricingChoice | null => {
        if (pricingMode !== 'custom') return { mode: pricingMode };

        const parsed = parseFloat(customMonthlyValue.replace(',', '.'));
        if (isNaN(parsed) || parsed <= 0) {
            showAlert('Informe um valor especifico valido.', 'error');
            return null;
        }

        return { mode: 'custom', customMonthlyValue: Math.round(parsed * 100) };
    };

    const handleConfirmPricingAction = async () => {
        if (!pricingAction) return;

        const pricingChoice = buildPricingChoice();
        if (!pricingChoice) return;

        const action = pricingAction;
        setPricingAction(null);

        if (action.type === 'refaturar') {
            await generateBatchCarnet(registration, action.plan, action.modality, pricingChoice);
            return;
        }

        await handleMigrateStudent(registration, action.modality, action.planId, plans, () => {
            setShowMigration(false);
        }, pricingChoice);
    };

    // Filter Logic: We no longer filter by tab here so both Manual and Plan faturas appear 
    // in the lists below, ensuring visibility of duplicates across categories.
    const currentHistory = paymentHistory;

    const allPending = currentHistory
        .filter((p: any) => !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status))
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const paid = currentHistory
        .filter((p: any) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status))
        .sort((a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

    // "Em aberto" = cobranças do mês atual ou atrasadas (meses anteriores)
    // "Próximas Faturas" = cobranças de meses futuros
    const parseLocalDate = (value?: string) => {
        if (!value) return null;
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    };
    const now = new Date();
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const isCurrentOrOverdue = (payment: any) => {
        const dueDate = parseLocalDate(payment.dueDate);
        return !!dueDate && dueDate <= endOfCurrentMonth;
    };

    const pending = allPending.filter(isCurrentOrOverdue);
    const future = allPending.filter((p: any) => !isCurrentOrOverdue(p));

    const renderPayment = (p: any, isCurrent: boolean) => (
        <PaymentCard
            key={p.id}
            payment={p}
            isAdmin={true}
            isCurrentPayment={isCurrent}
            showPaymentMethods={true}
            responsibleName={registration.responsavel?.nome || ''}
            responsiblePhone={registration.responsavel?.telefonePrincipal || ''}
            onDelete={!readOnly ? (id) => handleDeletePayment(id, registration) : undefined}
            onUpdateDueDate={!readOnly ? (id, _) => setEditingDueDateId(id) : undefined}
            onRestoreDiscount={!readOnly ? (id) => handleRestoreDiscount(id, registration) : undefined}
            onEdit={!readOnly ? (payment) => setEditingPayment(payment) : undefined}
            onReceiveInCash={!readOnly ? () => setCashPayment(p) : undefined}
        />
    );

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', justifyContent: 'flex-end'
        }}>
            <div
                onClick={onClose}
                role="button"
                tabIndex={0}
                aria-label="Fechar drawer"
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
            />
            <div style={{
                width: '100%', maxWidth: '800px',
                background: '#fff', height: '100%',
                position: 'relative', display: 'flex', flexDirection: 'column', boxShadow: '-5px 0 25px rgba(0,0,0,0.1)'
            }} className="animate-slide-left">

                {/* Header */}
                <div style={{ padding: '25px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: '#111' }}>
                            {registration.alunos[0]?.nome}
                        </h2>
                        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                            {registration.responsavel?.nome} • {registration.modalidade?.toUpperCase()}
                        </div>
                        <div style={{ marginTop: '12px' }}>
                            <span style={{
                                background: '#00a63a',
                                color: '#fff',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                fontWeight: '800',
                                textTransform: 'uppercase',
                                display: 'inline-block',
                                letterSpacing: '0.5px',
                                boxShadow: '0 4px 10px rgba(0, 125, 47, 0.2)'
                            }}>
                                {plans.find(p => p.id === registration.planId)?.nome || 'SEM PLANO DEFINIDO'}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', borderRadius: '50%', padding: '5px', cursor: 'pointer', height: 'fit-content' }}>
                        <X size={24} color="#666" />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '25px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

                        {/* SECTION 1: MIGRATION */}
                        {!readOnly && (
                            <div style={{ border: '1px solid #ddd', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
                                <div
                                    onClick={() => setShowMigration(!showMigration)}
                                    style={{
                                        padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        cursor: 'pointer', borderBottom: showMigration ? '1px solid #eee' : 'none'
                                    }}
                                >
                                    <h3 style={{ fontSize: '0.85rem', color: '#00a63a', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Migração de Plano / Modalidade
                                    </h3>
                                    {showMigration ? <ChevronUp size={20} color="#999" /> : <ChevronDown size={20} color="#999" />}
                                </div>
                                {showMigration && (
                                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px' }}>NOVA MODALIDADE</label>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                {Array.from(new Set(plans.map(p => p.modalidade))).sort().filter(Boolean).map(mod => (
                                                    <button
                                                        key={mod}
                                                        onClick={() => {
                                                            setMigrationModality(mod);
                                                            if (mod !== registration.modalidade) {
                                                                setMigrationPlanId('');
                                                            }
                                                        }}
                                                        style={{
                                                            padding: '8px 12px', borderRadius: '8px', border: '1px solid',
                                                            borderColor: migrationModality === mod ? '#00a63a' : '#ddd',
                                                            background: migrationModality === mod ? '#fff0f0' : '#fff',
                                                            color: migrationModality === mod ? '#00a63a' : '#666',
                                                            fontWeight: '800', cursor: 'pointer',
                                                            fontSize: '0.75rem', textTransform: 'uppercase',
                                                            minWidth: '80px'
                                                        }}
                                                    >
                                                        {mod}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px' }}>NOVO PLANO</label>
                                            <select
                                                value={migrationPlanId}
                                                onChange={(e) => setMigrationPlanId(e.target.value)}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                            >
                                                <option value="">Selecione...</option>
                                                {plans.filter(p => p.modalidade === migrationModality).map(plan => (
                                                    <option key={plan.id} value={plan.id}>{plan.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={onMigrate}
                                            style={{
                                                padding: '12px', background: '#00a63a', color: '#fff', border: 'none',
                                                borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center', gap: '8px'
                                            }}
                                        >
                                            Confirmar Migração
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECTION 2: MANUAL CHARGE */}
                        {!readOnly && (
                            <div style={{ border: '1px solid #ddd', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
                                <div
                                    onClick={() => setShowManualCharge(!showManualCharge)}
                                    style={{
                                        padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        cursor: 'pointer', borderBottom: showManualCharge ? '1px solid #eee' : 'none'
                                    }}
                                >
                                    <h3 style={{ fontSize: '0.85rem', color: '#00a63a', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Lançamento Manual de Cobrança
                                    </h3>
                                    {showManualCharge ? <ChevronUp size={20} color="#999" /> : <ChevronDown size={20} color="#999" />}
                                </div>
                                {showManualCharge && (
                                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px' }}>DESCRIÇÃO</label>
                                            <input
                                                type="text"
                                                value={chargeDescription}
                                                onChange={(e) => setChargeDescription(e.target.value)}
                                                placeholder="Ex: Taxa de Inscrição Extra"
                                                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none' }}
                                            />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px' }}>VALOR (R$)</label>
                                                <input
                                                    type="text"
                                                    value={chargeValue}
                                                    onChange={(e) => setChargeValue(e.target.value.replace(/[^\d,]/g, ''))}
                                                    style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#999', marginBottom: '6px' }}>VENCIMENTO</label>
                                                <input
                                                    type="date"
                                                    value={chargeDueDate}
                                                    onChange={(e) => setChargeDueDate(e.target.value)}
                                                    style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ padding: '15px', background: '#f9f9f9', borderRadius: '12px', border: '1px dashed #ddd' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: chargeHasDiscount ? '10px' : 0 }}>
                                                <input type="checkbox" checked={chargeHasDiscount} onChange={(e) => setChargeHasDiscount(e.target.checked)} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Aplicar Desconto Antecipado?</span>
                                            </label>
                                            {chargeHasDiscount && (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                    <select
                                                        value={chargeDiscountType}
                                                        onChange={(e) => setChargeDiscountType(e.target.value as any)}
                                                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                                    >
                                                        <option value="PERCENTAGE">Porcentagem (%)</option>
                                                        <option value="FIXED">Valor Fixo (R$)</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        value={chargeDiscountValue}
                                                        onChange={(e) => setChargeDiscountValue(e.target.value.replace(/[^\d,]/g, ''))}
                                                        placeholder="Valor do desconto"
                                                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            {['PIX', 'BOLETO'].map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => setChargeBillingType(type)}
                                                    style={{
                                                        flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid',
                                                        borderColor: chargeBillingType === type ? '#00a63a' : '#ddd',
                                                        background: chargeBillingType === type ? '#fff0f0' : '#fff',
                                                        color: chargeBillingType === type ? '#00a63a' : '#666',
                                                        fontWeight: 'bold', fontSize: '0.75rem'
                                                    }}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={onCreateCharge}
                                            disabled={isCreatingCharge}
                                            style={{
                                                width: '100%', padding: '15px', background: '#111', color: '#fff', border: 'none',
                                                borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', gap: '10px', opacity: isCreatingCharge ? 0.7 : 1
                                            }}
                                        >
                                            <RefreshCw size={18} className={isCreatingCharge ? 'spin' : ''} />
                                            {isCreatingCharge ? 'GERANDO COBRANÇA...' : 'GERAR LANÇAMENTO NA CORA'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECTION 3: HISTORY */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h3 style={{ fontSize: '0.85rem', color: '#00a63a', fontWeight: '900', margin: 0, textTransform: 'uppercase' }}>
                                        Histórico Financeiro
                                    </h3>
                                    <button onClick={() => fetchHistory(registration, true)} disabled={loadingHistory} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                        <RefreshCw size={14} className={loadingHistory ? 'spin' : ''} color="#00a63a" />
                                    </button>
                                    {!readOnly && (
                                        <>
                                            <button
                                                onClick={() => handleDeleteAllPayments(registration)}
                                                style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: '6px', background: '#fff0f0', color: '#00a63a', border: '1px solid #fee2e2', fontWeight: '800', cursor: 'pointer' }}
                                            >
                                                APAGAR TUDO
                                            </button>
                                            <button
                                                onClick={handleRefaturar}
                                                style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: '6px', background: '#fff', color: '#00a63a', border: '1px solid #00a63a', fontWeight: '800', cursor: 'pointer' }}
                                            >
                                                REFATURAR
                                            </button>
                                        </>
                                    )}
                                </div>
                                <div style={{ display: 'flex', background: '#f0f0f0', padding: '2px', borderRadius: '8px' }}>
                                    <button onClick={() => setActiveTab('plan')} style={{ padding: '6px 12px', fontSize: '0.7rem', fontWeight: 'bold', border: 'none', borderRadius: '6px', background: activeTab === 'plan' ? '#fff' : 'transparent', color: activeTab === 'plan' ? '#00a63a' : '#666', cursor: 'pointer' }}>PLANO</button>
                                    <button onClick={() => setActiveTab('manual')} style={{ padding: '6px 12px', fontSize: '0.7rem', fontWeight: 'bold', border: 'none', borderRadius: '6px', background: activeTab === 'manual' ? '#fff' : 'transparent', color: activeTab === 'manual' ? '#00a63a' : '#666', cursor: 'pointer' }}>
                                        MANUAL ({paymentHistory.filter((p: any) => p.externalReference?.includes('MANUAL_')).length})
                                    </button>
                                </div>
                            </div>

                            {loadingHistory ? (
                                <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Carregando...</div>
                            ) : currentHistory.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '30px', color: '#888', background: '#f9f9f9', borderRadius: '8px' }}>Nenhum pagamento encontrado</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {pending.length > 0 && (
                                        <div>
                                            <div style={{ padding: '4px 0', fontSize: '0.75rem', color: '#00a63a', textTransform: 'uppercase', fontWeight: 'bold', borderBottom: '1px solid #fee2e2' }}>
                                                {pending.length > 1 ? `Cobranças em Aberto (${pending.length})` : 'Fatura Em Aberto'}
                                            </div>
                                            <div style={{ border: '1px solid #fee2e2', borderRadius: '12px', overflow: 'hidden', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                {pending.map((p, idx) => (
                                                    <div key={p.id} style={{ borderBottom: idx < pending.length - 1 ? '1px solid #fee2e2' : 'none' }}>
                                                        {renderPayment(p, idx === 0)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {future.length > 0 && (
                                        <div>
                                            <div onClick={() => setShowFuture(!showFuture)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.75rem', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                                                Próximas Faturas ({future.length})
                                                {showFuture ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </div>
                                            {showFuture && <div style={{ marginTop: '8px', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>{future.map(p => renderPayment(p, false))}</div>}
                                        </div>
                                    )}
                                    {paid.length > 0 && (
                                        <div>
                                            <div onClick={() => setShowPaid(!showPaid)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.75rem', color: '#2e7d32', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                                                Faturas Pagas ({paid.length})
                                                {showPaid ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </div>
                                            {showPaid && <div style={{ marginTop: '8px', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>{paid.map(p => renderPayment(p, false))}</div>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '20px', borderTop: '1px solid #eee', background: '#fcfcfc' }}>
                    <button onClick={onClose} style={{ width: '100%', padding: '12px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', color: '#666', fontWeight: 'bold', cursor: 'pointer' }}>Fechar</button>
                </div>
            </div>

            {/* Modals */}
            {pricingAction && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 3000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.55)', padding: '20px'
                }}>
                    <div style={{
                        width: '100%', maxWidth: '520px', background: '#fff',
                        borderRadius: '8px', boxShadow: '0 20px 45px rgba(0,0,0,0.22)',
                        overflow: 'hidden'
                    }}>
                        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <div>
                                <div style={{ color: '#00a63a', fontWeight: 900, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {pricingAction.type === 'refaturar' ? 'Refaturar aluno' : 'Migrar e gerar faturas'}
                                </div>
                                <h3 style={{ margin: '5px 0 0', fontSize: '1.05rem', color: '#111' }}>
                                    Escolha o valor das mensalidades
                                </h3>
                                <div style={{ marginTop: '4px', fontSize: '0.82rem', color: '#666' }}>
                                    {pricingAction.plan.nome}
                                </div>
                            </div>
                            <button
                                onClick={() => setPricingAction(null)}
                                style={{ width: '34px', height: '34px', border: 'none', borderRadius: '8px', background: '#f5f5f5', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {pricingAction.type === 'refaturar' && (
                                <div style={{ padding: '12px', background: '#fff8e1', border: '1px solid #ffe0a3', borderRadius: '8px', color: '#6b4b00', fontSize: '0.82rem', fontWeight: 700 }}>
                                    Confira se nao existem faturas abertas duplicadas antes de gerar novas.
                                </div>
                            )}

                            {([
                                ['early', 'Preco com desconto antecipado', pricingAction.plan.valores?.mensalidade?.ateVencimento || 0],
                                ['standard', 'Preco padrao', pricingAction.plan.valores?.mensalidade?.aposVencimento || 0],
                                ['custom', 'Valor especifico', null]
                            ] as const).map(([mode, label, value]) => (
                                <button
                                    key={mode}
                                    onClick={() => setPricingMode(mode)}
                                    style={{
                                        width: '100%', padding: '13px 14px', borderRadius: '8px',
                                        border: `1px solid ${pricingMode === mode ? '#00a63a' : '#ddd'}`,
                                        background: pricingMode === mode ? '#fff0f0' : '#fff',
                                        color: pricingMode === mode ? '#00a63a' : '#333',
                                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', gap: '12px', textAlign: 'left'
                                    }}
                                >
                                    <span style={{ fontWeight: 900, fontSize: '0.86rem' }}>{label}</span>
                                    <span style={{ fontWeight: 900, fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
                                        {value === null ? 'Informar' : formatMoneyFromCents(value)}
                                    </span>
                                </button>
                            ))}

                            {pricingMode === 'custom' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 900, color: '#777', marginBottom: '6px', textTransform: 'uppercase' }}>
                                        Valor mensal personalizado (R$)
                                    </label>
                                    <input
                                        type="text"
                                        value={customMonthlyValue}
                                        onChange={(e) => setCustomMonthlyValue(e.target.value.replace(/[^\d,]/g, ''))}
                                        placeholder="Ex: 150,00"
                                        style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', fontWeight: 800 }}
                                    />
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '16px 22px', borderTop: '1px solid #eee', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setPricingAction(null)}
                                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#666', fontWeight: 900, cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmPricingAction}
                                style={{ flex: 1.4, padding: '12px', borderRadius: '8px', border: 'none', background: '#00a63a', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
                            >
                                Gerar faturas
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <PaymentEditModal
                isOpen={!!editingPayment}
                payment={editingPayment}
                onClose={() => setEditingPayment(null)}
                onSave={async (data) => {
                    if (editingPayment) {
                        await handleUpdatePayment(editingPayment.id, data, registration, editingPayment);
                        setEditingPayment(null);
                    }
                }}
            />
            <DueDateModal
                isOpen={!!editingDueDateId}
                onClose={() => setEditingDueDateId(null)}
                // We need function that returns Promise. handleUpdateDueDate returns Promise<void>.
                // But it takes 'cb'.
                onSave={async (date) => {
                    if (!editingDueDateId) return;
                    await handleUpdateDueDate(editingDueDateId, date, registration, () => {
                        setEditingDueDateId(null);
                    });
                }}
            />
            <CashPaymentModal
                isOpen={!!cashPayment}
                payment={cashPayment}
                onClose={() => setCashPayment(null)}
                onConfirm={(value) => {
                    if (cashPayment) {
                        handleReceiveInCash(cashPayment, value, registration);
                        setCashPayment(null);
                    }
                }}
            />
        </div >
    );
}
