
export interface Student {
    uniqueId: string;
    regId: string;
    aluno: {
        nome: string;
        fotoUrl?: string;
        turmaId?: string;
        dataNascimento?: string;
        signatureData?: string;
    } | null;
    responsavel: {
        nome: string;
        cpf: string;
        email: string;
        telefonePrincipal?: string;
        celular?: string;
        telefone?: string;
    };
    modalidade: string;
    createdAt?: any;
    status: string;
    contractStatus: string;
    planId: string;
    financialPendingAmount: number;
    financialPendingDescription: string;
    financialInvoiceUrl: string;
    financialReceivedAmount: number;
    associadoUba: boolean;
    senha?: string;
}

export interface Turma {
    id: string;
    nome: string;
    horario: string;
    dias?: string | string[];
}

export interface AdminDashboardProps {
    filterStatus?: 'pendente' | 'confirmado' | 'desativados';
}
