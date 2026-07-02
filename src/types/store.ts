export type PaymentMethodType = 'PIX' | 'BOLETO' | 'CREDIT_CARD';

export interface ProductVariation {
    name: string;      // Ex: "Cor", "Modelo"
    options: string[]; // Ex: ["Azul", "Vermelho"]
}

export interface StoreProduct {
    id?: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    stock: number;
    active: boolean;
    hasSizes?: boolean;
    sizes?: string[];
    variations?: ProductVariation[];
    paymentMethods?: PaymentMethodType[];  // Formas aceitas (padrão: PIX)
    maxInstallments?: number;             // Máximo de parcelas no cartão (1-12)
    createdAt?: any;
    updatedAt?: any;
}

export interface StoreOrderItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    size?: string;
    selectedVariations?: Record<string, string>; // { "Cor": "Azul" }
}

export interface StoreOrder {
    id?: string;
    customerId: string;
    customerName: string;
    customerPhotoUrl?: string;
    items: StoreOrderItem[];
    totalAmount: number;
    paymentMethod?: PaymentMethodType;
    installments?: number;
    status: 'pending_payment' | 'paid' | 'cancelled' | 'delivered';
    pixData?: {
        encodedImage?: string;
        payload?: string;
        expirationDate?: string;
    };
    invoiceId?: string;
    invoiceUrl?: string;
    receiptUrl?: string;
    createdAt?: any;
    updatedAt?: any;
}
