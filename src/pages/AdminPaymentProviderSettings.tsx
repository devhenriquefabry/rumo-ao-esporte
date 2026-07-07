import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { ArrowUpRight, CheckCircle2, FlaskConical, Landmark, Loader2, RefreshCw, XCircle } from 'lucide-react';
import {
    getPaymentProviderConfig,
    getPaymentProviderLabel,
    savePaymentProviderConfig,
    type PaymentProviderConfig
} from '../utils/paymentProviderConfig';

type ProviderId = 'asaas' | 'cora';
type EnvironmentId = 'stage' | 'production';

interface ProviderEnvironment {
    id: EnvironmentId | 'production';
    configured: boolean;
    clientId?: string;
    hasClientId?: boolean;
    hasCertificateBinding?: boolean;
}

interface ProviderStatus {
    id: ProviderId;
    name: string;
    logo: string;
    configured: boolean;
    capabilities: string[];
    environments: ProviderEnvironment[];
}

const providerCopy: Record<ProviderId, { color: string; description: string; docs: string }> = {
    asaas: {
        color: '#0030b8',
        description: 'Gateway atual do sistema. Continua como padrão e mantém PIX, boleto, cartão, carnê, baixa manual e saldo.',
        docs: 'https://docs.asaas.com/'
    },
    cora: {
        color: '#ff3f70',
        description: 'Novo banco integrado como segundo provedor. Usa Integração Direta com client-id, certificado e private key via mTLS.',
        docs: 'https://developers.cora.com.br/docs/client-credentials-int-direta'
    }
};

const workerUrl = import.meta.env.VITE_WORKER_URL || import.meta.env.VITE_PAYMENT_API_URL;

export default function AdminPaymentProviderSettings() {
    const [providers, setProviders] = useState<ProviderStatus[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<ProviderId>('asaas');
    const [environment, setEnvironment] = useState<EnvironmentId>('stage');
    const [amount, setAmount] = useState('5.00');
    const [description, setDescription] = useState('Teste Rumo ao Esporte');
    const [billingType, setBillingType] = useState<'PIX' | 'BOLETO'>('PIX');
    const [loading, setLoading] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);
    const [paymentId, setPaymentId] = useState('');
    const [activeConfig, setActiveConfig] = useState<PaymentProviderConfig | null>(null);

    const selected = useMemo(() => providers.find(provider => provider.id === selectedProvider), [providers, selectedProvider]);

    const fetchProviders = async () => {
        if (!workerUrl) {
            setResult({ success: false, error: 'VITE_WORKER_URL nao configurado.' });
            return;
        }

        setLoading('providers');
        try {
            const response = await fetch(`${workerUrl}/payment-providers`);
            const data = await response.json();
            setProviders(data.providers || []);
            setResult(data);
        } catch (error: any) {
            setResult({ success: false, error: error.message });
        } finally {
            setLoading(null);
        }
    };

    useEffect(() => {
        fetchProviders();
        getPaymentProviderConfig().then(config => {
            setActiveConfig(config);
            setSelectedProvider(config.provider);
            setEnvironment(config.environment);
        });
    }, []);

    useEffect(() => {
        if (selectedProvider === 'asaas') setEnvironment('production');
        if (selectedProvider === 'cora') setEnvironment(previous => previous === 'production' ? 'stage' : previous);
    }, [selectedProvider]);

    const callWorker = async (path: string, options?: RequestInit) => {
        if (!workerUrl) throw new Error('VITE_WORKER_URL nao configurado.');
        const response = await fetch(`${workerUrl}${path}`, options);
        const data = await response.json();
        setResult(data);
        return data;
    };

    const handleSaveActiveConfig = async () => {
        setLoading('save-config');
        try {
            const saved = await savePaymentProviderConfig({
                provider: selectedProvider,
                environment: selectedProvider === 'asaas' ? 'production' : environment,
                testMode: selectedProvider === 'cora' && environment === 'stage'
            });
            setActiveConfig(saved);
            setResult({
                success: true,
                message: `Configuração financeira ativa: ${getPaymentProviderLabel(saved)}.`,
                config: saved
            });
        } catch (error: any) {
            setResult({ success: false, error: error.message });
        } finally {
            setLoading(null);
        }
    };

    const handleTest = async (action: 'auth' | 'balance') => {
        setLoading(action);
        try {
            await callWorker('/payment-providers/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: selectedProvider, environment, action })
            });
        } catch (error: any) {
            setResult({ success: false, error: error.message });
        } finally {
            setLoading(null);
        }
    };

    const handleCreateTestPayment = async () => {
        setLoading('create');
        try {
            const valueInCents = Math.round(Number(amount.replace(',', '.')) * 100);
            const data = await callWorker('/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: selectedProvider,
                    environment,
                    financialTestMode: selectedProvider === 'cora' && environment === 'stage',
                    amount: valueInCents,
                    billingType,
                    responsibleName: 'Admin Tester',
                    responsibleCpf: '15133300638',
                    responsibleEmail: 'admin_test@rumoaoesporte.com.br',
                    responsiblePhone: '44999999999',
                    childName: 'Teste Sistema',
                    registrationId: `TEST_${selectedProvider.toUpperCase()}_${Date.now()}`,
                    description
                })
            });
            if (data.payment?.id) setPaymentId(data.payment.id);
        } catch (error: any) {
            setResult({ success: false, error: error.message });
        } finally {
            setLoading(null);
        }
    };

    const handleStatus = async () => {
        if (!paymentId) return;
        setLoading('status');
        try {
            await callWorker(`/payment-status?paymentId=${encodeURIComponent(paymentId)}&provider=${selectedProvider}&environment=${environment}`);
        } catch (error: any) {
            setResult({ success: false, error: error.message });
        } finally {
            setLoading(null);
        }
    };

    const handleCoraStagePay = async () => {
        if (!paymentId) return;
        setLoading('stage-pay');
        try {
            await callWorker('/payment-providers/cora/stage-pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId: paymentId })
            });
        } catch (error: any) {
            setResult({ success: false, error: error.message });
        } finally {
            setLoading(null);
        }
    };

    const renderStatus = (configured: boolean) => (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 9px',
            borderRadius: 999,
            background: configured ? '#ecfdf3' : '#fff1f2',
            color: configured ? '#027a48' : '#be123c',
            fontWeight: 800,
            fontSize: '0.76rem'
        }}>
            {configured ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {configured ? 'Configurado' : 'Pendente'}
        </span>
    );

    return (
        <div className="admin-page" style={{ padding: '24px', color: '#172033' }}>
            <header style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                        <p style={{ margin: '0 0 6px', color: '#00a63a', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Financeiro</p>
                        <h1 style={{ margin: 0, fontSize: '2rem', color: '#17428f' }}>Bancos e APIs de pagamento</h1>
                        <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 999, background: activeConfig?.testMode ? '#fff7ed' : '#ecfdf3', color: activeConfig?.testMode ? '#9a3412' : '#027a48', fontWeight: 900 }}>
                            Ambiente ativo: {activeConfig ? getPaymentProviderLabel(activeConfig) : 'carregando...'}
                        </div>
                        <p style={{ margin: '8px 0 0', color: '#64748b', maxWidth: 820 }}>
                            Selecione qual banco fará a operação financeira, teste credenciais e gere cobranças isoladas sem alterar a lógica atual do sistema.
                        </p>
                    </div>
                    <button onClick={fetchProviders} disabled={loading === 'providers'} style={buttonStyle('#17428f')}>
                        {loading === 'providers' ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
                        Atualizar status
                    </button>
                </div>
            </header>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 22 }}>
                {providers.map(provider => {
                    const isActive = selectedProvider === provider.id;
                    return (
                        <button
                            key={provider.id}
                            type="button"
                            onClick={() => setSelectedProvider(provider.id)}
                            style={{
                                textAlign: 'left',
                                border: `2px solid ${isActive ? providerCopy[provider.id].color : '#e2e8f0'}`,
                                borderRadius: 12,
                                background: isActive ? '#f8fbff' : '#fff',
                                padding: 18,
                                cursor: 'pointer',
                                boxShadow: isActive ? '0 12px 28px rgba(23, 66, 143, 0.12)' : '0 2px 10px rgba(15, 23, 42, 0.04)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                <img src={provider.logo} alt={`Logo ${provider.name}`} style={{ width: 128, height: 42, objectFit: 'contain', objectPosition: 'left center' }} />
                                {renderStatus(provider.configured)}
                            </div>
                            <p style={{ margin: '14px 0 12px', color: '#475569', lineHeight: 1.45 }}>{providerCopy[provider.id].description}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {provider.capabilities.slice(0, 6).map(capability => (
                                    <span key={capability} style={{ padding: '4px 7px', borderRadius: 6, background: '#f1f5f9', color: '#334155', fontSize: '0.72rem', fontWeight: 800 }}>
                                        {capability}
                                    </span>
                                ))}
                            </div>
                        </button>
                    );
                })}
            </section>

            <main style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.8fr)', gap: 18 }}>
                <section style={panelStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                        <Landmark color={providerCopy[selectedProvider].color} />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.18rem' }}>Operação selecionada</h2>
                            <p style={{ margin: '3px 0 0', color: '#64748b' }}>Banco: {selected?.name || selectedProvider}</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                        <label style={labelStyle}>
                            Ambiente
                            <select value={environment} onChange={event => setEnvironment(event.target.value as EnvironmentId)} disabled={selectedProvider === 'asaas'} style={inputStyle}>
                                <option value="stage">Cora Stage</option>
                                <option value="production">Produção</option>
                            </select>
                        </label>
                        <label style={labelStyle}>
                            Forma
                            <select value={billingType} onChange={event => setBillingType(event.target.value as 'PIX' | 'BOLETO')} style={inputStyle}>
                                <option value="PIX">PIX</option>
                                <option value="BOLETO">Boleto + PIX</option>
                            </select>
                        </label>
                        <label style={labelStyle}>
                            Valor de teste
                            <input value={amount} onChange={event => setAmount(event.target.value)} style={inputStyle} />
                        </label>
                    </div>

                    <label style={{ ...labelStyle, marginBottom: 16 }}>
                        Descrição da cobrança teste
                        <input value={description} onChange={event => setDescription(event.target.value)} style={inputStyle} />
                    </label>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button onClick={handleSaveActiveConfig} disabled={!!loading} style={buttonStyle('#111827')}>
                            {loading === 'save-config' ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />}
                            Usar este banco no sistema
                        </button>
                        <button onClick={() => handleTest('auth')} disabled={!!loading} style={buttonStyle(providerCopy[selectedProvider].color)}>
                            {loading === 'auth' ? <Loader2 className="spin" size={17} /> : <FlaskConical size={17} />}
                            Testar autenticação
                        </button>
                        <button onClick={() => handleTest('balance')} disabled={!!loading} style={buttonStyle('#17428f')}>
                            {loading === 'balance' ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
                            Testar saldo
                        </button>
                        <button onClick={handleCreateTestPayment} disabled={!!loading} style={buttonStyle('#00a63a')}>
                            {loading === 'create' ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />}
                            Gerar cobrança teste
                        </button>
                    </div>

                    <div style={{ marginTop: 18, padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <label style={labelStyle}>
                            ID da cobrança para consulta
                            <input value={paymentId} onChange={event => setPaymentId(event.target.value)} placeholder="pay_... ou inv_..." style={inputStyle} />
                        </label>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                            <button onClick={handleStatus} disabled={!paymentId || !!loading} style={buttonStyle('#334155')}>
                                Consultar status
                            </button>
                            {selectedProvider === 'cora' && environment === 'stage' && (
                                <button onClick={handleCoraStagePay} disabled={!paymentId || !!loading} style={buttonStyle('#ff3f70')}>
                                    Simular pagamento Cora Stage
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                <aside style={panelStyle}>
                    <h2 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>Status técnico</h2>
                    {selected?.environments.map(item => (
                        <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                                <strong>{item.id === 'stage' ? 'Stage' : 'Produção'}</strong>
                                {renderStatus(item.configured)}
                            </div>
                            {selectedProvider === 'cora' && (
                                <div style={{ marginTop: 8, color: '#64748b', fontSize: '0.86rem', lineHeight: 1.55 }}>
                                    <div>Client ID: {item.clientId || 'pendente'}</div>
                                    <div>Certificado mTLS: {item.hasCertificateBinding ? 'binding criado' : 'pendente no Cloudflare'}</div>
                                </div>
                            )}
                        </div>
                    ))}

                    <a href={providerCopy[selectedProvider].docs} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, color: providerCopy[selectedProvider].color, fontWeight: 900, textDecoration: 'none' }}>
                        Documentação oficial <ArrowUpRight size={15} />
                    </a>

                    <div style={{ marginTop: 18, padding: 12, borderRadius: 10, background: '#fffbeb', color: '#92400e', fontSize: '0.86rem', lineHeight: 1.5 }}>
                        A Cora exige certificado e private key via mTLS. No Cloudflare, isso precisa ser enviado pelo Wrangler e vinculado ao Worker como binding.
                    </div>
                </aside>
            </main>

            <section style={{ ...panelStyle, marginTop: 18, background: '#111827', color: '#d1d5db' }}>
                <div style={{ marginBottom: 10, fontWeight: 900, color: '#fff' }}>Log da última chamada</div>
                <pre style={{ margin: 0, overflow: 'auto', maxHeight: 360, fontSize: '0.82rem' }}>{JSON.stringify(result || {}, null, 2)}</pre>
            </section>
        </div>
    );
}

const panelStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 18,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)'
};

const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    color: '#334155',
    fontWeight: 800,
    fontSize: '0.86rem'
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '10px 11px',
    color: '#0f172a',
    background: '#fff',
    font: 'inherit',
    fontWeight: 600
};

const buttonStyle = (background: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: 'none',
    borderRadius: 9,
    background,
    color: '#fff',
    padding: '11px 14px',
    fontWeight: 900,
    cursor: 'pointer'
});
