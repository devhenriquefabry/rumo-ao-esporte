import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SyncService } from './SyncService';
import { calculateStatusFromPayments } from './financialSync';
import { withPaymentProviderPayload, type PaymentProviderConfig } from './paymentProviderConfig';
import { validateCPF } from './cpfUtils';
import type { StudentData } from './financialTypes';
import type { Plan } from './planService';

/**
 * Geração da mensalidade de UM mês para todos os cadastros ativos de uma vez.
 *
 * Substitui o script `migracao-financeira/cobrancas-mensais.cjs` (usado em 10/08/2026),
 * para que a associação consiga abrir as cobranças do mês sozinha e com antecedência.
 *
 * Regras que a prévia aplica antes de criar qualquer coisa:
 *  - nunca duplica: quem já tem a mensalidade do mês (carnê ou lançamento manual) fica de fora;
 *  - fatura vencendo no mês mas descrita como outro mês vai para "revisar" (decisão humana);
 *  - plano com mensalidade zerada = isento, não é cobrado;
 *  - CPF inválido ou plano ausente bloqueia o cadastro (o provedor recusaria a fatura).
 */

export const MONTH_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const PAID_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'];
const INACTIVE_STATUSES = ['DELETED', 'REFUNDED', 'REMOVED_BY_RECEIVER', 'CANCELLED', 'CANCELED'];

export interface MonthlyChargeInvoice {
    id: string;
    dueDate: string;
    status: string;
    value: number;
    description: string;
    externalReference: string;
}

export interface MonthlyChargeTarget {
    registration: StudentData;
    responsibleName: string;
    studentName: string;
    modalidade: string;
    valueCents: number;
}

export interface MonthlyChargeExisting {
    registration: StudentData;
    responsibleName: string;
    studentName: string;
    invoices: MonthlyChargeInvoice[];
}

export interface MonthlyChargeSkipped {
    registration: StudentData;
    responsibleName: string;
    studentName: string;
    reason: string;
}

export interface MonthlyChargesPreview {
    dueDate: string;
    monthLabel: string;
    referenceMonth: string;
    toCreate: MonthlyChargeTarget[];
    alreadyCharged: MonthlyChargeExisting[];
    needsReview: MonthlyChargeExisting[];
    exempt: MonthlyChargeSkipped[];
    blocked: MonthlyChargeSkipped[];
    totalCents: number;
}

export interface MonthlyChargeResult {
    created: Array<{ registrationId: string; studentName: string; invoiceId: string; value: number }>;
    errors: Array<{ registrationId: string; studentName: string; error: string }>;
}

const isLegacyPayment = (p: any) =>
    p?.importedFromLegacySystem === true || String(p?.importBatch || '').startsWith('financeiro-legado-');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const monthLabelFromDueDate = (dueDate: string) => MONTH_LABELS[Number(dueDate.slice(5, 7)) - 1] || '';

/** Sufixo usado no externalReference: SET2026. Serve de trava contra duplicidade. */
export const monthReferenceSuffix = (dueDate: string) => `${monthLabelFromDueDate(dueDate)}${dueDate.slice(0, 4)}`;

export const formatDateBR = (dueDate: string) => dueDate.split('-').reverse().join('/');

/**
 * Vencimento sugerido: o próximo dia `paymentDay` ainda não vencido.
 * Em 01/09 sugere 10/09; em 15/09 já sugere 10/10 (geração antecipada do mês seguinte).
 */
export const suggestNextDueDate = (paymentDay = 10, reference = new Date()) => {
    const day = Math.min(Math.max(paymentDay, 1), 28);
    const base = new Date(reference.getFullYear(), reference.getMonth(), day);
    if (base < new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())) {
        base.setMonth(base.getMonth() + 1);
    }
    const month = String(base.getMonth() + 1).padStart(2, '0');
    return `${base.getFullYear()}-${month}-${String(base.getDate()).padStart(2, '0')}`;
};

/**
 * UUID determinístico a partir do externalReference. Como o Idempotency-Key repete,
 * reexecutar a geração não cria fatura duplicada na Cora.
 */
export const deterministicUuid = (text: string) => {
    const block = (seed: number) => {
        let h = seed >>> 0;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return h.toString(16).padStart(8, '0');
    };
    const hex = `${block(0x811c9dc5)}${block(0x1b873593)}${block(0xcc9e2d51)}${block(0x85ebca6b)}`;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

const resolvePlan = (registration: StudentData, plans: Plan[]) => {
    const byId = registration.planId ? plans.find(p => p.id === registration.planId) : null;
    if (byId) return byId;

    const modality = (registration.modalidade || '').toLowerCase();
    return plans.find(p => p.active && (p.modalidade || '').toLowerCase() === modality) || null;
};

const monthlyValueCents = (plan: Plan) => plan.valores?.mensalidade?.aposVencimento ?? plan.valor ?? 0;

const isActiveRegistration = (registration: StudentData) =>
    registration.contractStatus !== 'desativado' && registration.contractStatus !== 'cancelado';

/** Lê uma vez as faturas que vencem no mês e monta os grupos da prévia. */
export const buildMonthlyChargesPreview = async (
    dueDate: string,
    registrations: StudentData[],
    plans: Plan[]
): Promise<MonthlyChargesPreview> => {
    const referenceMonth = dueDate.slice(0, 7);
    const monthLabel = monthLabelFromDueDate(dueDate);

    const snap = await getDocs(query(
        collection(db, 'financial_payments'),
        where('dueDate', '>=', `${referenceMonth}-01`),
        where('dueDate', '<=', `${referenceMonth}-31`)
    ));

    const invoicesByRegistration = new Map<string, MonthlyChargeInvoice[]>();
    snap.docs.forEach(d => {
        const payment: any = { id: d.id, ...d.data() };
        if (isLegacyPayment(payment) || INACTIVE_STATUSES.includes(payment.status)) return;
        if (!payment.studentId) return;

        const list = invoicesByRegistration.get(payment.studentId) || [];
        list.push({
            id: payment.id,
            dueDate: payment.dueDate || '',
            status: payment.status || 'UNKNOWN',
            value: payment.value || 0,
            description: payment.description || '',
            externalReference: payment.externalReference || ''
        });
        invoicesByRegistration.set(payment.studentId, list);
    });

    const preview: MonthlyChargesPreview = {
        dueDate,
        monthLabel,
        referenceMonth,
        toCreate: [],
        alreadyCharged: [],
        needsReview: [],
        exempt: [],
        blocked: [],
        totalCents: 0
    };

    const suffix = monthReferenceSuffix(dueDate);

    registrations
        .filter(isActiveRegistration)
        .sort((a, b) => (a.responsavel?.nome || '').localeCompare(b.responsavel?.nome || ''))
        .forEach(registration => {
            const responsibleName = registration.responsavel?.nome || '(sem nome)';
            const studentName = registration.alunos?.[0]?.nome || '';
            const monthInvoices = invoicesByRegistration.get(registration.id) || [];

            // A trava é o externalReference desta geração; a descrição cobre o que veio
            // de carnê gerado no app e de lançamento manual feito pela secretaria.
            const alreadyMonthly = monthInvoices.filter(inv =>
                inv.externalReference.endsWith(`_${suffix}`) ||
                inv.description.toUpperCase().includes(`MENSALIDADE ${monthLabel}`)
            );

            if (alreadyMonthly.length > 0) {
                preview.alreadyCharged.push({ registration, responsibleName, studentName, invoices: alreadyMonthly });
                return;
            }

            if (monthInvoices.length > 0) {
                preview.needsReview.push({ registration, responsibleName, studentName, invoices: monthInvoices });
                return;
            }

            const plan = resolvePlan(registration, plans);
            if (!plan) {
                preview.blocked.push({ registration, responsibleName, studentName, reason: 'Plano não encontrado' });
                return;
            }

            const valueCents = monthlyValueCents(plan);
            if (valueCents <= 0) {
                preview.exempt.push({ registration, responsibleName, studentName, reason: plan.nome || 'Mensalidade isenta' });
                return;
            }

            if (!validateCPF(registration.responsavel?.cpf || '')) {
                preview.blocked.push({ registration, responsibleName, studentName, reason: 'CPF do responsável inválido' });
                return;
            }

            preview.toCreate.push({
                registration,
                responsibleName,
                studentName,
                modalidade: registration.modalidade || plan.modalidade || '',
                valueCents
            });
            preview.totalCents += valueCents;
        });

    return preview;
};

/** Recalcula o status financeiro do cadastro a partir do cache local (sem bater no provedor). */
const refreshRegistrationStatus = async (registrationId: string) => {
    const snap = await getDocs(query(collection(db, 'financial_payments'), where('studentId', '==', registrationId)));
    const payments = snap.docs.map(d => d.data()).filter(p => !isLegacyPayment(p));
    const status = calculateStatusFromPayments(payments);
    await updateDoc(doc(db, 'rumo_ao_esporte_2026_registrations', registrationId), {
        ...status,
        lastDeepSync: new Date().toISOString()
    });
    return status;
};

export interface GenerateMonthlyChargesOptions {
    dueDate: string;
    targets: MonthlyChargeTarget[];
    workerUrl: string;
    paymentConfig: PaymentProviderConfig;
    onProgress?: (done: number, total: number, studentName: string) => void;
    onRegistrationUpdated?: (registrationId: string, status: Record<string, any>) => void;
}

export const generateMonthlyCharges = async ({
    dueDate,
    targets,
    workerUrl,
    paymentConfig,
    onProgress,
    onRegistrationUpdated
}: GenerateMonthlyChargesOptions): Promise<MonthlyChargeResult> => {
    const monthLabel = monthLabelFromDueDate(dueDate);
    const suffix = monthReferenceSuffix(dueDate);
    const result: MonthlyChargeResult = { created: [], errors: [] };

    for (let index = 0; index < targets.length; index++) {
        const target = targets[index];
        const { registration } = target;
        onProgress?.(index, targets.length, target.studentName || target.responsibleName);

        const description = `Mensalidade ${monthLabel} - ${target.studentName} (${target.modalidade})`;
        const externalReference = `${registration.id}_${suffix}`;

        try {
            const response = await fetch(`${workerUrl}/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(withPaymentProviderPayload({
                    registrationId: registration.id,
                    responsibleName: target.responsibleName,
                    responsibleCpf: registration.responsavel?.cpf,
                    responsibleEmail: registration.responsavel?.email || '',
                    responsiblePhone: registration.responsavel?.telefonePrincipal || '',
                    childName: target.studentName,
                    modalidade: target.modalidade,
                    amount: target.valueCents,
                    description,
                    dueDate,
                    billingType: 'PIX',
                    externalReference,
                    idempotencyKey: deterministicUuid(externalReference)
                }, paymentConfig))
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success || !data.payment?.id) {
                throw new Error(data.error || data.message || `Falha na criação (HTTP ${response.status})`);
            }

            await SyncService.savePaymentToFirestore(data.payment, registration.id);
            const status = await refreshRegistrationStatus(registration.id);
            onRegistrationUpdated?.(registration.id, status);

            result.created.push({
                registrationId: registration.id,
                studentName: target.studentName,
                invoiceId: data.payment.id,
                value: data.payment.value || target.valueCents / 100
            });
        } catch (error: any) {
            console.error('[MonthlyCharges] Falha ao gerar cobrança', registration.id, error);
            result.errors.push({
                registrationId: registration.id,
                studentName: target.studentName || target.responsibleName,
                error: error?.message || 'Erro desconhecido'
            });
        }

        // Espaça as chamadas para não estourar o rate limit do provedor.
        if (index < targets.length - 1) await sleep(600);
    }

    onProgress?.(targets.length, targets.length, '');
    return result;
};

export const formatCents = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export { PAID_STATUSES, INACTIVE_STATUSES };
