
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SyncService } from './SyncService';
import {
    DEFAULT_PAYMENT_PROVIDER_CONFIG,
    withPaymentProviderQuery,
    type PaymentProviderConfig
} from './paymentProviderConfig';

/**
 * Calcula o status financeiro do aluno baseado na lista de pagamentos.
 * Replica a lógica "Deep Sync" localmente.
 */
export const calculateStatusFromPayments = (payments: any[]) => {
    const activePayments = payments.filter(p => !['DELETED', 'REFUNDED', 'REMOVED_BY_RECEIVER'].includes(p.status));
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Get the end of the current month
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const overdue = activePayments.filter(p => {
        const isUnpaid = !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'].includes(p.status);
        const descLower = (p.description || '').toLowerCase();
        const isManual = p.externalReference?.startsWith('MANUAL_') || descLower.includes('uniforme') || descLower.includes('kit');
        const due = new Date(p.dueDate + 'T00:00:00');
        return isUnpaid && due < now && !isManual;
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()); // Ascending (oldest first)

    const pending = activePayments.filter(p => {
        const isUnpaid = !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'].includes(p.status);
        const descLower = (p.description || '').toLowerCase();
        const isManual = p.externalReference?.startsWith('MANUAL_') || descLower.includes('uniforme') || descLower.includes('kit');
        const due = new Date(p.dueDate + 'T00:00:00');
        return isUnpaid && due >= now && !isManual;
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()); // Ascending (earliest first)

    let newStatus = 'vazio';

    if (activePayments.length > 0) {
        // "Pendente" only if there's an unpaid charge due in the current month
        const hasUnpaidCurrentMonth = pending.some(p => new Date(p.dueDate + 'T00:00:00') <= endOfMonth);

        if (overdue.length > 0) newStatus = 'atrasado';
        else if (hasUnpaidCurrentMonth) newStatus = 'pendente';
        else newStatus = 'pago';
    }

    // Calculate Pending Amount & Description
    let pendingAmount = 0;
    let descriptionStr = 'EM DIA';
    let invoiceUrl = '';
    let dueDate = '';

    if (newStatus === 'atrasado') {
        // Overdue logic: sum all overdue
        pendingAmount = overdue.reduce((sum, p) => sum + (p.value || 0), 0);

        // Description: List months
        const months = overdue.map(p => {
            const d = new Date(p.dueDate + 'T00:00:00');
            const monthName = d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
            return monthName;
        });
        const uniqueMonths = [...new Set(months)];
        descriptionStr = `${overdue.length > 1 ? 'MÚLTIPLOS ATRASOS' : 'ATRASADO'}: ${uniqueMonths.join(', ')}`;
        invoiceUrl = overdue[0].invoiceUrl; // Oldest Invoice Link
        dueDate = overdue[0].dueDate;
    } else if (newStatus === 'pendente') {
        // Pending logic: Sum all pending in current month
        const currentMonthPending = pending.filter(p => new Date(p.dueDate + 'T00:00:00') <= endOfMonth);

        pendingAmount = currentMonthPending.reduce((sum, p) => {
            let val = p.value || 0;
            // Check discount logic locally
            if (p.discount && (p.discount.value || 0) > 0) {
                const due = new Date(p.dueDate + 'T23:59:59');
                if (due >= new Date()) { // Still valid
                    if (p.discount.type === 'PERCENTAGE') {
                        val -= (val * p.discount.value / 100);
                    } else { // FIXED
                        val -= p.discount.value;
                    }
                }
            }
            return sum + val;
        }, 0);

        if (currentMonthPending.length > 1) {
            descriptionStr = `${currentMonthPending.length} FATURAS (${new Date(currentMonthPending[0].dueDate).toLocaleDateString('pt-BR', { month: '2-digit' })})`;
        } else {
            const next = currentMonthPending[0];
            descriptionStr = `${next.description || 'Fatura'} (${new Date(next.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`;
        }
        invoiceUrl = currentMonthPending[0].invoiceUrl;
        dueDate = currentMonthPending[0].dueDate;
    } else if (newStatus === 'vazio') {
        descriptionStr = 'Sem cobrança cadastrada';
    } else if (newStatus === 'pago') {
        descriptionStr = 'Em dia';
        pendingAmount = 0;
    }

    // Calculate TOTAL RECEIVED Amount
    const receivedPayments = activePayments.filter(p =>
        ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'].includes(p.status)
    );
    const receivedAmount = receivedPayments.reduce((sum, p) => sum + (p.value || 0), 0);

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Mês anterior
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastYear = lastMonthDate.getFullYear();
    const lastMonth = lastMonthDate.getMonth();

    const isCurrentMonth = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr + 'T00:00:00');
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    };
    const isLastMonth = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr + 'T00:00:00');
        return d.getFullYear() === lastYear && d.getMonth() === lastMonth;
    };

    // RECEIVED THIS MONTH (usando paymentDate se disponível, senão dueDate)
    const receivedThisMonth = receivedPayments
        .filter(p => isCurrentMonth(p.paymentDate || p.clientPaymentDate || p.dueDate))
        .reduce((sum, p) => sum + (p.value || 0), 0);

    // RECEIVED LAST MONTH
    const receivedLastMonth = receivedPayments
        .filter(p => isLastMonth(p.paymentDate || p.clientPaymentDate || p.dueDate))
        .reduce((sum, p) => sum + (p.value || 0), 0);

    // PENDING THIS MONTH (faturas em aberto com vencimento neste mês)
    const unpaidPayments = activePayments.filter(p => {
        const isUnpaid = !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'].includes(p.status);
        const descLower = (p.description || '').toLowerCase();
        const isManual = p.externalReference?.startsWith('MANUAL_') || descLower.includes('uniforme') || descLower.includes('kit');
        return isUnpaid && !isManual;
    });
    const pendingThisMonth = unpaidPayments
        .filter(p => isCurrentMonth(p.dueDate))
        .reduce((sum, p) => sum + (p.value || 0), 0);

    // PENDING LAST MONTH (faturas em aberto ou atrasadas com vencimento no mês anterior)
    const pendingLastMonth = unpaidPayments
        .filter(p => isLastMonth(p.dueDate))
        .reduce((sum, p) => sum + (p.value || 0), 0);

    // VALOR DO ÚLTIMO PAGAMENTO RECEBIDO
    const lastPayment = receivedPayments.sort((a, b) => {
        const dateA = new Date(a.paymentDate || a.clientPaymentDate || a.dueDate).getTime();
        const dateB = new Date(b.paymentDate || b.clientPaymentDate || b.dueDate).getTime();
        return dateB - dateA; // Descendente (mais recente primeiro)
    })[0];

    const financialLastPaymentValue = lastPayment ? (lastPayment.value || 0) : 0;

    return {
        status: newStatus,
        financialPendingAmount: pendingAmount,
        financialPendingDescription: descriptionStr,
        financialInvoiceUrl: invoiceUrl,
        financialDueDate: dueDate,
        financialReceivedAmount: receivedAmount,
        financialReceivedThisMonth: receivedThisMonth,
        financialReceivedLastMonth: receivedLastMonth,
        financialPendingThisMonth: pendingThisMonth,
        financialPendingLastMonth: pendingLastMonth,
        financialLastPaymentValue: financialLastPaymentValue
    };
};

/**
 * Sincroniza um aluno buscando dados reais (Deep Fetch) e atualiza Firestore.
 * Pode ser chamado do Admin ou do Portal do Aluno.
 */
export const syncStudentFinancialData = async (
    registrationId: string,
    cpf: string,
    studentFullName: string,
    modality: string,
    workerUrl: string,
    paymentConfig: PaymentProviderConfig = DEFAULT_PAYMENT_PROVIDER_CONFIG
) => {
    if (!cpf) return null;

    try {
        const cleanCpf = cpf.replace(/\D/g, '');

        // 1. Get Customer ID
        const custRes = await fetch(`${workerUrl}${withPaymentProviderQuery(`/customers-by-cpf/${cleanCpf}`, paymentConfig)}`);
        if (!custRes.ok) throw new Error(`Busca de cliente falhou: ${custRes.status}`);
        const custData = await custRes.json();

        let allPayments: any[] = [];
        const customers = [];
        if (custData.customers && Array.isArray(custData.customers)) customers.push(...custData.customers);
        else if (custData.customer) customers.push(custData.customer);

        if (customers.length > 0) {
            for (const customer of customers) {
                if (!customer?.id) continue;
                const payRes = await fetch(`${workerUrl}${withPaymentProviderQuery(`/payments?customer=${encodeURIComponent(customer.id)}&limit=100`, paymentConfig)}`);
                if (payRes.ok) {
                    const payData = await payRes.json();
                    if (payData && payData.data) {
                        allPayments.push(...payData.data);
                    }
                }
            }
        }

        // 2. Filter by Student Name & Modality
        const seen = new Set();
        const filteredPayments = [];
        const normalizedStudentName = studentFullName.toUpperCase().trim();
        const studentFirstName = normalizedStudentName.split(' ')[0];
        const normalizedModality = (modality || '').toUpperCase().trim();

        for (const p of allPayments) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                const desc = (p.description || '').toUpperCase();

                const nameMatch = desc.includes(normalizedStudentName) || (studentFirstName.length > 2 && desc.includes(studentFirstName));
                const modalityMatch = !normalizedModality || desc.includes(`(${normalizedModality})`) || desc.includes(normalizedModality);
                const isManual = p.externalReference?.includes('MANUAL_');

                if ((nameMatch && modalityMatch) || isManual) {
                    filteredPayments.push(p);
                } else if (!desc && p.externalReference?.includes(registrationId)) {
                    // Se não tiver descrição, tenta casar por externalReference (ID do aluno no nosso sistema)
                    filteredPayments.push(p);
                }
            }
        }

        // --- DEDUPLICATION LOGIC ---
        // Identifica faturas com mesmo vencimento e valor para remover duplicatas não pagas
        const groups: Record<string, any[]> = {};
        filteredPayments.forEach(p => {
            const key = `${p.dueDate}_${Math.round((p.value || 0) * 100)}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });

        const finalPayments = [];
        const toDeleteIds = [];

        for (const key in groups) {
            const group = groups[key];
            if (group.length > 1) {
                console.log(`[Deduplicate] Encontradas ${group.length} faturas para ${key}`);

                // 1. Encontrar as faturas pagas (prioridade máxima)
                const paid = group.filter(p => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'].includes(p.status));

                let survivor: any;
                let redundant: any[];

                if (paid.length > 0) {
                    // Mantemos a primeira paga e marcamos TODO o resto do grupo para exclusão (inclusive outras pagas se houver erro drástico, mas foco em tirar as duplicatas não pagas)
                    survivor = paid[0];
                    redundant = group.filter(p => p.id !== survivor.id && !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'].includes(p.status));
                } else {
                    // Nenhuma paga: mantemos a primeira do grupo e marcamos as outras para exclusão
                    survivor = group[0];
                    redundant = group.slice(1);
                }

                finalPayments.push(survivor);
                toDeleteIds.push(...redundant.map(p => p.id));
            } else {
                finalPayments.push(group[0]);
            }
        }

        // Executar exclusões reais no Asaas e Firestore
        if (toDeleteIds.length > 0) {
            console.log(`[Deduplicate] Removendo ${toDeleteIds.length} faturas duplicadas...`);
            for (const pId of toDeleteIds) {
                // 1. Tenta remover do Asaas via Worker
                try {
                    await fetch(`${workerUrl}${withPaymentProviderQuery(`/payments/${pId}`, paymentConfig)}`, { method: 'DELETE' });
                } catch (err) {
                    console.error(`[Deduplicate] Erro ao remover fatura duplicada ${pId} no Asaas:`, err);
                }

                // 2. Remove do Cache local (Firestore) - SEMPRE, para não mostrar duplicata na UI
                try {
                    await SyncService.deletePaymentFromFirestore(pId);
                } catch (err) {
                    console.error(`[Deduplicate] Erro ao remover fatura duplicada ${pId} no Firestore:`, err);
                }
            }
        }

        // 3. Save to Firestore Cache (Limpamos o cache do aluno antes para evitar lixo de filtros antigos)
        await SyncService.clearStudentPayments(registrationId);
        if (finalPayments.length > 0) {
            await SyncService.saveBatchPaymentsToFirestore(finalPayments, registrationId);
        }

        // 4. Calculate Status
        const statusData = calculateStatusFromPayments(finalPayments);

        // 5. Update Registration Doc
        const regRef = doc(db, 'rumo_ao_esporte_2026_registrations', registrationId);
        await updateDoc(regRef, {
            status: statusData.status,
            financialPendingAmount: statusData.financialPendingAmount,
            financialPendingDescription: statusData.financialPendingDescription,
            financialInvoiceUrl: statusData.financialInvoiceUrl,
            financialDueDate: statusData.financialDueDate,
            financialReceivedAmount: statusData.financialReceivedAmount,
            financialReceivedThisMonth: statusData.financialReceivedThisMonth,
            financialReceivedLastMonth: statusData.financialReceivedLastMonth,
            financialPendingThisMonth: statusData.financialPendingThisMonth,
            financialPendingLastMonth: statusData.financialPendingLastMonth,
            financialLastPaymentValue: statusData.financialLastPaymentValue,
            lastDeepSync: new Date().toISOString()
        });

        return {
            ...statusData,
            duplicatesRemoved: toDeleteIds.length,
            totalPayments: finalPayments.length
        };

    } catch (error) {
        console.error(`[FinancialSync] Erro sincronizando ${registrationId}:`, error);
        throw error;
    }
};
