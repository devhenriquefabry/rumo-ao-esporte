export interface RentalLocation {
    id: string;
    name: string; // Ex: "Quadra de Areia 1", "Quiosque Principal"
    type: 'quadra' | 'quiosque';
    description: string;
    // Horários de Funcionamento & Preços
    // Ex: { "seg": [{ start: "08:00", end: "12:00", price: 50 }, { start: "18:00", end: "22:00", price: 90 }] }
    schedule: {
        [key: string]: { start: string, end: string, price: number }[];
    };

    // Antigo (Depreciado, manter por compatibilidade temporária se necessário, ou remover direto)
    // availableHours: string[]; 

    images: string[]; // URLs das fotos
    active: boolean;  // Se está disponível para aluguel ou manutenção
    createdAt?: string;

    // Regras específicas (opcional)
    // Ex: minHours: 1, maxHours: 4
}

export interface RentalBooking {
    id: string;

    // Dados do Local
    locationId: string;
    locationName: string;
    locationType: 'quadra' | 'quiosque';

    // Dados do Cliente/Responsável
    customerName: string;
    customerCpf: string;
    customerPhone: string;
    customerEmail?: string;

    // Detalhes da Reserva
    date: string; // YYYY-MM-DD
    startTime: string; // HH:MM (Início)
    endTime: string; // HH:MM (Fim) -> Calculado base na duração
    durationHours: number; // Quantas horas reservadas (1, 2, etc.)

    // Financeiro
    totalPrice: number;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
    paymentId?: string; // ID da cobrança no Asaas
    paymentStatus?: string; // 'PENDING', 'RECEIVED', 'OVERDUE'
    paymentLink?: string; // Invoice URL
    externalReference?: string; // RENTAL_{ID}

    // Metadados
    createdAt: string;
    createdBy: string; // Usuário que criou a reserva (Admin)
    notes?: string; // Observações internas
}
