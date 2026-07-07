import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type PaymentProviderId = 'asaas' | 'cora';
export type PaymentEnvironmentId = 'stage' | 'production';

export interface PaymentProviderConfig {
    provider: PaymentProviderId;
    environment: PaymentEnvironmentId;
    testMode: boolean;
}

export const DEFAULT_PAYMENT_PROVIDER_CONFIG: PaymentProviderConfig = {
    provider: 'asaas',
    environment: 'production',
    testMode: false
};

const SETTINGS_REF = doc(db, 'system_settings', 'payment_provider');

export async function getPaymentProviderConfig(): Promise<PaymentProviderConfig> {
    try {
        const snapshot = await getDoc(SETTINGS_REF);
        if (!snapshot.exists()) return DEFAULT_PAYMENT_PROVIDER_CONFIG;

        const data = snapshot.data();
        const provider = data.provider === 'cora' ? 'cora' : 'asaas';
        const environment = data.environment === 'stage' ? 'stage' : 'production';

        return {
            provider,
            environment: provider === 'asaas' ? 'production' : environment,
            testMode: Boolean(data.testMode)
        };
    } catch (error) {
        console.error('[PaymentProviderConfig] Error loading config:', error);
        return DEFAULT_PAYMENT_PROVIDER_CONFIG;
    }
}

export async function savePaymentProviderConfig(config: PaymentProviderConfig) {
    const normalized: PaymentProviderConfig = {
        provider: config.provider,
        environment: config.provider === 'asaas' ? 'production' : config.environment,
        testMode: Boolean(config.testMode)
    };

    await setDoc(SETTINGS_REF, {
        ...normalized,
        updatedAt: new Date().toISOString()
    }, { merge: true });

    return normalized;
}

export function withPaymentProviderPayload<T extends Record<string, any>>(payload: T, config: PaymentProviderConfig): T {
    return {
        ...payload,
        provider: config.provider,
        environment: config.environment,
        paymentProvider: config.provider,
        paymentEnvironment: config.environment,
        financialTestMode: config.testMode
    };
}

export function withPaymentProviderQuery(path: string, config: PaymentProviderConfig) {
    const params = new URLSearchParams({
        provider: config.provider,
        environment: config.environment
    });
    if (config.testMode) params.set('financialTestMode', 'true');

    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}${params.toString()}`;
}

export function getPaymentProviderLabel(config: PaymentProviderConfig) {
    if (config.provider === 'asaas') return 'Asaas / Produção';
    return config.environment === 'stage' ? 'Cora / Teste Stage' : 'Cora / Produção';
}
