
import { useState, useCallback, useEffect, useRef } from 'react';
import { doc, updateDoc, collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase';
import type { StudentData } from '../../utils/financialTypes';
import type { Plan } from '../../utils/planService';
import { useDialog } from '../../context/CustomDialogContext';
import { useLoading } from '../../components/LoadingService';
import { SyncService } from '../../utils/SyncService';
import { syncStudentFinancialData } from '../../utils/financialSync';
import { validateCPF } from '../../utils/cpfUtils';
import {
    DEFAULT_PAYMENT_PROVIDER_CONFIG,
    getPaymentProviderConfig,
    withPaymentProviderPayload,
    withPaymentProviderQuery,
    type PaymentProviderConfig
} from '../../utils/paymentProviderConfig';

interface UseFinancialOperationsProps {
    workerUrl: string;
    setRegistrations: React.Dispatch<React.SetStateAction<StudentData[]>>;
}

export type CarnetPricingMode = 'early' | 'standard' | 'custom';

export interface CarnetPricingChoice {
    mode: CarnetPricingMode;
    customMonthlyValue?: number;
    /** yyyy-mm-dd: para de gerar mensalidades apos essa data (fechamento de temporada). */
    endDate?: string;
}

export const useFinancialOperations = ({ workerUrl, setRegistrations }: UseFinancialOperationsProps) => {
    const { showAlert, showConfirm } = useDialog();
    const { setLoading: setLoadingOverlay } = useLoading();

    const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const pendingSyncs = useRef<Set<string>>(new Set());

    const [isMigrating, setIsMigrating] = useState(false);
    const [isCreatingCharge, setIsCreatingCharge] = useState(false);
    const [editingPayment, setEditingPayment] = useState<any | null>(null);
    const [paymentConfig, setPaymentConfig] = useState<PaymentProviderConfig>(DEFAULT_PAYMENT_PROVIDER_CONFIG);

    useEffect(() => {
        getPaymentProviderConfig().then(setPaymentConfig);
    }, []);

    const workerPath = useCallback((path: string) => withPaymentProviderQuery(path, paymentConfig), [paymentConfig]);
    const workerPayload = useCallback((payload: Record<string, any>) => withPaymentProviderPayload(payload, paymentConfig), [paymentConfig]);

    const sortPayments = (payments: any[]) => {
        return payments.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    };

    const readPaymentResponse = async (res: Response, fallbackMessage: string) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
            throw new Error(data.error || data.message || fallbackMessage);
        }
        return data;
    };

    const deletePaymentAfterReplacement = async (oldPaymentId: string) => {
        const deleteRes = await fetch(`${workerUrl}${workerPath(`/payments/${oldPaymentId}`)}`, { method: 'DELETE' });
        const deleteData = await deleteRes.json().catch(() => ({}));
        if (!deleteRes.ok || deleteData.success === false) {
            throw new Error(deleteData.error || deleteData.message || 'Pagamento recebido, mas falhou ao remover a fatura antiga.');
        }

        await SyncService.deletePaymentFromFirestore(oldPaymentId);
    };

    const createPaidReplacementPayment = async ({
        payload,
        value,
        registrationId,
        originalPaymentId
    }: {
        payload: any;
        value: number;
        registrationId: string;
        originalPaymentId: string;
    }) => {
        const resCreate = await fetch(`${workerUrl}/create-payment`, {
            method: 'POST',
            body: JSON.stringify(workerPayload(payload)),
            headers: { 'Content-Type': 'application/json' }
        });
        const dataCreate = await readPaymentResponse(resCreate, 'Erro ao criar fatura ajustada.');

        if (!dataCreate.payment?.id) {
            throw new Error('A fatura ajustada foi criada sem ID retornado pelo Asaas.');
        }

        const newId = dataCreate.payment.id;
        await SyncService.savePaymentToFirestore(dataCreate.payment, registrationId);

        const resPay = await fetch(`${workerUrl}${workerPath(`/payments/${newId}/receive-in-cash`)}`, {
            method: 'POST',
            body: JSON.stringify(workerPayload({
                paymentDate: new Date().toISOString().split('T')[0],
                value: value,
                notify: false,
                stagePay: paymentConfig.provider === 'cora' && paymentConfig.environment === 'stage'
            })),
            headers: { 'Content-Type': 'application/json' }
        });
        const dataPay = await readPaymentResponse(resPay, 'Erro ao registrar recebimento na fatura ajustada.');

        await SyncService.savePaymentToFirestore({
            ...dataCreate.payment,
            ...(dataPay.payment || dataPay),
            id: newId,
            status: dataPay.payment?.status || dataPay.status || 'RECEIVED_IN_CASH',
            paymentDate: dataPay.payment?.paymentDate || dataPay.paymentDate || new Date().toISOString().split('T')[0],
            value
        }, registrationId);

        await deletePaymentAfterReplacement(originalPaymentId);

        return newId;
    };



    /**
     * Sincroniza UM aluno buscando dados reais (Deep Fetch).
     */
    const syncSingleRegistration = useCallback(async (reg: StudentData) => {
        if (!reg.responsavel?.cpf) return;

        try {
            if (pendingSyncs.current.has(reg.id)) {
                return;
            }
            pendingSyncs.current.add(reg.id);

            const statusData = await syncStudentFinancialData(
                reg.id,
                reg.responsavel.cpf,
                reg.alunos[0]?.nome || '',
                reg.modalidade || '',
                workerUrl,
                paymentConfig
            );

            if (statusData) {
                // 1. Update registrations list (for stats and main table)
                setRegistrations(prev => prev.map(item => {
                    if (item.id === reg.id) {
                        return { ...item, ...statusData };
                    }
                    return item;
                }));

                // 2. Refresh local payment history state if this registration is being viewed
                // This ensures the FinanceDrawer (Manage) view updates immediately after sync
                const refreshedCache = await SyncService.getCachedPayments(reg.id);
                if (refreshedCache) {
                    setPaymentHistory(sortPayments(refreshedCache));
                }

                return statusData;
            }

        } catch (error: any) {
            console.error('Deep sync failed:', error);
        } finally {
            pendingSyncs.current.delete(reg.id);
        }
    }, [workerUrl, setRegistrations, paymentConfig]);

    /**
     * Busca histórico E faz sync (Wrapper)
     */
    const fetchHistory = useCallback(async (selectedRegistration: StudentData | null, forceRefresh = false) => {
        if (!selectedRegistration || !selectedRegistration.responsavel?.cpf) {
            setPaymentHistory([]);
            return;
        }
        setLoadingHistory(true);
        try {
            // Se forceRefresh, faz Deep Sync primeiro
            if (forceRefresh) {
                await syncSingleRegistration(selectedRegistration);
            }

            // Lê do Cache (que acabou de ser atualizado se forceRefresh)
            let cached = await SyncService.getCachedPayments(selectedRegistration.id);

            // Se cache vazio e não for forceRefresh, tenta buscar agora (Auto-Deep Sync on first load)
            if ((!cached || cached.length === 0) && !forceRefresh) {
                await syncSingleRegistration(selectedRegistration);
                cached = await SyncService.getCachedPayments(selectedRegistration.id);
            }

            if (cached) {
                setPaymentHistory(sortPayments(cached));
            } else {
                setPaymentHistory([]);
            }

        } catch (error: any) {
            console.error(error);
            showAlert('Erro ao carregar histórico.', 'error');
        } finally {
            setLoadingHistory(false);
        }
    }, [syncSingleRegistration, showAlert]);

    /**
     * Sincronização Massiva (User Request)
     * Percorre a lista de alunos e atualiza o Status Financeiro.
     * EXTREMAMENTE IMPORTANTE: Executa SEQUENCIALMENTE com delay para evitar Bloqueio do Asaas.
     */
    const handleGlobalSync = async () => {
        const confirmMsg = `Deseja sincronizar TODOS os alunos do banco de dados?\n\nISSO PODE DEMORAR BASTANTE.\nProcessaremos 1 aluno a cada 2.5 segundos.`;
        if (!window.confirm(confirmMsg)) return;

        setIsSyncing(true);
        setLoadingOverlay(true, `Carregando lista completa de alunos...`);

        try {
            // Fetch ALL registrations to ensure we process everyone, not just what's visible on screen (Pagination)
            const q = query(collection(db, 'rumo_ao_esporte_2026_registrations'));
            const snap = await getDocs(q);
            const allRegistrations = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentData));

            const targets = allRegistrations.filter(r => r.responsavel?.cpf && r.contractStatus !== 'desativado');

            if (targets.length === 0) {
                showAlert("Nenhum aluno com CPF encontrado.", "warning");
                return;
            }

            setLoadingOverlay(true, `Iniciando...`);

            let processed = 0;
            let errors = 0;
            const total = targets.length;
            const delayMs = 1000; // REDUCED from 2.5s to 1s

            for (let i = 0; i < targets.length; i++) {
                const reg = targets[i];

                try {
                    const result: any = await syncSingleRegistration(reg);
                    processed++;

                    // Mostra feedback se encontrou algo relevante
                    if (result && (result.totalPayments > 0 || result.duplicatesRemoved > 0)) {
                        setLoadingOverlay(true, `Sincronizando ${i + 1}/${total}\n(${reg.alunos[0]?.nome})\n[Pagamentos: ${result.totalPayments} | Duplicados: ${result.duplicatesRemoved}]`);
                    } else {
                        setLoadingOverlay(true, `Sincronizando ${i + 1}/${total}\n(${reg.alunos[0]?.nome})`);
                    }

                } catch (err: any) {
                    console.error("Erro no sync unitário:", err);
                    errors++;
                    if (err.message && err.message.includes("Rate Limit")) {
                        showAlert("Sincronização pausada/cancelada pelo Asaas (Rate Limit). Tente novamente em alguns minutos.", "warning");
                        break;
                    }
                }

                if (i < targets.length - 1) {
                    await new Promise(r => setTimeout(r, delayMs));
                }
            }
            if (processed > 0) showAlert(`Sincronização finalizada.\nProcessados: ${processed}\nErros: ${errors}`, "success");
        } catch (err) {
            console.error(err);
            showAlert("Erro fatal na sincronização.", "error");
        } finally {
            setIsSyncing(false);
            setLoadingOverlay(false);
        }
    };

    /**
     * Sincronização Inteligente (Smart Sync)
     * Foca apenas em alunos "pendentes" ou "atrasados" para verificar pagamentos recentes.
     */
    const handleSmartSync = async () => {
        setIsSyncing(true);
        setLoadingOverlay(true, `Buscando alunos com parcelas em aberto...`);

        try {
            const q = query(collection(db, 'rumo_ao_esporte_2026_registrations'));
            const snap = await getDocs(q);
            const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentData));

            // Filtra quem realment precisa de verificação (atrasado ou pendente)
            const targets = all.filter(r =>
                r.responsavel?.cpf &&
                r.contractStatus !== 'desativado' &&
                (['atrasado', 'pendente', 'overdue'].includes(r.status || ''))
            );

            if (targets.length === 0) {
                showAlert("Nenhum aluno com pendência financeira encontrado para verificar.", "info");
                return;
            }

            const total = targets.length;
            const delayMs = 1000;
            let processed = 0;

            for (let i = 0; i < targets.length; i++) {
                const reg = targets[i];
                try {
                    const result: any = await syncSingleRegistration(reg);
                    processed++;

                    if (result && (result.totalPayments > 0 || result.duplicatesRemoved > 0)) {
                        setLoadingOverlay(true, `Verificando Recebimentos: ${i + 1}/${total}\n(${reg.alunos[0]?.nome})\n[Ativos: ${result.totalPayments} | Duplicados: ${result.duplicatesRemoved}]`);
                    } else {
                        setLoadingOverlay(true, `Verificando Recebimentos: ${i + 1}/${total}\n(${reg.alunos[0]?.nome})`);
                    }
                } catch (err) {
                    console.error("Erro no smart sync:", err);
                }

                if (i < targets.length - 1) {
                    await new Promise(r => setTimeout(r, delayMs));
                }
            }

            showAlert(`Verificação concluída! ${processed} registros atualizados.`, "success");
        } catch (err) {
            console.error(err);
            showAlert("Erro na verificação de pagamentos.", "error");
        } finally {
            setIsSyncing(false);
            setLoadingOverlay(false);
        }
    };

    // --- Actions ---

    const handleDeletePayment = async (id: string, selectedRegistration: StudentData | null) => {
        if (!window.confirm('Tem certeza que deseja apagar esta cobrança?')) return;
        try {
            const res = await fetch(`${workerUrl}${workerPath(`/payments/${id}`)}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                await SyncService.deletePaymentFromFirestore(id);
                showAlert('Cobrança apagada.', 'success');
                fetchHistory(selectedRegistration, true);
            } else throw new Error(data.error);
        } catch (e: any) { showAlert(e.message, 'error'); }
    };

    const handleDeleteAllPayments = async (selectedRegistration: StudentData | null) => {
        const pending = paymentHistory.filter(p => !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'].includes(p.status));
        if (pending.length === 0) return showAlert('Nada pendente.', 'info');
        if (!window.confirm(`Apagar ${pending.length} cobranças?`)) return;

        setIsDeletingAll(true);
        setLoadingOverlay(true, 'Apagando cobranças...');
        try {
            let count = 0;
            for (const p of pending) {
                try {
                    await fetch(`${workerUrl}${workerPath(`/payments/${p.id}`)}`, { method: 'DELETE' });
                    count++;
                } catch (err) {
                    console.error(`Erro ao apagar fatura ${p.id}:`, err);
                }
            }

            // Wipe Firestore Cache for this student
            if (selectedRegistration) {
                await SyncService.clearStudentPayments(selectedRegistration.id);

                // Immediately update master registration status to 'vazio' to avoid sync lag
                const regRef = doc(db, 'rumo_ao_esporte_2026_registrations', selectedRegistration.id);
                await updateDoc(regRef, {
                    status: 'vazio',
                    financialPendingAmount: 0,
                    financialPendingDescription: 'Sem cobrança cadastrada',
                    financialInvoiceUrl: ''
                });

                // Update local list state
                setRegistrations(prev => prev.map(item => {
                    if (item.id === selectedRegistration.id) {
                        return {
                            ...item,
                            status: 'vazio',
                            financialPendingAmount: 0,
                            financialPendingDescription: 'Sem cobrança cadastrada',
                            financialInvoiceUrl: ''
                        };
                    }
                    return item;
                }));
            }

            showAlert(`${count} apagadas.`, 'success');
            fetchHistory(selectedRegistration, false); // false = don't sync immediately from Asaas
        } catch (e: any) {
            console.error(e);
            showAlert('Erro ao apagar todas as faturas.', 'error');
        } finally {
            setIsDeletingAll(false);
            setLoadingOverlay(false);
        }
    };

    const handleUpdateDueDate = async (id: string, date: string, reg: StudentData | null, cb: () => void) => {
        try {
            const res = await fetch(`${workerUrl}${workerPath(`/payments/${id}`)}`, { method: 'PUT', body: JSON.stringify(workerPayload({ dueDate: date })), headers: { 'Content-Type': 'application/json' } });
            if (res.ok) {
                showAlert('Vencimento atualizado.', 'success');
                cb();
                fetchHistory(reg, true);
            } else throw new Error('Falha ao atualizar');
        } catch (e) { showAlert('Erro', 'error'); }
    };

    const handleUpdatePayment = async (id: string, form: any, reg: StudentData | null, originalPayment?: any) => {
        setLoadingOverlay(true, 'Atualizando...');
        try {
            const rawValue = String(form.value).replace(',', '.');
            const val = parseFloat(rawValue);

            if (isNaN(val)) throw new Error('Valor inválido.');

            // Check if this is a PAID payment (needs swap)
            const isPaid = originalPayment && ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'].includes(originalPayment.status);

            if (isPaid) {
                if (!window.confirm("Esta fatura já consta como PAGA. Alterar o valor irá excluir o registro atual e criar um novo com o valor corrigido. Deseja continuar?")) {
                    return;
                }

                console.log("[DEBUG] Editing paid payment. Swapping...");

                const payloadCreate: any = {
                    customer: originalPayment.customer,
                    amount: Math.round(val * 100),
                    description: form.description,
                    dueDate: form.dueDate || new Date().toISOString().split('T')[0],
                    externalReference: originalPayment.externalReference || `EDITED_${Date.now()}`
                };

                await createPaidReplacementPayment({
                    payload: payloadCreate,
                    value: val,
                    registrationId: reg!.id,
                    originalPaymentId: id
                });

                showAlert('Pagamento corrigido e registrado com sucesso!', 'success');
                setEditingPayment(null);
                fetchHistory(reg, true);

                return;
            }

            // Normal update for pending payments
            const payload: any = {
                description: form.description,
                value: val,
                dueDate: form.dueDate
            };

            if (form.hasDiscount && form.discountValue) {
                const discVal = parseFloat(String(form.discountValue).replace(',', '.'));
                if (!isNaN(discVal)) {
                    payload.discount = { value: discVal, type: form.discountType };
                }
            } else {
                payload.discount = { value: 0 };
            }

            const res = await fetch(`${workerUrl}${workerPath(`/payments/${id}`)}`, {
                method: 'PUT',
                body: JSON.stringify(workerPayload(payload)),
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await res.json();

            if (res.ok && result.success) {
                showAlert('Fatura atualizada com sucesso!', 'success');
                setEditingPayment(null);
                fetchHistory(reg, true);
            } else {
                const errorMsg = result.error || result.message || 'Falha ao atualizar fatura.';
                throw new Error(errorMsg);
            }
        } catch (e: any) {
            console.error('Error updating payment:', e);
            showAlert(e.message || 'Erro ao atualizar fatura', 'error');
        }
        finally { setLoadingOverlay(false); }
    };

    const handleRestoreDiscount = async (id: string, reg: StudentData | null) => {
        if (!window.confirm('Restaurar desconto?')) return;
        const d = new Date(); d.setDate(d.getDate() + 2);
        try {
            const res = await fetch(`${workerUrl}${workerPath(`/payments/${id}`)}`, { method: 'PUT', body: JSON.stringify(workerPayload({ dueDate: d.toISOString().split('T')[0], fine: { value: 0 }, interest: { value: 0 } })), headers: { 'Content-Type': 'application/json' } });
            if (res.ok) {
                showAlert('Restaurado.', 'success');
                fetchHistory(reg, true);
            } else throw new Error('Falha');
        } catch (e) { showAlert('Erro', 'error'); }
    };

    const resolveCarnetMonthlyValue = (plan: Plan, pricingChoice?: CarnetPricingChoice) => {
        const standardValue = plan.valores?.mensalidade?.aposVencimento || 0;
        const earlyValue = plan.valores?.mensalidade?.ateVencimento || standardValue;

        if (pricingChoice?.mode === 'early') return earlyValue;
        if (pricingChoice?.mode === 'custom') return pricingChoice.customMonthlyValue || standardValue;
        return standardValue;
    };

    const generateBatchCarnet = async (reg: StudentData, plan: Plan, mod: string, pricingChoice?: CarnetPricingChoice) => {
        // CPF Validation
        const cpf = reg.responsavel?.cpf || '';
        if (!validateCPF(cpf)) {
            showAlert(`CPF Inválido: ${cpf}. Corrija o CPF do responsável antes de gerar o carnê.`, 'error');
            return;
        }

        setLoadingOverlay(true, 'Gerando...');
        try {
            const mensalidadeValue = resolveCarnetMonthlyValue(plan, pricingChoice);
            const payload = {
                registrationId: reg.id,
                responsibleName: reg.responsavel?.nome,
                responsibleCpf: reg.responsavel?.cpf,
                responsibleEmail: reg.responsavel?.email || '',
                responsiblePhone: reg.responsavel?.telefonePrincipal || '',
                childName: reg.alunos?.[0]?.nome || '',
                modalidade: mod,
                matriculaValue: plan.valores?.matricula || 0,
                mensalidadeValue,
                descontoAntecipado: 0,
                paymentDay: reg.paymentDay || plan.paymentDay || 10,
                jurosMensais: plan.jurosMensais || 0,
                multa: plan.multa || 0,
                installmentEndDate: pricingChoice?.endDate
            };
            console.log("[DEBUG] generateBatchCarnet: Payload:", payload);
            const res = await fetch(`${workerUrl}/generate-carnet`, { method: 'POST', body: JSON.stringify(workerPayload(payload)), headers: { 'Content-Type': 'application/json' } });
            console.log("[DEBUG] generateBatchCarnet: Status:", res.status);
            const data = await res.json();
            console.log("[DEBUG] generateBatchCarnet: Result Data:", data);
            if (data.success && data.payments) {
                await SyncService.saveBatchPaymentsToFirestore(data.payments, reg.id);
                showAlert('Gerado!', 'success');
                syncSingleRegistration(reg);
                fetchHistory(reg, true);
            } else {
                // Tenta extrair erro amigável se for JSON do Asaas
                let msg = data.error || 'Erro desconhecido';
                if (msg.includes('errors')) {
                    try {
                        const inner = JSON.parse(msg.split('Asaas: ')[1] || msg);
                        if (inner.errors && inner.errors[0]) msg = inner.errors[0].description;
                    } catch (e) { /* ignore */ }
                }
                throw new Error(msg);
            }
        } catch (e: any) {
            console.error("[DEBUG] generateBatchCarnet Error:", e);
            showAlert(e.message, 'error');
        }
        finally { setLoadingOverlay(false); }
    };

    const handleMigrateStudent = async (reg: StudentData | null, mod: string, pid: string, plans: Plan[], cb: () => void, pricingChoice?: CarnetPricingChoice) => {
        if (!reg) return;
        setIsMigrating(true);
        try {
            const plan = plans.find(p => p.id === pid);
            await updateDoc(doc(db, 'rumo_ao_esporte_2026_registrations', reg.id), { modalidade: mod, planId: pid });
            showAlert('Migrado.', 'success');
            if (plan && pricingChoice) {
                await generateBatchCarnet({ ...reg, modalidade: mod, planId: pid }, plan, mod, pricingChoice);
            } else {
                showConfirm('Gerar novo carnê agora?', () => { if (plan) generateBatchCarnet({ ...reg, modalidade: mod, planId: pid }, plan, mod); }, 'info', 'Gerar?');
            }
            cb();
        } catch (e: any) { showAlert(e.message, 'error'); }
        finally { setIsMigrating(false); }
    };

    const handleCreateManualCharge = async (reg: StudentData | null, data: any, _plans: Plan[]): Promise<boolean> => {
        if (!reg) return false;
        setIsCreatingCharge(true);
        try {
            const cpf = reg.responsavel?.cpf?.replace(/\D/g, '');
            // Tenta buscar ID existente para evitar duplicidade, mas NÃO bloqueia se não achar.
            let customerId = null;
            try {
                const custRes = await fetch(`${workerUrl}${workerPath(`/customers-by-cpf/${cpf}`)}`);
                const custData = await custRes.json();
                if (custData.customer) {
                    customerId = custData.customer.id;
                }
            } catch (ignore) {
                // Se der erro na busca, prosseguimos sem ID (o worker criará)
                console.warn("Cliente não encontrado ou erro na busca, tentará criar.");
            }

            const payload: any = {
                // Se tiver ID, envia. Se não, envia dados para criar.
                customer: customerId,
                responsibleName: reg.responsavel?.nome,
                responsibleCpf: reg.responsavel?.cpf,
                responsibleEmail: reg.responsavel?.email,
                responsiblePhone: reg.responsavel?.telefonePrincipal,

                amount: data.amount,
                description: data.description,
                dueDate: data.dueDate,
                billingType: data.billingType || 'PIX',
                externalReference: `MANUAL_${Date.now()}`
            };
            if (data.discount) payload.discount = data.discount;

            const res = await fetch(`${workerUrl}/create-payment`, { method: 'POST', body: JSON.stringify(workerPayload(payload)), headers: { 'Content-Type': 'application/json' } });
            const pRes = await res.json();
            if (pRes.success && pRes.payment) {
                await SyncService.savePaymentToFirestore(pRes.payment, reg.id);
                showAlert('Criado!', 'success');
                syncSingleRegistration(reg);
                fetchHistory(reg, true);
                return true;
            } else throw new Error(pRes.error);
        } catch (e: any) { showAlert(e.message, 'error'); return false; }
        finally { setIsCreatingCharge(false); }
    };

    const handleReceiveInCash = async (paymentObj: any, value: number, reg: StudentData | null) => {
        const id = paymentObj.id;
        if (!window.confirm(`Confirmar recebimento em DINHEIRO no valor de R$ ${value.toFixed(2)}?`)) return;
        setLoadingOverlay(true, 'Registrando Recebimento...');
        try {
            // New Logic: Check if overdue AND value is different
            const dueDate = new Date(paymentObj.dueDate + 'T12:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isOverdue = dueDate < today;
            const isDifferentValue = Math.round(value * 100) !== Math.round(paymentObj.value * 100);

            if (isOverdue && isDifferentValue) {
                console.log("[DEBUG] Overdue payment with different value detected. Swapping invoices...");

                const payloadCreate: any = {
                    customer: paymentObj.customer,
                    amount: Math.round(value * 100),
                    description: paymentObj.description || 'Mensalidade (Atrasada/Ajustada)',
                    dueDate: new Date().toISOString().split('T')[0],
                    externalReference: `ADJUSTED_${Date.now()}`
                };

                await createPaidReplacementPayment({
                    payload: payloadCreate,
                    value,
                    registrationId: reg!.id,
                    originalPaymentId: id
                });

                showAlert('Pagamento ajustado e recebido com sucesso!', 'success');
            } else {
                // Standard Logic
                const payload = {
                    paymentDate: new Date().toISOString().split('T')[0],
                    value: value,
                    notify: false
                };

                const res = await fetch(`${workerUrl}${workerPath(`/payments/${id}/receive-in-cash`)}`, {
                    method: 'POST',
                    body: JSON.stringify(workerPayload({
                        ...payload,
                        stagePay: paymentConfig.provider === 'cora' && paymentConfig.environment === 'stage'
                    })),
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await res.json();

                if (data.success) {
                    showAlert('Pagamento recebido com sucesso!', 'success');
                } else {
                    throw new Error(data.error || 'Erro ao registrar recebimento.');
                }
            }

            // Force sync to update status across system
            await syncSingleRegistration(reg!);
            fetchHistory(reg, true);
        } catch (error: any) {
            console.error('Error receiving in cash:', error);
            showAlert(error.message || 'Erro ao receber pagamento.', 'error');
        } finally {
            setLoadingOverlay(false);
        }
    };

    return {
        paymentHistory,
        loadingHistory,
        isSyncing,
        isDeletingAll,

        editingPayment,
        setEditingPayment,
        setPaymentHistory,
        fetchHistory,
        syncSingleRegistration,
        handleDeletePayment,
        handleDeleteAllPayments,
        handleUpdateDueDate,
        handleUpdatePayment,
        handleRestoreDiscount,
        generateBatchCarnet,
        handleMigrateStudent,
        handleCreateManualCharge,
        handleReceiveInCash,
        handleSmartSync,
        handleGlobalSync,
        isMigrating,
        isCreatingCharge,
        paymentConfig
    };
};
