export interface StudentData {
    id: string;
    responsavel: {
        nome: string;
        cpf: string;
        telefonePrincipal: string;
        email?: string;
    };
    alunos: Array<{
        nome: string;
        turmaId: string;
        fotoUrl?: string;
    }>;
    modalidade: string;
    status: string;
    paymentId?: string;
    amount?: number;
    billingType?: string;
    createdAt?: any;
    contractStatus?: string;
    financialPendingAmount?: number;
    financialPendingDescription?: string;
    financialInvoiceUrl?: string;
    financialReceivedAmount?: number;
    financialReceivedThisMonth?: number;
    financialReceivedLastMonth?: number;
    financialPendingThisMonth?: number;
    financialPendingLastMonth?: number;
    paymentDay?: number;
    planId?: string;
    financialLastPaymentValue?: number;
}
